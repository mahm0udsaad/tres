import { writeFileSync } from "node:fs";

// Seamless retro wave pattern (matches the brand sheet): horizontal sine bands
// cycling maroon → blue → sand → cream. Tiles seamlessly on both axes.
const lambda = 260;          // wavelength (horizontal tile width)
const A = 46;                // amplitude
const dy = 38;               // band thickness
const colors = ["#6e1d33", "#9fbdd8", "#d9c6ad", "#f5efe3"];
const cycle = colors.length * dy;   // vertical repeat height
const reps = 3;                     // vertical repeats inside the tile
const W = lambda;
const H = cycle * reps;
const STEP = 6;

const yAt = (x, base) => base + A * Math.sin((2 * Math.PI * x) / lambda);

function bandPath(base) {
  // closed band between sine(base) on top and sine(base+dy) on bottom
  let top = `M 0 ${yAt(0, base).toFixed(2)}`;
  for (let x = STEP; x <= W; x += STEP) top += ` L ${x} ${yAt(x, base).toFixed(2)}`;
  let bot = "";
  for (let x = W; x >= 0; x -= STEP) bot += ` L ${x} ${yAt(x, base + dy).toFixed(2)}`;
  return `${top}${bot} Z`;
}

let paths = "";
// draw from above the tile to below so edges wrap cleanly
for (let base = -cycle; base < H + cycle; base += dy) {
  const idx = Math.round((base + cycle * 4) / dy) % colors.length;
  paths += `<path d="${bandPath(base)}" fill="${colors[idx]}"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  + `<defs><clipPath id="c"><rect width="${W}" height="${H}"/></clipPath></defs>`
  + `<g clip-path="url(#c)">${paths}</g></svg>`;

writeFileSync("public/assets/summer/waves.svg", svg);
console.log("waves.svg", W + "x" + H, (svg.length / 1024).toFixed(1) + "kb");
