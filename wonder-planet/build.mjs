import esbuild from 'esbuild';
import fs from 'fs';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const r = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'esm', minify: process.argv.includes('--min'), write: false,
  plugins: [{ name: 'cdn', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: CDN, external: true })); } }],
  target: 'es2020', logLevel: 'warning',
});
let code = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync('src/page.html', 'utf8');
const [head, body] = page.split('<!--SPLIT-->');
const inner = head + body.replace('/*__CODE__*/', () => code);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', inner);
fs.writeFileSync('dist/wonder-planet.html', '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + '</head>\n<body>\n' + body.replace('/*__CODE__*/', () => code) + '\n</body>\n</html>\n');
console.log('built', (code.length / 1024).toFixed(1) + 'KB');
