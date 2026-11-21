# Credits

Food Wagon is a portfolio / demo project. Restaurants, chefs, prices, ratings and reviews are invented sample data.

## Design

- Original layout idea: the free **"Food Wagon" Figma community design** (orange and yellow food delivery landing page).
- Redesign (2026): layout, type scale, mono labels, easing and the pointer-driven hero are inspired by the
  [Thinking Gods "Turn images into interactive heroes" tutorial](https://thinkingods.com/prompt-interactive-heroes.html).
  No text, logos, images or code were copied; the reference colours were recoloured into Food Wagon's own palette
  (orange `#F17228`, yellow `#FFB30E`, cream `#FEFAF1`, ink `#212121`).
- "Most loved" orbit menu: `DishOrbitCarousel` component supplied by the site owner (21st.dev style React component),
  adapted for Food Wagon (palette, data from the API, no scroll looping, reduced-motion list, larger touch targets).

## Fonts (Google Fonts, SIL Open Font License 1.1)

- [Outfit](https://fonts.google.com/specimen/Outfit) – display type
- [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) – body text
- [Space Mono](https://fonts.google.com/specimen/Space+Mono) – labels

## Photos ([Unsplash License](https://unsplash.com/license): free to use, no permission needed)

- Restaurant and dish photos in `frontend/public/images/*.webp` (pizza, pasta, burger, ramen, sushi, salad, bowls,
  chicken, skewers, meatballs, pancakes, brownie, juice and the four restaurant interiors) come from Unsplash and were
  resized and compressed to WebP for the original Food Wagon page.
- Plated dishes added in 2026 (downloaded from `images.unsplash.com`, cropped and converted to WebP):
  - `steak-frites.webp` – photo-1659881981676-33ab127152c0
  - `salmon-salad.webp` – photo-1667657682263-86e924b34fd9
  - `sea-bass.webp` – photo-1685079258536-06d8253e862c
  - `sunny-side-up.webp` – photo-1691480184494-d9f822edd4d1
- `frontend/public/images/cutouts/*.webp` are circular, transparent crops of the plates above and of `ramen.webp` /
  `salad.webp`, made for the orbit menu.

## Hero character

- The courier bear (cream fur, orange cap and jacket with the dome badge, dark delivery bag) is an original drawing
  made for this project. It is written as SVG in `tools/hero-mascot.cjs` and rendered with
  [sharp](https://sharp.pixelplumbing.com/) (Apache-2.0); no third-party artwork is used.
- `frontend/public/hero/character.webp` – the still: 1200 × 1500 px, transparent, looking straight ahead. It is the
  image in the static copy of the hero in `frontend/index.html` (first paint, no JavaScript) and the only image on
  touch-only screens and under `prefers-reduced-motion`.
- `frontend/public/hero/character-sprite.webp` – 9 frames side by side (800 × 1000 px each), gaze from far left to
  far right, middle frame identical to the still. `SPRITE.frames` in `frontend/src/components/site/hero.tsx` must
  match the frame count.
- To redraw or re-render: `npm install --no-save sharp`, then `node tools/hero-mascot.cjs` from the repo root (it
  writes both files into `frontend/public/hero/`). If the alt text changes, change `CHARACTER.alt` and the static
  copy in `frontend/index.html` together.
- `frontend/public/og-image.jpg` – social preview (1200 × 630), a screenshot of the hero with the bear.

## Code libraries

React, Vite, Tailwind CSS, GSAP (ScrollTrigger), clsx, tailwind-merge, Express, Mongoose, Zod, Helmet,
express-rate-limit, bcryptjs, jsonwebtoken, multer, cors, dotenv; tests with node:test, supertest and
mongodb-memory-server. All MIT, ISC, Apache-2.0 or BSD licensed (GSAP: standard "no charge" GSAP license).
