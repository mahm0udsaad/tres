import sharp from 'sharp';
import { mkdirSync } from 'fs';
const OUT = new URL('../public/assets/logo/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const burg = await sharp('/tmp/tres_logo_raw-1.png').trim({ threshold: 10 }).toBuffer();
await sharp(burg).png().toFile(`${OUT}tres-mark-burgundy.png`);

const meta = await sharp(burg).metadata();
const alpha = await sharp(burg).ensureAlpha().extractChannel(3).toColourspace('b-w').toBuffer();
await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: { r: 247, g: 240, b: 234 } } })
  .joinChannel(alpha).png().toFile(`${OUT}tres-mark-white.png`);

await sharp('/tmp/tres_logo_raw-2.png').trim({ threshold: 10 }).png().toFile(`${OUT}tres-badge-grey.png`);
await sharp('/tmp/tres_logo_raw-3.png').trim({ threshold: 10 }).png().toFile(`${OUT}tres-badge-burgundy.png`);

for (const f of ['tres-mark-burgundy','tres-mark-white','tres-badge-grey','tres-badge-burgundy']) {
  const m = await sharp(`${OUT}${f}.png`).metadata();
  console.log(f, m.width + 'x' + m.height, m.channels + 'ch');
}
