// Публикация сайта в Yandex Object Storage: собирает лендинг + приложение
// (npm run build) и загружает landing/dist в бакет vmestefamily.site.
// Нужен установленный и авторизованный `yc` (профиль с доступом к каталогу).
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUCKET = 'vmestefamily.site';
const dist = fileURLToPath(new URL('../dist', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

for (const file of walk(dist)) {
  const key = relative(dist, file).split('\\').join('/');
  // CNAME нужен был GitHub Pages; в бакете он не используется.
  if (key === 'CNAME') continue;
  execFileSync('yc', [
    'storage', 's3api', 'put-object',
    '--bucket', BUCKET,
    '--key', key,
    '--body', file,
    '--content-type', TYPES[extname(file)] ?? 'application/octet-stream',
  ], { stdio: 'ignore' });
  console.log('uploaded', key);
}
