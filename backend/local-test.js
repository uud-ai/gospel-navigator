const fs = require('fs');

// .env читается напрямую файлом — набор $env:APP_TOKEN=... в PowerShell
// на этой машине теряет заглавные латинские буквы (похоже на баг
// автодополнения PSReadLine), поэтому значения задаём через редактор, не
// через клавиатуру в терминале.
for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
}

const { handler } = require('./index.js');

const event = {
    httpMethod: 'POST',
    headers: {
        Origin: 'https://nikolskiyhram.site',
        'X-App-Token': process.env.APP_TOKEN,
    },
    body: JSON.stringify({
        messages: [{ role: 'user', content: 'Что значит притча о блудном сыне?' }],
        source: 'free_chat',
    }),
};

handler(event)
    .then((r) => console.log(r.statusCode, r.body))
    .catch((e) => console.error('caught:', e));
