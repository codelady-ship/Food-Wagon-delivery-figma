// Food Wagon hero mascot: an original courier bear, drawn here as SVG and rendered with sharp to
//   character.webp         the still, 1200 x 1500, transparent, looking straight ahead
//   character-sprite.webp  FRAMES frames side by side (each 800 x 1000), gaze far left -> far right
// Usage (from the repo root; sharp is not a dependency of the site, install it only for this):
//   npm install --no-save sharp
//   node tools/hero-mascot.cjs [outDir=frontend/public/hero] [frames=9] [previewDir]
// previewDir (optional) also gets mascot.svg and preview.png (left / centre / right on the hero colours).
// If the frame count changes, set SPRITE.frames in frontend/src/components/site/hero.tsx to the same number.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const W = 1200, H = 1500; // still image; the hero reserves this 4:5 box
const FW = 800, FH = 1000; // one sprite frame: the stage is at most 400 CSS px wide, so this is sharp at 2x
const C = {
  fur: "#FFF4E0", furShade: "#F3DDB8", furDeep: "#E4C594", inner: "#F6B78E",
  ink: "#3A1D0E", cap: "#F17228", capDark: "#C9531A", capLight: "#FF9A4D",
  yellow: "#FFB30E", bag: "#2B1810", bagTop: "#44281A", cream: "#FFF8E6", blush: "#F6A07C",
};

// Placement inside the 4:5 box, which the hero lays out exactly as it did for the previous image:
// - the headline's last line reaches about 11.5% into the top of the box (y = 172 at the widest layout) and the idle
//   float lifts the character by up to 10 CSS px, so the cap starts at y = 231 (TOP minus the rim) and stays clear of the letters at the top of the float;
// - the search card overlaps the lowest 17.5-19% of the box (below y = 1215), so the whole bag ends above that
//   line (y = 1196) and the card only hides plain jacket. The body is drawn far past the bottom edge so the cut
//   is never visible.
const TOP = 240, SCALE = 0.84;
// Cream rim around the silhouette: keeps the orange cap and jacket apart from the orange side of the backdrop.
const RIM = 9;

