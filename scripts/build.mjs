import { cp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
await cp(path.join(root, 'src'), output, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(output, 'index.html'));
await writeFile(path.join(output, '.nojekyll'), '');
const html = await readFile(path.join(output, 'index.html'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map(match => match[1]);
const unique = [...new Set(references)];
for (const reference of unique) {
  try { await readFile(path.join(output, reference)); }
  catch { throw new Error(`Missing local asset: ${reference}`); }
}
await rm(path.join(output, 'assets/font-reference.txt'), { force: true });
await rm(path.join(output, 'assets/manifest.json'), { force: true });
console.log(`Built static website. Verified ${unique.length} local file references.`);
