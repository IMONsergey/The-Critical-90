import { cp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const revision = process.env.GITHUB_SHA || 'local';
const version = revision.slice(0, 12);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
await cp(path.join(root, 'src'), output, { recursive: true });
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace('</head>', `  <meta name="build-revision" content="${revision}">\n</head>`);
html = html.replace(/((?:src|href)="\.\/[^"?#]+)(?=")/g, `$1?v=${version}`);
await writeFile(path.join(output, 'index.html'), html);
// Version local module/CSS imports too, so a new page cannot load an older cached layer.
for (const name of await readdir(output)) {
  const file = path.join(output, name);
  if (name.endsWith('.js')) {
    const source = await readFile(file, 'utf8');
    await writeFile(file, source.replace(/(from\s+['"]\.\/[^'"?]+\.js)(['"])/g, `$1?v=${version}$2`));
  } else if (name.endsWith('.css')) {
    const source = await readFile(file, 'utf8');
    await writeFile(file, source.replace(/(@import\s+url\(['"]\.\/[^'"?]+\.css)(['"])/g, `$1?v=${version}$2`));
  }
}
await writeFile(path.join(output, '.nojekyll'), '');
await writeFile(path.join(output, 'build.json'), JSON.stringify({ revision, builtAt: new Date().toISOString() }, null, 2));
const references = [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)/g)].map(match => match[1]);
const unique = [...new Set(references)];
for (const reference of unique) {
  try { await readFile(path.join(output, reference)); }
  catch { throw new Error(`Missing local asset: ${reference}`); }
}
await rm(path.join(output, 'assets/font-reference.txt'), { force: true });
await rm(path.join(output, 'assets/manifest.json'), { force: true });
console.log(`Built ${revision}. Verified ${unique.length} local file references.`);
