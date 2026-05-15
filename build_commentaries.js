// =====================================================================
// build_commentaries.js — одноразовый скрипт, который скачивает
// толкования блж. Феофилакта Болгарского на 4 Евангелия с azbyka.ru
// и собирает их в commentaries.json.
//
// Запуск:   node build_commentaries.js
// Результат: commentaries.json в текущей директории.
//
// Источник: azbyka.ru/otechnik/Feofilakt_Bolgarskij/tolkovanie-na-evangelie-ot-{matfeja,marka,luki,ioanna}/{1..N}
// Лицензия: тексты Феофилакта — общественное достояние (XI век), русский
// перевод — XIX век, тоже public domain. В README репозитория обязательно
// указать источник (azbyka.ru) — это уважительно к тем, кто разметил.
//
// Этичные настройки парсера:
//   — задержка 1500 мс между запросами (не флудим сайт);
//   — один прогон, результат коммитим в репозиторий и больше не дёргаем;
//   — User-Agent с пометкой о проекте.
// =====================================================================

const fs = require('fs');
const path = require('path');

const DELAY_MS = 1500;
const USER_AGENT = 'BlagovestBot/1.0 (non-commercial Telegram Mini App; one-time scrape; +https://github.com/uud-ai/gospel-navigator)';

// Книги Четвероевангелия. slug — кусок URL на azbyka, chapters — сколько глав
// в книге, bookName — то, как книга названа в bible.json (важно: ровно эта
// строка пойдёт в commentaries.json в поле "book", чтобы прямая привязка
// к стихам Библии работала без таблиц соответствий).
const BOOKS = [
    { bookName: 'Матфея',  slug: 'tolkovanie-na-evangelie-ot-matfeja', chapters: 28 },
    { bookName: 'Марка',   slug: 'tolkovanie-na-evangelie-ot-marka',   chapters: 16 },
    { bookName: 'Луки',    slug: 'tolkovanie-na-evangelie-ot-luki',    chapters: 24 },
    { bookName: 'Иоанна',  slug: 'tolkovanie-na-evangelie-ot-ioanna',  chapters: 21 }
];

// Сокращения azbyka в маркерах стихов (например, «Мф.5:3.»). Используются,
// чтобы парсер мог отличить маркер «своей» книги от перекрёстных ссылок
// на другие книги в тексте.
const BOOK_TO_AZBYKA_PREFIX = {
    'Матфея': 'Мф',
    'Марка':  'Мк',
    'Луки':   'Лк',
    'Иоанна': 'Ин'
};

