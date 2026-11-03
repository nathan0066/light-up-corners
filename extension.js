// SPDX-License-Identifier: MIT
'use strict';

const {Clutter, Meta, GObject, Shell} = imports.gi;
const Cairo = imports.cairo;
const Main = imports.ui.main;

// Calibrated to a 35 px height on a 2560 px wide monitor.
const VERTICAL_LENGTH_RATIO = ((Math.sqrt(5) - 1) / 2) ** 6;
const HORIZONTAL_MONITOR_RATIO = 35 / VERTICAL_LENGTH_RATIO / 2560;
const CANVAS_SCALE = 2;
const CORNER_RADIUS = 7;

// Clip the window surface separately so the glow keeps its original antialiasing.
const CORNER_CLIP_DECLARATIONS = 'uniform vec4 corner_geometry;';
const CORNER_CLIP_CODE = `
    vec2 corner_pos = cogl_tex_coord0_in.xy * corner_geometry.xy - corner_geometry.zw;
    float radius = ${CORNER_RADIUS}.0;
    if (corner_pos.x >= 0.0 && corner_pos.y >= 0.0 &&
        corner_pos.x < radius && corner_pos.y < radius) {
        float distance_to_center = length(corner_pos - vec2(radius));
        // Keep the dark surface half a pixel inside the translucent gold rim.
        float content_radius = radius - 0.5;
        float coverage = 1.0 - smoothstep(content_radius - 0.5, content_radius + 0.5, distance_to_center);
        cogl_color_out *= coverage;
    }
`;

const WindowCornerClip = GObject.registerClass(
class WindowCornerClip extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT,
            CORNER_CLIP_DECLARATIONS, CORNER_CLIP_CODE, false);
    }

    updateGeometry(width, height, left, top) {
        this._geometry = [width, height, left, top];
        this.queue_repaint();
    }

    vfunc_paint_target(node, context) {
        if (this._geometry) {
            const actor = this.get_actor();
            const volume = actor.get_paint_volume();
            const origin = volume ? volume.get_origin() : {x: 0, y: 0};
            const width = volume ? volume.get_width() : this._geometry[0];
            const height = volume ? volume.get_height() : this._geometry[1];
            // GNOME 42 enlarges the offscreen paint box by 3 logical pixels.
            // Match clutter_actor_box_enlarge_for_effects(), including its origin.
            const paddedWidth = Math.round(width) + 3;
            const paddedHeight = Math.round(height) + 3;
            const offsetX = Math.trunc(Math.ceil(origin.x + width + 0.75) - paddedWidth);
            const offsetY = Math.trunc(Math.ceil(origin.y + height + 0.75) - paddedHeight);
            this.set_uniform_float(this.get_uniform_location('corner_geometry'),
                4, [paddedWidth, paddedHeight,
                    this._geometry[2] - offsetX, this._geometry[3] - offsetY]);
        }
        // Both the captured window and the antialiased mask use premultiplied alpha.
        this.get_pipeline().set_blend('RGBA = ADD(SRC_COLOR, DST_COLOR*(1-SRC_COLOR[A]))');
        super.vfunc_paint_target(node, context);
    }
});

// The small canvas is part of each window: stacking, animation and input stay native.
function drawCorner(cr, width, height) {
    cr.setOperator(Cairo.Operator.CLEAR);
    cr.paint();
    cr.setOperator(Cairo.Operator.OVER);

    const radius = CORNER_RADIUS;
    cr.moveTo(radius, 0);
    cr.lineTo(width, 0);
    cr.lineTo(width, height);
    cr.lineTo(0, height);
    cr.lineTo(0, radius);
    cr.arc(radius, radius, radius, Math.PI, Math.PI * 1.5);
    cr.closePath();
    cr.clip();

    // Two gradients keep the glow strongest near the corner and away from text.
    const glow = new Cairo.LinearGradient(0, 0, width, 0);
    glow.addColorStopRGBA(0, 1.0, 0.76, 0.28, 0.27);
    glow.addColorStopRGBA(0.35, 1.0, 0.66, 0.16, 0.15);
    glow.addColorStopRGBA(1, 1.0, 0.66, 0.16, 0);
    const fade = new Cairo.LinearGradient(0, 0, 0, height);
    fade.addColorStopRGBA(0, 0, 0, 0, 1);
    fade.addColorStopRGBA(0.5, 0, 0, 0, 0.3);
    fade.addColorStopRGBA(1, 0, 0, 0, 0);
    cr.setSource(glow);
    cr.mask(fade);

    // One continuous 2 px stroke keeps both joins tangent and equally bright.
    // Project x / width + y / height onto a single gradient for both directions.
    const denominator = width * width + height * height;
    const edge = new Cairo.LinearGradient(0, 0,
        width * height * height / denominator,
        height * width * width / denominator);
    edge.addColorStopRGBA(0, 1.0, 0.82, 0.36, 0.98);
    edge.addColorStopRGBA(0.4, 1.0, 0.69, 0.18, 0.68);
    edge.addColorStopRGBA(1, 1.0, 0.69, 0.18, 0);
    cr.setSource(edge);
    cr.setLineWidth(2);
    cr.moveTo(1, height);
    cr.lineTo(1, radius);
    cr.arc(radius, radius, radius - 1, Math.PI, Math.PI * 1.5);
    cr.lineTo(width, 1);
    cr.stroke();
    return true;
}

