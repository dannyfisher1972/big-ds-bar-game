# Big D's Bar (game)

A Phaser 3 + Vite point-and-click murder mystery. Derek "Big D" Delgado, owner
of Big D's Bar for eighteen years, is found dead in his back office after the
bar's anniversary party. Seven regulars were still around when it happened,
and each one had a reason to want him gone.

## Running it
```
npm install
npm run dev
```
Then open http://localhost:5173 in your browser.

## Controls
- Click a glowing object to examine it.
- Click a person to talk to them.
- Use the arrows at the top corners to move between parts of the bar.

## What's here
Nine explorable locations, seven suspects (one method apiece, picked at
random each new investigation), a case notebook with a timeline and
deduction board, and an accusation system with up to three attempts.
Room backgrounds and character portraits live under `public/assets/ai-art/`
and are generated separately — the game degrades to labeled placeholders
if an image hasn't been added yet.

## Building for deployment
```
npm run build
```
Outputs a static site to `dist/`, ready for GitHub Pages (see
`.github/workflows/deploy.yml`).
