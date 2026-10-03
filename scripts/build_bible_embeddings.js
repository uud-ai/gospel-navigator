// =====================================================================
// build_bible_embeddings.js — пересчёт эмбеддингов для bible.json
// (весь Новый Завет, 27 книг). Старый bible_embeddings.json устарел —
// считался под версию bible.json, где были только 4 Евангелия и
// пропущенные стихи в 11 главах (см. корневой README).
//
// Запуск:   PROXY_API_KEY=xxx node scripts/build_bible_embeddings.js
// Результат: data/bible_embeddings.json — массив векторов размером
//            bible.length, в том же порядке (индекс = индекс в bible.json).
//
// Параметры модели должны совпадать с backend/worker.js:
//   model: text-embedding-3-small, dimensions: 512.
// =====================================================================

const fs = require('fs');
const path = require('path');

const PROXY_API_KEY = process.env.PROXY_API_KEY;
if (!PROXY_API_KEY) {
    console.error('Задай переменную окружения PROXY_API_KEY перед запуском.');
    process.exit(1);
}

const PROXY_BASE_URL = 'https://api.proxyapi.ru/openai/v1';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 512;

const BATCH_SIZE = 64;
const BATCH_DELAY_MS = 300;

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function getEmbeddingsBatch(texts) {
    const res = await fetch(`${PROXY_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PROXY_API_KEY}`
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: texts,
            dimensions: EMBEDDING_DIMS
        })
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`embeddings API ${res.status}: ${errText.substring(0, 200)}`);
    }
    const data = await res.json();
    return data.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding);
}

async function main() {
    const inputPath = path.join(__dirname, '..', 'data', 'bible.json');
    const outputPath = path.join(__dirname, '..', 'data', 'bible_embeddings.json');

    const verses = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`Стихов: ${verses.length}`);

    // Эмбеддим чистый текст стиха — так же, как запрос пользователя
    // отправляется без ссылки на книгу/главу (см. worker.js: embedText(lastUser.content)).
    const texts = verses.map(v => v.text);

    const embeddings = new Array(verses.length);
    const startedAt = Date.now();

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        process.stdout.write(`  батч ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(texts.length / BATCH_SIZE)}... `);
        try {
            const batchEmbeddings = await getEmbeddingsBatch(batch);
            for (let j = 0; j < batchEmbeddings.length; j++) {
                embeddings[i + j] = batchEmbeddings[j];
            }
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
            console.log(`ok (${elapsed}s суммарно)`);
        } catch (err) {
            console.log(`ОШИБКА: ${err.message}`);
            for (let j = 0; j < batch.length; j++) embeddings[i + j] = null;
        }
        await sleep(BATCH_DELAY_MS);
    }

    fs.writeFileSync(outputPath, JSON.stringify(embeddings), 'utf8');

    const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    const nulls = embeddings.filter(e => e === null).length;
    console.log(`\nЗаписано: ${outputPath} (${sizeMb} МБ)`);
    if (nulls > 0) console.log(`Внимание: ${nulls} стихов без эмбеддингов (упал API). Запусти повторно — батчи дешёвые.`);
    console.log(`Готово за ${((Date.now() - startedAt) / 1000).toFixed(1)} сек.`);
}

main().catch(err => {
    console.error('Фатальная ошибка:', err);
    process.exit(1);
});