function svg(g) {
  // g: gaze, -1 (far left) .. 1 (far right). Only the head moves; body, bag and paws are identical in every
  // frame, so nothing below the scarf can jump when the frame changes.
  const face = 30 * g, pupil = 15 * g, ear = -12 * g, capS = 18 * g, tilt = 2.2 * g;
  const cx = 600;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="fur" cx="42%" cy="32%" r="78%"><stop offset="0" stop-color="#FFFBF0"/><stop offset="0.62" stop-color="${C.fur}"/><stop offset="1" stop-color="${C.furShade}"/></radialGradient>
    <linearGradient id="jacket" gradientUnits="userSpaceOnUse" x1="0" y1="1000" x2="0" y2="1500"><stop offset="0" stop-color="${C.capLight}"/><stop offset="0.45" stop-color="${C.cap}"/><stop offset="1" stop-color="${C.capDark}"/></linearGradient>
    <linearGradient id="capG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.capLight}"/><stop offset="1" stop-color="${C.cap}"/></linearGradient>
    <linearGradient id="bagG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bagTop}"/><stop offset="1" stop-color="${C.bag}"/></linearGradient>
    <clipPath id="bodyClip"><path d="M312 1900 L312 1500 C300 1210 372 1000 600 1000 C828 1000 900 1210 888 1500 L888 1900 Z"/></clipPath>
    <filter id="rim" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${RIM}" result="fat"/>
      <feFlood flood-color="${C.cream}"/>
      <feComposite in2="fat" operator="in" result="rimColour"/>
      <feMerge><feMergeNode in="rimColour"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <g ${RIM ? 'filter="url(#rim)"' : ""}>
  <g transform="translate(600 ${TOP}) scale(${SCALE}) translate(-600 -232)">
  <!-- body -->
  <g>
    <path d="M312 1900 L312 1500 C300 1210 372 1000 600 1000 C828 1000 900 1210 888 1500 L888 1900 Z" fill="url(#jacket)"/>
    <g clip-path="url(#bodyClip)">
      <path d="M300 1900 L300 1500 C300 1300 330 1150 400 1060 C380 1200 384 1360 400 1500 L400 1900 Z" fill="${C.capDark}" opacity="0.35"/>
      <!-- zip line -->
      <path d="M600 1040 L600 1900" stroke="${C.capDark}" stroke-width="8" opacity="0.55"/>
    </g>
    <!-- scarf -->
    <path d="M430 1010 C500 1075 700 1075 770 1010 C790 1040 780 1078 752 1096 C680 1140 520 1140 448 1096 C420 1078 410 1040 430 1010 Z" fill="${C.yellow}"/>
    <path d="M448 1096 C520 1140 680 1140 752 1096" fill="none" stroke="#D98E00" stroke-width="7" stroke-linecap="round" opacity="0.6"/>

    <!-- delivery bag held in front -->
    <g>
      <rect x="430" y="1130" width="340" height="240" rx="42" fill="url(#bagG)"/>
      <rect x="430" y="1130" width="340" height="84" rx="42" fill="${C.bagTop}"/>
      <rect x="430" y="1172" width="340" height="42" fill="${C.bagTop}"/>
      <path d="M430 1214 H770" stroke="#1B0E08" stroke-width="6" opacity="0.6"/>
      <!-- handle -->
      <path d="M532 1134 C532 1082 668 1082 668 1134" fill="none" stroke="${C.bag}" stroke-width="20" stroke-linecap="round"/>
      <!-- reflective strip -->
      <rect x="460" y="1186" width="280" height="11" rx="5.5" fill="${C.yellow}" opacity="0.9"/>
      <!-- badge: little dome -->
      <g transform="translate(600 1292)">
        <circle r="54" fill="${C.cap}"/>
        <path d="M-34 11 C-34 -21 34 -21 34 11 Z" fill="${C.cream}"/>
        <rect x="-43" y="13" width="86" height="12" rx="6" fill="${C.cream}"/>
        <circle cy="-23" r="7" fill="${C.cream}"/>
      </g>
    </g>

    <!-- paws on the bag, sleeves over the paws -->
    <g>
      <ellipse cx="416" cy="1246" rx="66" ry="72" fill="url(#fur)"/>
      <ellipse cx="784" cy="1246" rx="66" ry="72" fill="url(#fur)"/>
      <path d="M386 1272 q10 16 22 0 M418 1280 q10 16 22 0" fill="none" stroke="${C.furDeep}" stroke-width="7" stroke-linecap="round"/>
      <path d="M760 1280 q10 16 22 0 M792 1272 q10 16 22 0" fill="none" stroke="${C.furDeep}" stroke-width="7" stroke-linecap="round"/>
      <path transform="translate(12 -44)" d="M318 1180 C300 1230 318 1262 352 1250 C392 1238 420 1210 410 1160 C380 1130 336 1140 318 1180 Z" fill="${C.cap}"/>
      <path transform="translate(-12 -44)" d="M882 1180 C900 1230 882 1262 848 1250 C808 1238 780 1210 790 1160 C820 1130 864 1140 882 1180 Z" fill="${C.cap}"/>
    </g>
  </g>

  <!-- head -->
  <g transform="rotate(${tilt} ${cx} 900)">
    <!-- ears (move opposite to the face) -->
    <g transform="translate(${ear} 0)">
      <circle cx="352" cy="430" r="112" fill="url(#fur)"/>
      <circle cx="352" cy="438" r="62" fill="${C.inner}"/>
      <circle cx="848" cy="430" r="112" fill="url(#fur)"/>
      <circle cx="848" cy="438" r="62" fill="${C.inner}"/>
    </g>
    <!-- skull -->
    <ellipse cx="${cx}" cy="690" rx="356" ry="330" fill="url(#fur)"/>

    <!-- cap -->
    <g transform="translate(${capS * 0.5} 0)">
      <path d="M300 520 C300 330 430 250 600 250 C770 250 900 330 900 520 C800 470 400 470 300 520 Z" fill="url(#capG)"/>
      <path d="M300 520 C400 470 800 470 900 520 C900 540 896 556 890 570 C790 520 410 520 310 570 C304 556 300 540 300 520 Z" fill="${C.capDark}"/>
      <!-- brim, pushed toward the gaze -->
      <path transform="translate(${capS} 0)" d="M360 548 C440 512 760 512 840 548 C900 580 870 640 800 628 C700 606 500 606 400 628 C330 640 300 580 360 548 Z" fill="${C.cap}"/>
      <path transform="translate(${capS} 0)" d="M400 628 C500 606 700 606 800 628" fill="none" stroke="${C.capDark}" stroke-width="10" stroke-linecap="round" opacity="0.7"/>
      <!-- cap badge -->
      <g transform="translate(${capS * 0.8} 0)">
        <circle cx="600" cy="392" r="66" fill="${C.cream}"/>
        <path d="M560 408 C560 366 640 366 640 408 Z" fill="${C.cap}"/>
        <rect x="548" y="410" width="104" height="14" rx="7" fill="${C.cap}"/>
        <circle cx="600" cy="366" r="8" fill="${C.cap}"/>
      </g>
      <circle cx="600" cy="252" r="20" fill="${C.capDark}"/>
    </g>

    <!-- face -->
    <g transform="translate(${face} 0)">
      <!-- brows -->
      <path d="M430 660 q44 -30 88 -6" fill="none" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/>
      <path d="M682 654 q44 -24 88 6" fill="none" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/>
      <!-- eyes -->
      <ellipse cx="476" cy="742" rx="52" ry="58" fill="#FFFFFF"/>
      <ellipse cx="724" cy="742" rx="52" ry="58" fill="#FFFFFF"/>
      <g transform="translate(${pupil} 0)">
        <ellipse cx="478" cy="748" rx="33" ry="38" fill="${C.ink}"/>
        <ellipse cx="722" cy="748" rx="33" ry="38" fill="${C.ink}"/>
        <circle cx="490" cy="732" r="12" fill="#FFFFFF"/>
        <circle cx="734" cy="732" r="12" fill="#FFFFFF"/>
        <circle cx="468" cy="762" r="5" fill="#FFFFFF" opacity="0.8"/>
        <circle cx="712" cy="762" r="5" fill="#FFFFFF" opacity="0.8"/>
      </g>
      <!-- blush -->
      <ellipse cx="392" cy="842" rx="50" ry="30" fill="${C.blush}" opacity="0.55"/>
      <ellipse cx="808" cy="842" rx="50" ry="30" fill="${C.blush}" opacity="0.55"/>
      <!-- muzzle -->
      <g transform="translate(${face * 0.35} 0)">
        <ellipse cx="600" cy="862" rx="136" ry="104" fill="#FFFDF7"/>
        <path d="M556 806 C556 780 644 780 644 806 C644 836 616 852 600 852 C584 852 556 836 556 806 Z" fill="${C.ink}"/>
        <ellipse cx="584" cy="800" rx="14" ry="7" fill="#FFFFFF" opacity="0.35"/>
        <path d="M600 852 V878" stroke="${C.ink}" stroke-width="10" stroke-linecap="round"/>
        <path d="M540 880 C560 918 590 912 600 878 C610 912 640 918 660 880" fill="none" stroke="${C.ink}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M576 912 C586 940 614 940 624 912 Z" fill="#E8674A"/>
      </g>
    </g>
  </g>
  </g>
  </g>
</svg>`;
}

(async () => {
  const out = process.argv[2] || path.join(__dirname, "..", "frontend", "public", "hero");
  const frames = Number(process.argv[3] || 9);
  const previewDir = process.argv[4];
  if (!(frames >= 3 && frames % 2 === 1)) throw new Error("frames must be an odd number >= 3, so the middle frame is the still");
  if (FW * frames > 16383) throw new Error("sprite sheet would be wider than WebP allows (16383 px)");
  fs.mkdirSync(out, { recursive: true });

  await sharp(Buffer.from(svg(0))).webp({ quality: 88, alphaQuality: 90, effort: 6 }).toFile(path.join(out, "character.webp"));

  const tiles = [];
  for (let i = 0; i < frames; i++) {
    const g = (i / (frames - 1)) * 2 - 1;
    tiles.push({ input: await sharp(Buffer.from(svg(g))).resize(FW, FH).png().toBuffer(), left: i * FW, top: 0 });
  }
  await sharp({ create: { width: FW * frames, height: FH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles).webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(path.join(out, "character-sprite.webp"));

  for (const f of ["character.webp", "character-sprite.webp"]) console.log(f, fs.statSync(path.join(out, f)).size, "bytes");

  if (previewDir) {
    fs.mkdirSync(previewDir, { recursive: true });
    fs.writeFileSync(path.join(previewDir, "mascot.svg"), svg(0));
    const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW * 3}" height="${FH}"><defs><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#3b1c0e"/><stop offset="0.5" stop-color="#9a4314"/><stop offset="1" stop-color="#f17228"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#b)"/></svg>`;
    const pick = [0, (frames - 1) / 2, frames - 1];
    await sharp(Buffer.from(bg)).composite(pick.map((f, k) => ({ input: tiles[f].input, left: k * FW, top: 0 }))).png().toFile(path.join(previewDir, "preview.png"));
  }
})();
