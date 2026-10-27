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
- Four reference films in `exports/`
- Worker-based generation over HTTP, with a main-thread fallback for file and sandboxed-page contexts

## Deploy with Vercel

Import this repository as a static project. Use the `Other` framework preset, leave the build and install commands empty, and set the output directory to `.`. The app uses relative asset paths and needs no build step or environment variables.

## Source files

The app's browser runtime is in the root-level JavaScript and CSS files. `source/canopyu-pattern-1.svg` is the supplied vector source; `source-data.js` contains the derived data used by the runtime. 
