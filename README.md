# PawCream

Interactive illustrated PawCream website prototype built with React, TypeScript, Vite, and p5.js.

## Online preview

GitHub Pages target: `https://joooo123.github.io/PawCream/`

Every push to `main` triggers `.github/workflows/deploy-pages.yml`, builds the Vite app, and deploys `dist/` to GitHub Pages.

## Current Home interaction

- Hand-drawn PawCream Home artwork
- Hover/touch wake state
- p5.js chimney star particles
- Wreath/composite star excluded
- Stars spawn tiny, grow along their path, drift toward the upper-right, and cap at three simultaneous particles
- PawCream ECG reveal when entering the house
