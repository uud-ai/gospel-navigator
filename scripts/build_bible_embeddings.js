// =====================================================================
// build_bible_embeddings.js — пересчёт эмбеддингов для bible.json
// (весь Новый Завет, 27 книг).
//
// Запуск:   PROXY_API_KEY=xxx node scripts/build_bible_embeddings.js
// Результат: data/bible_embeddings.bin — сырые float32 подряд (512 на стих),
//            без JSON-обёртки (см. embeddings_lib.js — почему). Порядок —
//            как в bible.json (индекс = индекс стиха).
// =====================================================================

const fs = require('fs');
const path = require('path');
const { buildEmbeddings } = require('./embeddings_lib');

const inputPath = path.join(__dirname, '..', 'data', 'bible.json');
const outputPath = path.join(__dirname, '..', 'data', 'bible_embeddings.bin');

const verses = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Эмбеддим чистый текст стиха — так же, как запрос пользователя
// отправляется без ссылки на книгу/главу (см. worker.js: embedText(lastUser.content)).
const texts = verses.map(v => v.text);

buildEmbeddings(texts, outputPath, 'стихов').catch(err => {
    console.error('Фатальная ошибка:', err);
    process.exit(1);
});
