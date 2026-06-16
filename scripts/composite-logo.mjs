import sharp from 'sharp';
// args: base logo size cx cy out [blend] [opacity]
const [,, base, logo, sizeS, cxS, cyS, out, blend='over', opacityS='1'] = process.argv;
const size = +sizeS, cx = +cxS, cy = +cyS, opacity = +opacityS;
const logoBuf = await sharp(logo).resize(size, size, { fit: 'inside' }).ensureAlpha();
let lb = await logoBuf.toBuffer();
if (opacity < 1) {
  lb = await sharp(lb).ensureAlpha().composite([{ input: Buffer.from([255,255,255, Math.round(255*opacity)]), raw:{width:1,height:1,channels:4}, tile:true, blend:'dest-in' }]).toBuffer();
}
const meta = await sharp(lb).metadata();
const left = Math.round(cx - meta.width/2), top = Math.round(cy - meta.height/2);
await sharp(base).composite([{ input: lb, left, top, blend }]).png().toFile(out);
console.log('composited at', left, top, 'size', meta.width+'x'+meta.height, 'blend', blend);
