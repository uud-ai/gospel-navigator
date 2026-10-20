// Складывает приложение (корень репозитория) в dist/app/, чтобы dist/ был
// готовым сайтом: лендинг на «/», чат-приложение на «/app/».
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const appDir = join(dist, 'app');

mkdirSync(appDir, { recursive: true });
for (const f of ['index.html', 'sw.js', 'topics.js', 'verses_of_day.js']) {
  cpSync(join(root, f), join(appDir, f));
}
writeFileSync(join(dist, 'CNAME'), 'vmestefamily.site\n');
console.log('assembled: dist/ (landing) + dist/app/ (chat)');