const BASE_URL = 'https://azbyka.ru/otechnik/Feofilakt_Bolgarskij';

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function fetchChapter(slug, chapter) {
    const url = `${BASE_URL}/${slug}/${chapter}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
}

// Грубое удаление HTML-тегов. Сторонние DOM-парсеры не тащим — одноразовый
// скрипт, лишние зависимости не нужны. Текст толкования на azbyka лежит
// в основном блоке статьи; обрезаем хвост с библиографической сноской.
function extractEntryText(html) {
    // 1) Сначала пробуем выделить содержимое статьи. На azbyka часто используется
    //    <article>...</article>, иногда <div class="entry">. Берём первое, что нашли.
    let body = html;
    const artMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (artMatch) {
        body = artMatch[1];
    } else {
        const entryMatch = html.match(/<div[^>]*class="[^"]*\bentry\b[^"]*"[^>]*>([\s\S]*)/i);
        if (entryMatch) body = entryMatch[1];
    }

    // 2) Убираем скрипты, стили, комментарии, навигацию.
    body = body
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '');

    // 3) Блочные теги → переводы строк, остальные — выкидываем.
    body = body
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/h\d>/gi, '\n\n')
        .replace(/<[^>]+>/g, '');

    // 4) HTML entities.
    body = body
        .replace(/&nbsp;/g, ' ')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

    // 5) Нормализация пробелов.
    body = body
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    // 6) Срезаем библиографический хвост («Источник: …»).
    const srcIdx = body.search(/(^|\n)\s*Источник:/);
    if (srcIdx > 0) body = body.substring(0, srcIdx).trim();

    return body;
}

// Режем главу на фрагменты по маркерам стихов. Маркер — это шаблон
// «Мф.5:3.» в начале строки/абзаца. Если между двумя соседними маркерами
// нет содержательного текста — значит это группа стихов под одно толкование;
// накапливаем номера, пока не встретим маркер, после которого реально идёт
// текст. Тогда весь набранный диапазон становится одним фрагментом.
function splitChapterIntoFragments(chapterText, expectedBookName, expectedChapter) {
    const prefix = BOOK_TO_AZBYKA_PREFIX[expectedBookName];
    if (!prefix) return [];

    // Маркер: «Мф.5:3.», иногда «Мф. 5:3.» с пробелом после точки.
    const markerRe = new RegExp(`${prefix}\\.\\s*(\\d+):(\\d+)\\.?`, 'g');

    const markers = [];
    let m;
    while ((m = markerRe.exec(chapterText)) !== null) {
        const ch = parseInt(m[1], 10);
        const v = parseInt(m[2], 10);
        // Фильтруем перекрёстные ссылки (например «см. Мф.6:7» внутри комментария
        // к Мф.5). Признак настоящего маркера: глава совпадает с ожидаемой
        // И маркер стоит в начале строки.
        if (ch !== expectedChapter) continue;
        const before = chapterText.substring(Math.max(0, m.index - 1), m.index);
        const isAtLineStart = m.index === 0 || before === '\n';
        if (!isAtLineStart) continue;
        markers.push({ verse: v, start: m.index, fullLen: m[0].length });
    }

    if (markers.length === 0) return [];

    const fragments = [];
    let pendingVerses = [];

    for (let i = 0; i < markers.length; i++) {
        const cur = markers[i];
        const next = markers[i + 1];
        const sliceStart = cur.start + cur.fullLen;
        const sliceEnd = next ? next.start : chapterText.length;
        const between = chapterText.substring(sliceStart, sliceEnd).trim();

        pendingVerses.push(cur.verse);

        // Если после маркера идёт содержательный текст (> 30 символов) —
        // это конец «накопления», текущая группа стихов получает толкование.
        // Иначе продолжаем копить.
        if (between.length > 30) {
            const verseStart = Math.min(...pendingVerses);
            const verseEnd = Math.max(...pendingVerses);
            fragments.push({
                chapter: expectedChapter,
                verseStart,
                verseEnd,
                text: between
            });
            pendingVerses = [];
        }
    }

    return fragments;
}

// Оценка числа токенов: для русских текстов токенизатор OpenAI даёт примерно
// 2.5–3.5 символа на токен. Берём 2.5 — лучше переоценить и пройти под бюджет,
// чем недооценить и превысить.
function estimateTokens(text) {
    return Math.ceil(text.length / 2.5);
}

async function main() {
    const allFragments = [];

    for (const book of BOOKS) {
        console.log(`\n=== ${book.bookName} (${book.chapters} глав) ===`);
        for (let chapter = 1; chapter <= book.chapters; chapter++) {
            process.stdout.write(`  глава ${chapter}... `);
            try {
                const html = await fetchChapter(book.slug, chapter);
                const text = extractEntryText(html);
                const frags = splitChapterIntoFragments(text, book.bookName, chapter);
                for (const f of frags) {
                    allFragments.push({
                        id: `theo_${BOOK_TO_AZBYKA_PREFIX[book.bookName]}_${chapter}_${f.verseStart}_${f.verseEnd}`,
                        book: book.bookName,
                        chapter: f.chapter,
                        verseStart: f.verseStart,
                        verseEnd: f.verseEnd,
                        text: f.text,
                        tokensEst: estimateTokens(f.text)
                    });
                }
                console.log(`${frags.length} фрагментов`);
            } catch (err) {
                console.log(`ОШИБКА: ${err.message}`);
            }
            await sleep(DELAY_MS);
        }
    }

    const outPath = path.join(process.cwd(), 'commentaries.json');
    fs.writeFileSync(outPath, JSON.stringify(allFragments), 'utf8');

    // Сводка по результату.
    const byBook = {};
    let totalChars = 0;
    let totalTokens = 0;
    for (const f of allFragments) {
        byBook[f.book] = (byBook[f.book] || 0) + 1;
        totalChars += f.text.length;
        totalTokens += f.tokensEst;
    }
    console.log('\n=== ИТОГО ===');
    for (const b of Object.keys(byBook)) console.log(`  ${b}: ${byBook[b]} фрагментов`);
    console.log(`  всего фрагментов: ${allFragments.length}`);
    console.log(`  всего символов:   ${totalChars.toLocaleString('ru-RU')}`);
    console.log(`  оценка токенов:   ${totalTokens.toLocaleString('ru-RU')}`);
    console.log(`  файл записан:     ${outPath}`);
    console.log('\nПроверь файл глазами — особенно несколько фрагментов из разных книг.');
    console.log('Если разметка съехала (текст из другой главы попал в фрагмент, либо');
    console.log('фрагменты слишком короткие/длинные) — дай знать, поправлю парсер.');
}

main().catch(err => {
    console.error('Фатальная ошибка:', err);
    process.exit(1);
});
