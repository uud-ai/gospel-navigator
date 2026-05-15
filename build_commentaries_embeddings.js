// =====================================================================
// build_commentaries_embeddings.js — одноразовый скрипт пересчёта
// эмбеддингов для commentaries.json (толкования Феофилакта).
//
// Запуск:   PROXY_API_KEY=xxx node build_commentaries_embeddings.js
// Результат: commentaries_embeddings.json — массив векторов
//            размером commentaries.length, в том же порядке.
//            Соглашение «индекс в массиве = индекс в эмбеддингах» —
//            ровно как у тебя с bible.json / bible_embeddings.json.
//
// Параметры модели должны совпадать с function.js:
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

// Размер батча. OpenAI принимает до 2048 элементов на запрос, но мы
// перестраховываемся: фрагменты Феофилакта длиннее библейских стихов,
// батч поменьше — стабильнее по времени запроса и не упрёмся в лимит токенов.
const BATCH_SIZE = 64;

// Задержка между батчами — мягкий бэкофф, чтобы не словить rate limit
// от proxyapi.ru. У них квоты не настолько строгие, но всё равно вежливо.
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
    // OpenAI гарантирует тот же порядок, что и input. Сортируем по index
    // на всякий случай — это дёшево и страхует от изменений API.
    return data.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding);
}

async function main() {
    const inputPath = path.join(process.cwd(), 'commentaries.json');
    const outputPath = path.join(process.cwd(), 'commentaries_embeddings.json');

    if (!fs.existsSync(inputPath)) {
        console.error(`Не найден ${inputPath}. Сначала запусти build_commentaries.js.`);
        process.exit(1);
    }
    const commentaries = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`Фрагментов: ${commentaries.length}`);

    // Для эмбеддинга берём именно текст толкования. Добавлять к нему
    // ссылку на стих («Матфея 5:3 ...») не нужно: запросы пользователя
    // тоже идут без ссылок, и одинаковое представление с обеих сторон
    // даёт более чистое cosine similarity. Прямую привязку по стиху
    // делает отдельная ветка в function.js, не через эмбеддинги.
    const texts = commentaries.map(c => c.text);

    const embeddings = new Array(commentaries.length);
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
            // Без эмбеддинга этого батча искать в нём всё равно нельзя.
            // Записываем null — function.js пропустит такие записи на этапе поиска.
            for (let j = 0; j < batch.length; j++) embeddings[i + j] = null;
        }
        await sleep(BATCH_DELAY_MS);
    }

    fs.writeFileSync(outputPath, JSON.stringify(embeddings), 'utf8');

    const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    const nulls = embeddings.filter(e => e === null).length;
    console.log(`\nЗаписано: ${outputPath} (${sizeMb} МБ)`);
    if (nulls > 0) console.log(`Внимание: ${nulls} фрагментов без эмбеддингов (упал API). Запусти повторно — батчи дешёвые.`);
    console.log(`Готово за ${((Date.now() - startedAt) / 1000).toFixed(1)} сек.`);
}

main().catch(err => {
    console.error('Фатальная ошибка:', err);
    process.exit(1);
});
