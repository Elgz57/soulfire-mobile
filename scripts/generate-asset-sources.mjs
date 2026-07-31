/**
 * Builds the source images that @capacitor/assets expands into Android and iOS
 * icon/splash sets.
 *
 * The layers are recomposed from public/logo.svg rather than rasterising it
 * whole: that file draws its own rounded-rect tile, which would appear as a
 * square-inside-a-square once a launcher applies its own icon mask, and would
 * show up as a stray card in the middle of an adaptive icon's safe zone.
 * Redrawing from the flame path and the background gradient gives a full-bleed
 * icon and a transparent adaptive foreground.
 *
 * Run via: pnpm generate-assets
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "assets");

// Copied from public/logo.svg so the mobile icon cannot drift from the logo.
const BG_FROM = "#2a2d3e";
const BG_TO = "#1c1e2a";
const FLAME_FROM = "#00F3FF";
const FLAME_TO = "#33f2f5";
const FLAME_PATH =
  "M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 " +
  "7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534 " +
  "a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172 " +
  "c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 " +
  "3.75 3.75 0 0 1 3.255 3.718Z";

/** Solid dark used behind the splash; the darker stop of the logo gradient. */
const SPLASH_DARK = BG_TO;
const SPLASH_LIGHT = "#ffffff";

const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;

const gradientDefs = `
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BG_FROM}"/>
      <stop offset="100%" stop-color="${BG_TO}"/>
    </linearGradient>
    <linearGradient id="flame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="33%" stop-color="${FLAME_FROM}"/>
      <stop offset="66%" stop-color="${FLAME_TO}"/>
    </linearGradient>`;

/** The flame path scaled to `size` and centred on a `canvas`-sized square. */
function flameLayer(canvas, size) {
  const offset = (canvas - size) / 2;
  const scale = size / 24;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">
      <path fill-rule="evenodd" clip-rule="evenodd" fill="url(#flame)" d="${FLAME_PATH}"/>
    </g>`;
}

function svg(canvas, body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
    <defs>${gradientDefs}</defs>
    ${body}
  </svg>`,
  );
}

function render(canvas, body) {
  return sharp(svg(canvas, body)).png().toBuffer();
}

const fullBleedBackground = `<rect width="100%" height="100%" fill="url(#bg)"/>`;

const files = {
  // Full bleed: every launcher and the App Store apply their own corner mask,
  // so the source must not be pre-rounded.
  "icon.png": await render(
    ICON_SIZE,
    `${fullBleedBackground}${flameLayer(ICON_SIZE, ICON_SIZE * 0.58)}`,
  ),
  // Android crops adaptive icons to a circle/squircle and only guarantees the
  // middle ~66%; at 44% the flame clears that safe zone on every mask shape.
  "icon-foreground.png": await render(
    ICON_SIZE,
    flameLayer(ICON_SIZE, ICON_SIZE * 0.44),
  ),
  "icon-background.png": await render(ICON_SIZE, fullBleedBackground),
  "splash.png": await render(
    SPLASH_SIZE,
    `<rect width="100%" height="100%" fill="${SPLASH_LIGHT}"/>${flameLayer(SPLASH_SIZE, SPLASH_SIZE * 0.2)}`,
  ),
  "splash-dark.png": await render(
    SPLASH_SIZE,
    `<rect width="100%" height="100%" fill="${SPLASH_DARK}"/>${flameLayer(SPLASH_SIZE, SPLASH_SIZE * 0.2)}`,
  ),
};

await mkdir(outDir, { recursive: true });

for (const [name, buffer] of Object.entries(files)) {
  await writeFile(resolve(outDir, name), buffer);
  console.log(`wrote assets/${name}`);
}
