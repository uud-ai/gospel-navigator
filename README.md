# Благовест

Telegram Mini App: ИИ-чат по Евангелию на русском языке. Одностраничное
приложение (`index.html`) с 14 темами (`topics.js`), «стихом дня»
(`verses_of_day.js`, 40 стихов) и чатом, который отвечает на вопросы о
Евангелии, опираясь на синодальный текст и толкования блж. Феофилакта
Болгарского.

Приложение не заменяет беседу со священником и не даёт пастырских
советов — это инструмент для изучения текста Писания.

## Как это устроено в продакшене

```
Пользователь ──► https://vmestefamily.site  (GitHub Pages, этот репозиторий, ветка main)
                      │  POST /  (заголовки Origin + X-App-Token)
                      ▼
     Yandex Cloud Function  blagovest-chat
     https://functions.yandexcloud.net/d4epe1g39ghi90d4vf6l
          │                                  │
          │ читает данные при холодном       │ эмбеддинг запроса и ответ
          │ старте                           ▼
          ▼                            proxyapi.ru (OpenAI-совместимый)
     Yandex Object Storage
     бакет blagovest-data-uud (публичное чтение)
```

| Часть | Где | Как обновляется |
|---|---|---|
| Фронтенд (`index.html`, `sw.js`, `*.js`) | GitHub Pages, `main`, домен `vmestefamily.site` (файл `CNAME`) | `git push` в `main` |
| Чат-функция (`backend/`) | Yandex Cloud Functions, `blagovest-chat` | `yc serverless function version create` (см. `backend/README.md`) |
| Данные (`data/*`) | Копия в бакете `blagovest-data-uud` | `yc storage s3api put-object` (см. `backend/README.md`) — **после любой пересборки `data/` бакет нужно обновить вручную** |
| DNS домена | рег.ру, свои NS (`ns1/ns2.reg.ru`) | 4 × A для `@` на IP GitHub Pages (`185.199.108–111.153`), CNAME `www` → `uud-ai.github.io` |

Почему данные в Object Storage, а не на `raw.githubusercontent.com`: 24 МБ
эмбеддингов оттуда скачиваются 15–30 с и не укладываются в 30-секундный
таймаут функции на холодном старте. Из бакета в том же регионе — секунды.

Почему Yandex, а не Cloudflare: с 2026 российские провайдеры рвут
соединения с Cloudflare, чат не открывался в РФ без VPN.

## Запуск локально

Сборка не требуется — обычный HTML/JS без фреймворков. `index.html` можно
открыть напрямую или отдать любым статическим сервером. Telegram-слой
(`telegram-web-app.js`) не обязателен: интерфейс и темы работают и вне
Telegram.

Чат при этом ходит в **боевую** функцию (`FUNCTION_URL` в `index.html`), а та
пускает только разрешённые `Origin` (см. `ALLOWED_ORIGINS` в
`backend/README.md`). С `file://` и `localhost` ответ будет 403. Для
проверки самой функции используйте `backend/local-test.js`.

## Telegram Mini App

Адрес для `@BotFather` (`/newapp`) — `https://vmestefamily.site/`. Другие
адреса (например, `uud-ai.github.io`) функция отклонит с 403, пока их
`Origin` не добавлен в `ALLOWED_ORIGINS`.

## Структура репозитория

```
index.html          — вся клиентская логика (UI, чат, работа с темами)
sw.js               — Service Worker: офлайн-кэш оболочки приложения
topics.js           — 14 тем, каждая со ссылками на стихи и вступлением
verses_of_day.js    — 40 стихов «на каждый день», ротация по дате
CNAME               — пользовательский домен для GitHub Pages
data/
  bible.json                  — весь Новый Завет (27 книг), синодальный
                                 перевод, 7955 стихов
  commentaries.json           — толкования блж. Феофилакта на 4 Евангелия,
                                 3734 фрагмента
  bible_embeddings.bin        — эмбеддинги bible.json, сырые float32
  commentaries_embeddings.bin — эмбеддинги толкований, тот же формат
scripts/
  get_nt.py                         — собирает data/bible.json из внешнего репозитория
  build_commentaries.js             — собирает data/commentaries.json с azbyka.ru
  build_bible_embeddings.js         — считает bible_embeddings.bin
  build_commentaries_embeddings.js  — считает commentaries_embeddings.bin
  embeddings_lib.js                 — общий код двух скриптов эмбеддингов
backend/
  index.js        — облачная функция чата
  local-test.js   — локальный прогон функции без облака (читает backend/.env)
  apigw.yaml      — опциональная спецификация API Gateway
  .env.example    — шаблон переменных для локального теста
  README.md       — переменные окружения, деплой, эксплуатация
```