class DarkGoldCorners {
    enable() {
        this._windows = new Map();
        this._mapId = global.window_manager.connect('map', (_wm, actor) => {
            this._addWindow(actor);
        });
        this._focusId = global.display.connect('notify::focus-window', () => {
            for (const record of this._windows.values())
                record.overlay.opacity = record.window.has_focus() ? 255 : 170;
        });
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => {
            for (const [actor, record] of this._windows)
                this._updateWindow(actor, record);
        });
        const scanWindows = () => {
            for (const actor of global.get_window_actors())
                this._addWindow(actor);
        };
        scanWindows();
        // Restored X11 windows may not be available during extension startup.
        this._startupId = 0;
        if (Main.layoutManager._startingUp) {
            this._startupId = Main.layoutManager.connect('startup-complete', () => {
                Main.layoutManager.disconnect(this._startupId);
                this._startupId = 0;
                scanWindows();
            });
        }
    }

    _addWindow(actor) {
        if (this._windows.has(actor))
            return;
        const window = actor.meta_window;
        if (!window || ![Meta.WindowType.NORMAL, Meta.WindowType.DIALOG,
            Meta.WindowType.MODAL_DIALOG].includes(window.get_window_type()))
            return;
        const wmClass = (window.get_wm_class() || '').toLowerCase();
        if (wmClass !== 'code' && wmClass !== 'chatgpt')
            return;

        const canvas = new Clutter.Canvas();
        const overlay = new Clutter.Actor({
            name: 'dark-gold-window-corner',
            reactive: false,
            content: canvas,
            content_gravity: Clutter.ContentGravity.RESIZE_FILL,
            opacity: window.has_focus() ? 255 : 170,
        });
        overlay.set_content_scaling_filters(
            Clutter.ScalingFilter.LINEAR, Clutter.ScalingFilter.LINEAR);
        canvas.connect('draw', (_canvas, cr, width, height) => {
            // Downsample a double-resolution canvas to soften curved edge pixels.
            cr.save();
            cr.scale(CANVAS_SCALE, CANVAS_SCALE);
            drawCorner(cr, width / CANVAS_SCALE, height / CANVAS_SCALE);
            cr.restore();
            return true;
        });
        const record = {window, overlay, canvas, signals: [], width: 0, height: 0,
            surface: null, clip: null};
        // GNOME 42 X11 places the client surface directly under WindowActor.
        const surface = actor.get_first_child();
        if (window.get_client_type() === Meta.WindowClientType.X11 && surface &&
            GObject.type_name(surface.constructor.$gtype).startsWith('MetaSurfaceActor')) {
            record.surface = surface;
            record.clip = new WindowCornerClip();
            surface.add_effect_with_name('light-up-corners-window-clip', record.clip);
        }
        this._windows.set(actor, record);
        actor.add_child(overlay);

        const update = () => this._updateWindow(actor, record);
        for (const signal of ['position-changed', 'size-changed', 'notify::fullscreen'])
            record.signals.push([window, window.connect(signal, update)]);
        record.signals.push([actor, actor.connect('notify::allocation', update)]);
        if (record.surface) {
            record.signals.push([record.surface,
                record.surface.connect('notify::allocation', update)]);
        }
        record.signals.push([actor, actor.connect('destroy', () => {
            this._removeWindow(actor);
        })]);
        update();
    }

    _updateWindow(actor, record) {
        const {window, overlay, canvas} = record;
        if (window.is_fullscreen()) {
            overlay.hide();
            if (record.clip)
                record.clip.set_enabled(false);
            return;
        }
        const frame = window.get_frame_rect();
        const buffer = window.get_buffer_rect();
        if (record.clip) {
            const surface = record.surface;
            record.clip.updateGeometry(surface.width, surface.height,
                frame.x - buffer.x - surface.x, frame.y - buffer.y - surface.y);
            record.clip.set_enabled(true);
        }
        const monitor = global.display.get_monitor_geometry(window.get_monitor());
        const width = Math.max(1, Math.min(
            Math.round(monitor.width * HORIZONTAL_MONITOR_RATIO), frame.width));
        const height = Math.max(1, Math.min(Math.round(width * VERTICAL_LENGTH_RATIO), frame.height));
        overlay.set_position(frame.x - buffer.x, frame.y - buffer.y);
        overlay.set_size(width, height);
        if (record.width !== width || record.height !== height) {
            record.width = width;
            record.height = height;
            canvas.set_size(width * CANVAS_SCALE, height * CANVAS_SCALE);
            canvas.invalidate();
        }
        actor.set_child_above_sibling(overlay, null);
        overlay.show();
    }

    _removeWindow(actor) {
        const record = this._windows.get(actor);
        if (!record)
            return;
        this._windows.delete(actor);
        for (const [object, id] of record.signals)
            object.disconnect(id);
        if (record.clip)
            record.surface.remove_effect(record.clip);
        record.overlay.destroy();
    }

    disable() {
        if (this._startupId) {
            Main.layoutManager.disconnect(this._startupId);
            this._startupId = 0;
        }
        Main.layoutManager.disconnect(this._monitorsId);
        global.window_manager.disconnect(this._mapId);
        global.display.disconnect(this._focusId);
        for (const actor of [...this._windows.keys()])
            this._removeWindow(actor);
        this._windows.clear();
    }
}

function init() {
    return new DarkGoldCorners();
}
