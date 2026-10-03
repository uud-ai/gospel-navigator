# backend/

Облачная функция чата для «Благовеста». Написана с нуля (исходник, на
который ссылались сборочные скрипты, был утерян и не восстанавливается —
см. историю в корневом README). Платформа — Cloudflare Workers + R2
(изначально пробовали Yandex Cloud Functions, но аккаунт оказался
заблокирован по биллингу, а `yc` CLI не мог даже проверить это — см.
git-историю).

## Что делает

1. Проверяет заголовок `X-App-Token` и простой rate limit (в памяти
   изолята, не распределённый — см. комментарий в коде).
2. Считает эмбеддинг последнего сообщения пользователя (proxyapi.ru,
   `text-embedding-3-small`, 512 измерений — как и у данных в `data/`).
3. Находит самые похожие стихи и фрагменты толкования Феофилакта
   (косинусное сходство, без внешней векторной БД). На практике сейчас это
   поиск только по Евангелиям — `data/bible_embeddings.json` устарел и не
   покрывает остальные 23 книги НЗ, см. предупреждение в корневом README.
4. Собирает их в контекстное сообщение и отправляет вместе с историей чата
   в `proxyapi.ru/chat/completions` (модель — переменная `CHAT_MODEL`, по
   умолчанию `gpt-4o-mini`).
5. Проверяет ссылки на Новый Завет в ответе против `data/bible.json` (все
   27 книг); если ссылка не находится — не блокирует ответ, а приписывает
   предупреждение. Эта проверка не зависит от эмбеддингов и работает для
   всего НЗ уже сейчас.

## Статус

Системный промт (`SYSTEM_PROMPT` в коде) утверждён автором проекта.

**Не задеплоено и не протестировано вживую** — нет аккаунта Cloudflare
автора. Перед первым запуском:

1. Установить `wrangler` (CLI Cloudflare Workers) и авторизоваться:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. Создать R2-бакет и залить туда `data/*.json`:
   ```bash
   wrangler r2 bucket create blagovest-data
   wrangler r2 object put blagovest-data/bible.json --file=../data/bible.json
   wrangler r2 object put blagovest-data/commentaries.json --file=../data/commentaries.json
   wrangler r2 object put blagovest-data/bible_embeddings.json --file=../data/bible_embeddings.json
   wrangler r2 object put blagovest-data/commentaries_embeddings.json --file=../data/commentaries_embeddings.json
   ```
   Имя бакета в `wrangler.toml` (`bucket_name`) должно совпадать.
3. Задать секреты (не попадают в git, задаются по одному в интерактивном
   запросе):
   ```bash
   wrangler secret put APP_TOKEN
   wrangler secret put PROXY_API_KEY
   ```
   `APP_TOKEN` должен быть равен значению `APP_TOKEN` в `index.html`.
4. Задеплоить:
   ```bash
   wrangler deploy
   ```
   Команда выведет итоговый URL воркера (`https://blagovest-chat.<account>.workers.dev`
   или адрес на привязанном домене).
5. Подставить этот URL в `FUNCTION_URL` в `index.html` — только после
   подтверждения автора проекта (см. ограничения в корневом README).
6. Проверить вживую хотя бы один запрос из `index.html`.

### Локальная разработка

```bash
cp .dev.vars.example .dev.vars   # заполнить реальными значениями, не коммитить
wrangler dev
```

## Сознательные упрощения (chisle-пометки в коде)

- Rate limit — in-memory, в пределах одного изолята; Cloudflare может
  пересоздавать изоляты и балансировать между дата-центрами, так что это
  мягкий, не гарантированный лимит. Если абьюз станет реальной проблемой —
  нужен Durable Object или Workers KV, не память модуля.
- CORS — `Access-Control-Allow-Origin: *`. Можно сузить до конкретных
  доменов, если понадобится.
- Поиск релевантных фрагментов — полный перебор (brute-force cosine) по
  ~7500 векторам на каждый запрос. Для текущего объёма данных это быстро;
  если данные вырастут на порядок — понадобится приближённый поиск (ANN).