## Backend

Код функции — `backend/index.js`. Контракт запроса/ответа задан клиентом
(`index.html`, `postChatRequest`) и функцией только реализован. Что делает
функция, переменные окружения и команды деплоя — в `backend/README.md`.

Эмбеддинги хранятся как `.bin` (сырые float32 подряд, без JSON): тот же
набор чисел текстом весит в ~4.6 раза больше (110 МБ против 23 МБ
суммарно) и после `JSON.parse` разворачивается в массив с боксингом каждого
числа — лишняя память и время на каждый холодный старт. Функция читает
`.bin` через `arrayBuffer()` + `Float32Array`.

Поиск — по отдельным стихам, не по отрывкам: короткие лексические
совпадения (например, слово «блудный» тянет к стихам про «блуд»/блудниц,
хотя в тексте притчи такого слова нет) иногда скорят выше подлинного
совпадения. Это смягчено порогом `MIN_SIMILARITY` — при отсутствии уверенного
совпадения модель получает пустой контекст и отвечает по общим знаниям.
Полного решения (индексация по отрывкам/перикопам) это не даёт.

## Безопасность

- `APP_TOKEN` в `index.html` виден всем — это не секрет, а барьер от
  случайных сканеров. Реальная защита: allow-list по `Origin` и rate limit
  в функции (20 запросов за 10 минут на IP; хранится в памяти инстанса, то есть
  лимит мягкий).
- `PROXY_API_KEY` хранится в Yandex Lockbox и в репозиторий не попадает.
  `backend/.env` в `.gitignore`.
- При смене `APP_TOKEN` нужно одновременно обновить его в `index.html` и в
  окружении функции.

## Данные и источники

| Файл | Источник | Статус лицензии |
|---|---|---|
| `data/bible.json` | [thiagobodruk/bible](https://github.com/thiagobodruk/bible) (`json/ru_synod.json`), собран через `scripts/get_nt.py` | Репозиторий-источник — MIT. Сам синодальный перевод (XIX век) — общественное достояние. |
| `data/commentaries.json` | [azbyka.ru](https://azbyka.ru), «Толкование на Евангелие» блж. Феофилакта Болгарского, собран через `scripts/build_commentaries.js` | Толкование (XI век) и его русский перевод (XIX век) — общественное достояние. Атрибуция источнику размётки — azbyka.ru. |
| `data/bible_embeddings.bin`, `data/commentaries_embeddings.bin` | OpenAI `text-embedding-3-small`, 512 измерений, сырой float32; индекс вектора = индексу в соответствующем основном файле | Производные векторы, не являются текстом — вопрос лицензии не применим. |

Код приложения (`index.html`, `*.js`, `*.py` в `scripts/`) — лицензия MIT,
см. `LICENSE`. Лицензия на код не относится к данным выше.

## Известные пробелы

- Все 47 ссылок в `topics.js` и все 40 в `verses_of_day.js` сверены с
  `data/bible.json` — ссылки находятся. Это проверка существования
  (книга/глава/стих есть в тексте), не сверка слово-в-слово.
- Service Worker отдаёт закэшированную оболочку первой. При изменении
  `index.html`, `topics.js` или `verses_of_day.js` нужно поднять `CACHE_NAME`
  в `sw.js`, иначе пользователи увидят старую версию.
- Бакет с данными не синхронизируется с `data/` автоматически.

## Пересборка данных

```bash
npm run build:nt                       # python scripts/get_nt.py
npm run build:commentaries             # ходит на azbyka.ru, НЕ запускать без необходимости
PROXY_API_KEY=xxx npm run build:bible-embeddings         # платный API
PROXY_API_KEY=xxx npm run build:commentaries-embeddings  # платный API
```

После пересборки загрузите файлы в бакет (команды — в `backend/README.md`).
`build_commentaries.js` делает одну последовательную выгрузку с задержкой
1.5 с между запросами и не предназначен для повторных прогонов; скрипты
эмбеддингов требуют `PROXY_API_KEY` и обращаются к платному API.
