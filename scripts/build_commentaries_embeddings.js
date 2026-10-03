// =====================================================================
// build_commentaries_embeddings.js — пересчёт эмбеддингов для
// commentaries.json (толкования блж. Феофилакта).
//
// Запуск:   PROXY_API_KEY=xxx node scripts/build_commentaries_embeddings.js
// Результат: data/commentaries_embeddings.bin — сырые float32 подряд
//            (512 на фрагмент), без JSON-обёртки (см. embeddings_lib.js —
//            почему). Индекс вектора = индекс в commentaries.json.
// =====================================================================

const fs = require('fs');
const path = require('path');
const { buildEmbeddings } = require('./embeddings_lib');

const inputPath = path.join(__dirname, '..', 'data', 'commentaries.json');
const outputPath = path.join(__dirname, '..', 'data', 'commentaries_embeddings.bin');

if (!fs.existsSync(inputPath)) {
    console.error(`Не найден ${inputPath}. Сначала запусти build_commentaries.js.`);
    process.exit(1);
}
const commentaries = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Для эмбеддинга берём именно текст толкования, без ссылки на стих —
// запросы пользователя тоже идут без ссылок, одинаковое представление
// с обеих сторон даёт более чистое cosine similarity. Прямую привязку
// по стиху делает отдельная ветка в worker.js, не через эмбеддинги.
const texts = commentaries.map(c => c.text);

buildEmbeddings(texts, outputPath, 'фрагментов').catch(err => {
    console.error('Фатальная ошибка:', err);
    process.exit(1);
});
