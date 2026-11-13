// Builds dist/clash-of-clans-dashboard-and-planner.html: index.html with local
// CSS, JS and images inlined so the app works as one self-contained file.
// Usage: node scripts/build-single.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'clash-of-clans-dashboard-and-planner.html');
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif' };

const read = (p) => readFileSync(join(root, p), 'utf8');
const isLocal = (p) => !/^(https?:|data:|\/\/)/.test(p);

// Swap every quoted reference to a file under assets/ for a data URI.
const inlineAssets = (text) =>
  text.replace(/(["'(])(assets\/[^"')]+\.(?:webp|png|jpe?g|svg|gif))(["')])/g, (m, open, path, close) => {
    const file = join(root, path);
    if (!existsSync(file)) throw new Error(`Missing asset: ${path}`);
    const data = readFileSync(file).toString('base64');
    return `${open}data:${MIME[extname(path).toLowerCase()]};base64,${data}${close}`;
  });

let html = read('index.html');

html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (m, href) =>
  isLocal(href) ? `<style>\n${inlineAssets(read(href))}\n</style>` : m);

html = html.replace(/<script\s+src="([^"]+)"\s*><\/script>/g, (m, src) => {
  if (!isLocal(src)) return m;
  const js = inlineAssets(read(src));
  if (/<\/script/i.test(js)) throw new Error(`${src} contains "</script", which would break inlining`);
  return `<script>\n${js}\n</script>`;
});

html = inlineAssets(html);

const leftover = html.match(/(?:src|href)="(?!https?:|data:|#|\/\/|\$\{)[^"]+"/g);
if (leftover) console.warn('Warning: references still pointing at local files:', leftover);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out.slice(root.length + 1)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
