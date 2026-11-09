# PawCream phone video demo

This demo branch is based on `deploy/aliyun-oss-pawcream-studio`. It keeps that branch's application code and adds a recording stage around the real mobile app.

## Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173/?demo=1` in a desktop browser.

To open directly in the Atelier Room, use `http://localhost:5173/?demo=1&scene=atelier`.

## What runs inside the phone

- The outer page provides the white background, blue polka dots, and light-blue phone bezel.
- The phone screen is a same-origin iframe loading this branch's actual application with `device=mobile`.
- The iframe viewport is fixed at 390 × 844 CSS pixels, so mobile layout, scrolling, overlays, touch/click handling, and file selection run in the app rather than in a screenshot.
- The phone frame scales visually to fit the desktop window without changing the iframe's 390 × 844 layout viewport.

The demo wrapper is only enabled by `?demo=1`; normal app routes and behavior are unchanged.
