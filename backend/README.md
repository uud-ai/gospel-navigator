# backend/

Облачная функция чата для «Благовеста». Платформа — **Yandex Cloud
Functions** (перенесена с Cloudflare Workers: с 2026 российские провайдеры
рвут соединения с Cloudflare, чат не открывался в РФ без VPN).

## Что делает

1. Проверяет заголовок `Origin` (allow-list, `ALLOWED_ORIGINS`), заголовок
   `X-App-Token` и простой rate limit (в памяти инстанса, не распределённый
   — см. комментарий в коде).
2. Считает эмбеддинг последнего сообщения пользователя (proxyapi.ru,
   `text-embedding-3-small`, 512 измерений — как и у данных в `data/`).
3. Находит самые похожие стихи и фрагменты толкования Феофилакта
   (косинусное сходство, без внешней векторной БД, покрывает весь НЗ).
   Совпадения ниже порога `MIN_SIMILARITY` отбрасываются — см. предупреждение
   в корневом README про лексические ложные срабатывания на коротких стихах.
4. Собирает их в контекстное сообщение и отправляет вместе с историей чата
   в `proxyapi.ru/chat/completions` (модель — переменная `CHAT_MODEL`, по
   умолчанию `gpt-4o-mini`).
5. Проверяет ссылки на Новый Завет в ответе против `data/bible.json` (все
   27 книг); если ссылка не находится — не блокирует ответ, а приписывает
   предупреждение.

## Переменные окружения

| Имя | Тип | Обязательна | Описание |
|---|---|---|---|
| `APP_TOKEN` | секрет | да | должен совпадать с `APP_TOKEN` в `index.html` |
| `PROXY_API_KEY` | секрет | да | ключ proxyapi.ru |
| `CHAT_MODEL` | переменная | нет | по умолчанию `gpt-4o-mini` |
| `DATA_BASE_URL` | переменная | нет | по умолчанию `raw.githubusercontent.com` на этот репозиторий; **в проде — бакет Object Storage** `https://storage.yandexcloud.net/blagovest-data-uud` (GitHub raw отдаёт 24 МБ эмбеддингов 15–30 с и не укладывается в таймаут 30 с на холодном старте) |
| `ALLOWED_ORIGINS` | переменная | нет | разрешённые `Origin` через запятую, по умолчанию `https://nikolskiyhram.site`; в проде ещё `https://vmestefamily.site` |

## Деплой (Yandex Cloud, `yc` CLI)

Предполагается, что `yc` уже настроен (`yc init`) на платный биллинг-аккаунт
(бесплатная квота 1 млн вызовов/мес действует и на платном аккаунте — это
постоянный free tier, не триал).

Создать функцию (один раз):
```bash
yc serverless function create --name blagovest-chat
```

Данные в бакет (один раз и после каждой пересборки `data/`):
```bash
yc storage bucket create --name blagovest-data-uud --public-read
cd data && for f in bible.json commentaries.json bible_embeddings.bin commentaries_embeddings.bin; do
  yc storage s3api put-object --bucket blagovest-data-uud --key $f --body $f
done
```

Задеплоить код (каждый раз после изменений в `index.js`) — из папки `backend/`:
```bash
yc serverless function version create \
  --function-name blagovest-chat \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 512m \
  --execution-timeout 30s \
  --source-path . \
  --environment CHAT_MODEL=gpt-4o-mini \
  --environment DATA_BASE_URL=https://storage.yandexcloud.net/blagovest-data-uud \
  --environment ALLOWED_ORIGINS=https://nikolskiyhram.site,https://vmestefamily.site \
  --secret environment-variable=APP_TOKEN,id=<lockbox-secret-id>,version-id=<version-id>,key=APP_TOKEN \
  --secret environment-variable=PROXY_API_KEY,id=<lockbox-secret-id>,version-id=<version-id>,key=PROXY_API_KEY
```

Секреты (`APP_TOKEN`, `PROXY_API_KEY`) — через Yandex Lockbox, не как
обычные `--environment` (те видны в консоли открытым текстом). Создать
секрет один раз:
```bash
yc lockbox secret create --name blagovest-secrets \
  --payload '[{"key": "APP_TOKEN", "text_value": "..."}, {"key": "PROXY_API_KEY", "text_value": "..."}]'
```
`yc lockbox secret get blagovest-secrets` покажет `id` и `version-id` для
команды выше. Функции нужен доступ к секрету — назначить её service account
роль `lockbox.payloadViewer` на этот секрет (или на весь каталог).

Если не хочется заводить Lockbox сразу — можно временно передать
`APP_TOKEN`/`PROXY_API_KEY` через `--environment` (как остальные
переменные); это менее безопасно (видно в консоли/API каталога), но не
попадает в git и не видно публично.

Сделать функцию публично вызываемой по HTTP (эквивалент старого
`workers.dev` URL, без API Gateway):
```bash
yc serverless function allow-unauthenticated-invoke --name blagovest-chat
```
Публичный адрес:
```bash
yc serverless function get --name blagovest-chat --format json | grep '"id"'
# https://functions.yandexcloud.net/<function-id>
```

### Альтернатива: API Gateway

Если нужен красивый/стабильный домен (не привязанный к `<function-id>`),
можно поставить перед функцией API Gateway. Спецификация —
`backend/apigw.yaml` в этом репозитории (placeholder'ы `${function_id}` /
`${service_account_id}` подставляются через `--parameters`):
```bash
yc serverless api-gateway create --name blagovest-gateway --spec apigw.yaml \
  --parameters function_id=<function-id>,service_account_id=<sa-id>
```
Сервисному аккаунту (`<sa-id>`) нужна роль `functions.functionInvoker` на
функцию `blagovest-chat`.
Публичный адрес будет вида `https://<gateway-id>.apigw.yandexcloud.net/chat`.
Для текущей нагрузки (один эндпоинт, без кастомного домена) это
избыточно — используйте, только если понадобится свой домен или несколько
функций за одним гейтвеем.

## Локальная разработка

Без облака — через фейковый `event`:
```bash
cp .env.example .env   # заполнить реальными значениями через текстовый редактор, не коммитить
node local-test.js
```
`local-test.js` сам читает `.env` и вызывает `handler()` с тестовым
сообщением. Значения в `.env` лучше вставлять через редактор (Notepad),
а не печатать в PowerShell — на некоторых машинах автодополнение
PSReadLine глотает заглавные латинские буквы при вводе `$env:NAME=...`.

## Сознательные упрощения (chisle-пометки в коде)

- Rate limit — in-memory, в пределах одного инстанса функции; Yandex Cloud
  может поднимать несколько инстансов и переcоздавать их, так что это
  мягкий, не гарантированный лимит. Если абьюз станет реальной проблемой —
  нужен внешний стейт (Redis/YDB), не память модуля.
- Origin — allow-list по точному совпадению строки (без wildcard-доменов).
  Расширяется через `ALLOWED_ORIGINS`, без правок кода.
- Поиск релевантных фрагментов — полный перебор (brute-force cosine) по
  ~7500 векторам на каждый запрос. Для текущего объёма данных это быстро;
  если данные вырастут на порядок — понадобится приближённый поиск (ANN).
