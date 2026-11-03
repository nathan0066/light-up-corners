// SPDX-License-Identifier: MIT
'use strict';

const {Clutter, Meta} = imports.gi;
const Cairo = imports.cairo;
const Main = imports.ui.main;

// Calibrated to 540 px on the current 2560 px wide monitor.
const HORIZONTAL_MONITOR_RATIO = 540 / 2560;

// The small canvas is part of each window: stacking, animation and input stay native.
function drawCorner(cr, width, height) {
    cr.setOperator(Cairo.Operator.CLEAR);
    cr.paint();
    cr.setOperator(Cairo.Operator.OVER);

    const radius = 7;
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
    glow.addColorStopRGBA(0, 0.72, 0.54, 0.25, 0.27);
    glow.addColorStopRGBA(0.35, 0.66, 0.47, 0.20, 0.15);
    glow.addColorStopRGBA(1, 0.66, 0.47, 0.20, 0);
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
    edge.addColorStopRGBA(0, 0.83, 0.65, 0.33, 0.95);
    edge.addColorStopRGBA(0.4, 0.72, 0.53, 0.25, 0.65);
    edge.addColorStopRGBA(1, 0.72, 0.53, 0.25, 0);
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
            opacity: window.has_focus() ? 255 : 170,
        });
        canvas.connect('draw', (_canvas, cr, width, height) => {
            return drawCorner(cr, width, height);
        });
        const record = {window, overlay, canvas, signals: [], width: 0, height: 0};
        this._windows.set(actor, record);
        actor.add_child(overlay);

        const update = () => this._updateWindow(actor, record);
        for (const signal of ['position-changed', 'size-changed', 'notify::fullscreen'])
            record.signals.push([window, window.connect(signal, update)]);
        record.signals.push([actor, actor.connect('notify::allocation', update)]);
        record.signals.push([actor, actor.connect('destroy', () => {
            this._removeWindow(actor);
        })]);
        update();
    }

    _updateWindow(actor, record) {
        const {window, overlay, canvas} = record;
        if (window.is_fullscreen()) {
            overlay.hide();
            return;
        }
        const frame = window.get_frame_rect();
        const buffer = window.get_buffer_rect();
        const monitor = global.display.get_monitor_geometry(window.get_monitor());
        const width = Math.max(1, Math.min(
            Math.round(monitor.width * HORIZONTAL_MONITOR_RATIO), frame.width));
        const height = Math.max(1, Math.min(Math.round(width * ((Math.sqrt(5) - 1) / 2) ** 2), frame.height));
        overlay.set_position(frame.x - buffer.x, frame.y - buffer.y);
        overlay.set_size(width, height);
        if (record.width !== width || record.height !== height) {
            record.width = width;
            record.height = height;
            canvas.set_size(width, height);
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
