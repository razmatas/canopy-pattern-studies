# Canopy Vector Pattern Generator

A standalone, no-build web app for exploring four vector growth studies. It runs entirely in the browser and makes no external network requests.

## Run locally

Open `index.html` in a modern browser, or serve this directory over HTTP:

```sh
python3 -m http.server 4186
```

Then visit <http://localhost:4186>.

## Features

- Four studies: supplied artwork, source-based coral, folded contours, and generated coral
- Seeded variations, shape controls, timeline playback, and comparison view
- Current-frame SVG and 1600 × 1600 PNG export
- Current-settings H.264 MP4 export at 1080 × 1080 / 60 fps, with progress and cancellation
- Independent foreground/background choices from the seven approved colours
- Square output crop, zoom, horizontal/vertical position, drag-to-pan and framing reset
- Four clearly labelled fixed reference films in `exports/`
- Worker-based generation over HTTP, with a main-thread fallback for file and sandboxed-page contexts

## Deploy with Vercel

Import this repository as a static project. Use the `Other` framework preset, leave the build and install commands empty, and set the output directory to `.`. The app uses relative asset paths and needs no build step or environment variables.

## Source files

The app's browser runtime is in the root-level JavaScript and CSS files. `source/canopyu-pattern-1.svg` is the supplied vector source; `source-data.js` contains the derived data used by the runtime. 

## Current-settings exports

**Save MP4** captures the selected study, seed, shape controls, colours, framing and clip duration when clicked. It renders every frame of the full outward growth animation, from square origin through full form, including the existing final hold. Playback speed and the timeline's current position do not affect the movie. Changing controls during rendering affects the preview and future exports; the in-progress movie keeps its captured settings.

Encoding runs locally using WebCodecs H.264 and the bundled MIT-licensed mp4-muxer 5.2.2 (`vendor/`). There is no recording in real time, server upload, runtime CDN dependency or renamed WebM fallback. Use a current Chrome, Edge or compatible Safari over localhost or HTTPS. An unsupported encoder produces an actionable error and leaves still exports available. MP4 always uses the selected opaque background. The transparent checkbox applies to SVG and PNG only.

SVG remains editable vector artwork; PNG is 1600 × 1600. Both save the current timeline frame with the same two colours and framing as the preview. Antialiasing and H.264 compression naturally produce blended edge pixels; the artwork uses only the chosen foreground and background, without additional decorative colours.

Framing is shared across studies. Horizontal and vertical positions are percentages of the square output width/height. Drag the preview to move, scroll to zoom, or use the labelled sliders; Reset framing returns to 100% zoom and the centred composition. All formats crop at the square output boundary.

## Approved version

`saved/2026-10-29-approved-before-export-controls/` preserves the complete browser runtime before these additions. Existing saved presets, archived versions and reference films remain in place.

## Smoother contours and canvas feedback — 29 October 2026

Source coral now uses uniform arc-length samples, Gaussian fairing in artboard units, and periodic cubic curves, instead of retaining every second/third grid vertex. `contour-curves.js` removes the small grid bumps before any output is rendered; its scale is independent of zoom and export resolution. The square region is protected, including the original exact square frame at time zero. The same path geometry is used by live preview, editable SVG, PNG and MP4. Supplied vector artwork and the folded/generated growth models retain their existing geometry.

Preview backing resolution follows display density (up to 2240 pixels). PNG renders at 3200 pixels before downsampling to 1600; movie frames render at 2160 pixels before downsampling to 1080, with H.264 target bitrate 24 Mbps. This reduces raster stair steps and video shimmer without blurring the shape geometry.

Both colour controls provide native keyboard-operable radio swatches, colour names, hex labels and visible selection states. Dragging shows alignment guides, the moved origin and live horizontal/vertical offsets, with centre snapping near zero. Position sliders and Reset framing update the same feedback. The initial hint fades after six seconds; guides fade after movement ends. These are DOM overlays and never enter the canvas or any export.

The immediately preceding complete app runtime is preserved in `saved/2026-10-29-before-contour-smoothing/`. Matched before/after details, a high-zoom MP4 and verification evidence are in the parent project's `output/canopy-export-verification/smoothing/` folder.
