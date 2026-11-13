// Build: src/ -> dist/ (or --out <dir>). Optional --ca <address> flips the CA record to "stated".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const out = path.resolve(root, arg('--out') || 'dist');
const caArg = arg('--ca');
if (!out.startsWith(root) && !out.includes('scratchpad')) throw new Error('refusing to write outside project: ' + out);

const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const fail = (m) => { console.error('BUILD FAIL:', m); process.exit(1); };

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

// ---- static copy
const copyDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } };
copyDir(path.join(root, 'src', 'css'), path.join(out, 'css'));
copyDir(path.join(root, 'src', 'js'), path.join(out, 'js'));

// ---- theme colour from tokens (single literal source)
const tokens = fs.readFileSync(path.join(root, 'src/css/tokens.css'), 'utf8');
const bg = tokens.match(/--bg:\s*(#[0-9a-f]{6})/i)?.[1];
if (!bg) fail('--bg not found in tokens.css');
fs.writeFileSync(path.join(out, 'index.html'), fs.readFileSync(path.join(root, 'src/index.html'), 'utf8').replace('%BG%', bg));

// ---- CA override for proving the stated branch
if (caArg) {
  const p = path.join(out, 'js/register-data.js');
  const s = fs.readFileSync(p, 'utf8').replace(/ca:\s*\{[^}]*\}/, `ca:     { id: 'ca',     label: 'Contract address', state: 'stated', value: '${caArg}' }`);
  fs.writeFileSync(p, s);
}

// ---- logo pipeline: premultiplied resize (source has pure-black transparent regions)
const SRC_T = path.join(root, 'brand', 'LOGO PINPAD PNG...png');     // colourtype 6, 3,593,079 px alpha 0 + rgb 0
const SRC_O = path.join(root, 'brand', 'LOGO PINPAD PNG.png');       // opaque field, used for touch icon
if (!fs.existsSync(SRC_T) || !fs.existsSync(SRC_O)) fail('brand logo source missing');

async function premulResize(file, crop, size) {
  const { data, info } = await sharp(file).extract(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, rgb = Buffer.alloc(n * 3), a = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const al = data[i * 4 + 3]; a[i] = al;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round((data[i * 4 + c] * al) / 255);   // premultiply
  }
  const rs = (buf, ch) => sharp(buf, { raw: { width: info.width, height: info.height, channels: ch } }).resize(size, size, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer();
  const [R, A] = await Promise.all([rs(rgb, 3), rs(a, 1)]);
  const o = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const al = A[i];
    for (let c = 0; c < 3; c++) o[i * 4 + c] = al ? Math.min(255, Math.round((R[i * 3 + c] * 255) / al)) : 0;  // un-premultiply
    o[i * 4 + 3] = al;
  }
  return { buf: o, size };
}
const CROP = { left: 501, top: 500, width: 1000, height: 1000 };      // alpha bbox 517,529..1485,1470 centred
const l512 = await premulResize(SRC_T, CROP, 512);
await sharp(l512.buf, { raw: { width: 512, height: 512, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(out, 'assets/logo.png'));
const l180 = await premulResize(SRC_T, CROP, 140);
await sharp(l180.buf, { raw: { width: 140, height: 140, channels: 4 } }).extend({ top: 20, bottom: 20, left: 20, right: 20, background: bg }).flatten({ background: bg }).png().toFile(path.join(out, 'assets/apple-touch-icon.png'));

// ---- favicon: trace the real 32x32 pixel grid of the logo (merge horizontal runs of identical pixels)
const f32 = await premulResize(SRC_T, CROP, 32);
const rects = [];
for (let y = 0; y < 32; y++) {
  let x = 0;
  while (x < 32) {
    const i = (y * 32 + x) * 4, a = f32.buf[i + 3];
    if (a < 20) { x++; continue; }
    const key = (j) => `${f32.buf[j]},${f32.buf[j + 1]},${f32.buf[j + 2]},${f32.buf[j + 3]}`;
    let w = 1;
    while (x + w < 32 && key((y * 32 + x + w) * 4) === key(i)) w++;
    rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${hex(f32.buf[i], f32.buf[i + 1], f32.buf[i + 2])}"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(2)}"` : ''}/>`);
    x += w;
  }
}
fs.writeFileSync(path.join(out, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">${rects.join('')}</svg>\n`);

// ---- og image from the brand banner
await sharp(path.join(root, 'reference', 'SAMPUL PINPAD JPG.jpg.jpeg')).resize(1200, 400).jpeg({ quality: 82 }).toFile(path.join(out, 'assets/og.jpg'));

// ---- guards: logo must be in dist and referenced by a relative path that resolves
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const f of ['assets/logo.png', 'favicon.svg', 'assets/apple-touch-icon.png', 'index.html', 'css/tokens.css', 'css/main.css', 'js/main.js']) if (!fs.existsSync(path.join(out, f))) fail('missing in output: ' + f);
const refs = [...html.matchAll(/(?:src|href)="(assets\/logo\.png)"/g)];
if (!refs.length) fail('index.html does not reference assets/logo.png');
if (/(?:src|href)="\//.test(html)) fail('index.html has root-absolute path');
console.log(`build ok -> ${path.relative(root, out)} | logo refs in html: ${refs.length} | favicon rects: ${rects.length} | ca: ${caArg ? 'stated(override)' : 'per register'}`);
