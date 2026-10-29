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
- Current-settings MP4 export at 1080 × 1080, 2048 × 2048 (2K square), or 4096 × 4096 (4K square), all 60 fps, with progress and cancellation
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

Encoding runs locally using WebCodecs H.264 (or HEVC when needed for the selected size) and the bundled MIT-licensed mp4-muxer 5.2.2 (`vendor/`). There is no recording in real time, server upload, runtime CDN dependency or renamed WebM fallback. Use a current Chrome, Edge or compatible Safari over localhost or HTTPS. An unsupported encoder produces an actionable error and leaves still exports available. MP4 always uses the selected opaque background. The transparent checkbox applies to SVG and PNG only.

SVG remains editable vector artwork; PNG is 1600 × 1600. Both save the current timeline frame with the same two colours and framing as the preview. Antialiasing and H.264 compression naturally produce blended edge pixels; the artwork uses only the chosen foreground and background, without additional decorative colours.

Framing is shared across studies. Horizontal and vertical positions are percentages of the square output width/height. Drag the preview to move, scroll to zoom, or use the labelled sliders; Reset framing returns to 100% zoom and the centred composition. All formats crop at the square output boundary.

## Approved version

`saved/2026-10-29-approved-before-export-controls/` preserves the complete browser runtime before these additions. Existing saved presets, archived versions and reference films remain in place.

## Smoother contours and canvas feedback — 29 October 2026

Source coral now uses uniform arc-length samples, Gaussian fairing in artboard units, and periodic cubic curves, instead of retaining every second/third grid vertex. `contour-curves.js` removes the small grid bumps before any output is rendered; its scale is independent of zoom and export resolution. The square region is protected, including the original exact square frame at time zero. The same path geometry is used by live preview, editable SVG, PNG and MP4. Supplied vector artwork and the folded/generated growth models retain their existing geometry.

Preview backing resolution follows display density (up to 2240 pixels). PNG renders at 3200 pixels before downsampling to 1600; movie frames render at 2160 pixels before downsampling to 1080, with H.264 target bitrate 24 Mbps. This reduces raster stair steps and video shimmer without blurring the shape geometry.

Both colour controls provide native keyboard-operable radio swatches, colour names, hex labels and visible selection states. Dragging shows alignment guides, the moved origin and live horizontal/vertical offsets, with centre snapping near zero. Position sliders and Reset framing update the same feedback. The initial hint fades after six seconds; guides fade after movement ends. These are DOM overlays and never enter the canvas or any export.

The immediately preceding complete app runtime is preserved in `saved/2026-10-29-before-contour-smoothing/`. Matched before/after details, a high-zoom MP4 and verification evidence are in the parent project's `output/canopy-export-verification/smoothing/` folder.

## 2K / 4K square video

Choose **MP4 size** beside Save MP4: 1080 × 1080 (default), 2048 × 2048, or 4096 × 4096. Every size retains 60 fps and captures the same selected pattern, controls, palette, framing and growth duration. Filenames and progress include exact dimensions. SVG remains resolution-independent; PNG remains 1600 × 1600.

Before rendering, the app checks the exact size/rate with WebCodecs and encodes a real probe frame. H.264 levels are selected per resolution; HEVC is tried when the requested H.264 size is unavailable. A failed capability check explains the requested size and offers smaller-size/browser alternatives. It never silently reduces size or frame rate. HEVC MP4 playback requires a compatible player.

Bitrate targets scale from 24 Mbps at 1080 to 48 Mbps at 2K and 80 Mbps at 4K. The encoding queue shrinks with frame size, cancellation closes an active encoder (including capability probing), and drawing surfaces are capped at 4096 × 4096. Smaller outputs retain 2× supersampling; 4K draws the vector paths at native resolution without an 8192-pixel intermediate buffer. Higher sizes take longer and produce larger files.

## Preview / movie consistency regression

The encoder capability probe previously left a framing transform on the output canvas. When a supersampled frame was copied onto it, the transform was applied a second time and the probe square was not fully cleared. This affected 1080/2K exports even though the files had valid dimensions, frame counts and playback. Artwork drawing now restores the caller's canvas state; movie resizing explicitly resets to pixel coordinates and clears the entire destination before each copy.

`tests/export-consistency.cjs` runs a real Chrome export, decodes selected MP4 frames with ffmpeg, and compares their artwork against the visible preview and downloaded SVG/PNG at exactly the same normalized growth positions. It checks early, middle and final frames at 240% zoom with off-centre framing. It also checks metadata, foreground geometry coverage, colour error, and renderer state isolation. The test is designed to reject the actual double-transform failure, rather than merely accept a playable file.

Start the local server, install/provide `playwright` and `sharp` for Node, and make `ffmpeg` / `ffprobe` available on PATH:

```sh
node tests/export-consistency.cjs
# A single output size, with artifacts in a chosen folder:
node tests/export-consistency.cjs --sizes=1080 --out=/tmp/canopy-export-check
# Confirm a supplied broken 12-second movie is detected:
node tests/export-consistency.cjs --sizes=1080 --existing=/absolute/path/to/movie.mp4 --expect-mismatch
```

The full regression creates 12-second exports at all three sizes. Browser codec support is required; an unavailable size fails with the app's actual error. Prior to this fix the complete tracked app was preserved in `saved/2026-10-29-before-export-transform-fix/app-before-fix.zip` and Git revision `e1a7f87`.

## Publish to Handover Page

Package the finished static app with content-hashed filenames:

```sh
python3 package-static.py /tmp/canopy-handover.zip
```

Upload that ZIP through the existing Handover project. Asset URLs remain relative, including worker imports. The packager checks that all referenced files exist and writes a SHA-256 manifest beside the ZIP. Hashes change with file contents and rewritten dependencies, so long-lived CDN caches cannot reuse an older renderer or exporter under the same filename. Query-string versions alone are insufficient for this host. The local app and its source filenames remain unchanged.
