# Changelog

## 0.4.0

- Keep the 35 px vertical glow and set the horizontal length to the eighth power of the golden ratio.
- Set the 2560 px monitor baseline to about 1644 × 35 px.
- Preserve the sunlight-gold palette, upper-left window rounding, and monitor-relative sizing.

## 0.3.0

- Keep the 35 px vertical length and change the horizontal ratio to the sixth power of the golden ratio.
- Update the 2560 px monitor baseline from 388 px to 628 px.
- Preserve sunlight-gold colors, the 7 px upper-left rounding, and the clean translucent rim.
- Keep the existing extension UUID for in-place upgrades.

## 0.2.0

- Use a warmer sunlight-gold palette and a compact 388 × 35 px baseline on a 2560 px monitor.
- Preserve monitor-relative sizing with a golden-ratio fifth-power aspect ratio.
- Round the actual upper-left window corner to match the 7 px glow radius.
- Correct GNOME 42 offscreen padding and premultiplied-alpha blending.
- Inset the dark corner content by 0.5 px to clean the translucent gold rim.
- Keep both effects in one extension; disable clipping in fullscreen and remove it on teardown.
- Retain the public UUID for upgrades from v0.1.0.

## 0.1.0

Initial team preview release based on the accepted local version: dark-gold corner accents for VS Code and ChatGPT, continuous rounded edges, monitor-relative sizing, proportional vertical length, focus dimming, and fullscreen hiding. Supported metadata target: GNOME 42.
