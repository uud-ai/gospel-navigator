// =====================================================================
// embeddings_lib.js — общая логика батчинга для build_bible_embeddings.js
// и build_commentaries_embeddings.js: оба считают эмбеддинги одинаковым
// способом (proxyapi.ru, text-embedding-3-small, 512 измерений) и пишут
// их в один и тот же бинарный формат (сырые float32 подряд, без JSON —
// см. комментарий в worker.js: loadData/fetchFloat32). Раньше это было
// дублировано построчно в обоих скриптах — один раз уже успел разойтись
// (null на упавший батч vs нулевой вектор), поэтому логика вынесена сюда.
//
// Параметры модели зафиксированы и совпадают с backend/worker.js —
// менять нельзя, иначе уже посчитанные *_embeddings.bin станут
// несовместимы с новыми запросами.
// =====================================================================

const fs = require('fs');

const PROXY_BASE_URL = 'https://api.proxyapi.ru/openai/v1';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 512;

const BATCH_SIZE = 64;
const BATCH_DELAY_MS = 300;

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function getEmbeddingsBatch(texts, apiKey) {
    const res = await fetch(`${PROXY_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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

// texts — массив строк в порядке исходного файла (bible.json / commentaries.json).
// outputPath — куда писать .bin. itemLabel — слово для прогресса в логах
// ("стихов" / "фрагментов"). Требует переменную окружения PROXY_API_KEY.
async function buildEmbeddings(texts, outputPath, itemLabel) {
    const apiKey = process.env.PROXY_API_KEY;
    if (!apiKey) {
        console.error('Задай переменную окружения PROXY_API_KEY перед запуском.');
        process.exit(1);
    }

    console.log(`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)}: ${texts.length}`);

    // Один сплошной буфер: вектор i лежит по смещению i*EMBEDDING_DIMS.
    // Упавший батч оставляет свой кусок нулями — worker.js отсечёт нулевой
    // вектор по MIN_SIMILARITY на этапе поиска, запрос это не уронит.
    const embeddings = new Float32Array(texts.length * EMBEDDING_DIMS);
    let failedCount = 0;
    const startedAt = Date.now();

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        process.stdout.write(`  батч ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(texts.length / BATCH_SIZE)}... `);
        try {
            const batchEmbeddings = await getEmbeddingsBatch(batch, apiKey);
            for (let j = 0; j < batchEmbeddings.length; j++) {
                embeddings.set(batchEmbeddings[j], (i + j) * EMBEDDING_DIMS);
            }
            console.log(`ok (${((Date.now() - startedAt) / 1000).toFixed(1)}s суммарно)`);
        } catch (err) {
            console.log(`ОШИБКА: ${err.message}`);
            failedCount += batch.length;
        }
        await sleep(BATCH_DELAY_MS);
    }

    fs.writeFileSync(outputPath, Buffer.from(embeddings.buffer));

    const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    console.log(`\nЗаписано: ${outputPath} (${sizeMb} МБ)`);
    if (failedCount > 0) {
        console.log(`Внимание: ${failedCount} ${itemLabel} без эмбеддингов (упал API, оставлены нулевым вектором). Запусти повторно — батчи дешёвые.`);
    }
    console.log(`Готово за ${((Date.now() - startedAt) / 1000).toFixed(1)} сек.`);
}

module.exports = { buildEmbeddings, EMBEDDING_DIMS, EMBEDDING_MODEL };
