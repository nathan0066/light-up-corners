# Light Up Corners · 点亮角落

A GNOME Shell extension that adds a sunlight-gold glow and a matching rounded upper-left corner to VS Code and ChatGPT desktop windows, making overlapping dark windows easier to distinguish.

[中文安装说明](README.zh-CN.md)

![Illustration rendered using the extension drawing code](preview.png)

*Illustration generated with the extension renderer; not a desktop screenshot.*

## Compatibility

Prepared and syntax-checked for GNOME Shell 42.9 on X11. The package declares support for GNOME 42 only. Other GNOME versions, Wayland, fractional scaling, and different application distributions have not been verified. Check `gnome-shell --version` and `echo "$XDG_SESSION_TYPE"` before installing.

## Appearance

- Continuous sunlight-gold top edge, rounded corner, and left edge.
- The actual window is rounded only at the upper-left corner (7 px); a 0.5 px content inset keeps the translucent gold rim clean. The other three corners stay unchanged.
- Horizontal length: 64.228710% of the window's monitor width (1644 px on a 2560 px wide monitor).
- Vertical length: horizontal length × ((√5 − 1) / 2)⁸, approximately 2.128624% (35 px at the 2560 px baseline).
- Active windows are brighter; fullscreen windows have neither glow nor corner clipping.
- The glow follows window stacking and does not accept pointer input. Corner clipping is visual; it does not alter the application's rectangular input region.
- Only X11 window classes `code` and `Chatgpt` are matched. Browser tabs and other app variants are not included.
- No network access, telemetry, clipboard access, or application-content inspection.

## Install

In the directory containing the package, run:

```sh
gnome-extensions install ./light-up-corners@shuyu.shell-extension.zip
```

On the tested X11 session, press **Alt+F2**, type **r**, and press **Enter** to reload GNOME Shell. Then enable the extension:

```sh
gnome-extensions enable light-up-corners@shuyu
gnome-extensions info light-up-corners@shuyu
```

For a later update, add `--force` to the install command, then reload Shell again. Disabling and enabling alone does not reload changed JavaScript.

If the earlier development extension `dark-gold-corners@qcraft.local` is installed, disable it before enabling this package to avoid drawing the glow twice:

```sh
gnome-extensions disable dark-gold-corners@qcraft.local
```

## Disable or uninstall

```sh
gnome-extensions disable light-up-corners@shuyu
gnome-extensions uninstall light-up-corners@shuyu
```

## Build

From this source directory:

```sh
mkdir -p dist
gnome-extensions pack . --extra-source=LICENSE --out-dir=dist
```

The ZIP contains readable JavaScript, metadata, and the license. It needs no Node.js or separate round-corner extension at runtime; it uses the graphics APIs built into GNOME Shell.

## Validation and development

The sixth-power appearance was accepted on the original GNOME 42.9 / X11 setup. The eighth-power length is newly packaged for local preview; confirm the visual result after installing. JavaScript syntax and package contents were checked. Cross-machine installation and performance remain unverified.

Change `HORIZONTAL_MONITOR_RATIO` in `extension.js` to adjust horizontal length. Vertical length follows automatically. Reload Shell after code changes.

This project was developed with AI assistance. Maintainers and contributors should review and understand the implementation before distributing changes.

## License

MIT. This is an independent project, not an official VS Code or ChatGPT extension.
