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

## Placeholders still to replace

- `frontend/public/hero/character.webp` – clearly marked placeholder for the hero character
  (1200 × 1500 px, transparent WebP). Optional: `frontend/public/hero/character-sprite.webp`, a horizontal sprite
  sheet of the animated character (frames side by side, gaze from far left to far right); set `SPRITE.frames` in
  `frontend/src/components/site/hero.tsx` to the frame count to switch the hero to frame scrubbing.
- `frontend/public/og-image.jpg` – social preview made from the hero; take a new one after the real character is in.

## Code libraries

React, Vite, Tailwind CSS, GSAP (ScrollTrigger), clsx, tailwind-merge, Express, Mongoose, Zod, Helmet,
express-rate-limit, bcryptjs, jsonwebtoken, multer, cors, dotenv; tests with node:test, supertest and
mongodb-memory-server. All MIT, ISC, Apache-2.0 or BSD licensed (GSAP: standard "no charge" GSAP license).
