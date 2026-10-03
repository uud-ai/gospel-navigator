import json
import os
import urllib.request

# =====================================================================
# get_nt.py — собирает data/bible.json: полный Новый Завет (27 книг),
# синодальный перевод, из того же источника, что и старый
# get_all_gospels.py (thiagobodruk/bible, MIT, см. README).
#
# Заменяет get_all_gospels.py: тот был рассчитан только на 4 Евангелия
# и ссылался на несуществующий уже файл 'ru_synodal.json' (на самом деле
# 'ru_synod.json' — имя поменялось на стороне источника). При проверке
# расхождений также нашёлся баг старого скрипта: в 11 главах 4 Евангелий
# было потеряно по 1-2 стиха с сдвигом нумерации всех следующих стихов
# в той же главе (Мф. 3, 5, 7, 17, 24, 27; Мк. 3, 5, 7; Ин. 8, 16).
# Этот скрипт читает стихи прямо из структуры chapters[][] без
# промежуточного парсинга — so verses уже не могут «потеряться».
#
# ВНИМАНИЕ: из-за исправления бага состав/нумерация стихов в Евангелиях
# меняется в этих 11 главах. Существующий data/bible_embeddings.json
# после этого не соответствует новому data/bible.json и требует
# пересчёта (отдельный платный шаг, не выполняется этим скриптом).
#
# Запуск: python scripts/get_nt.py
# =====================================================================

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'bible.json')
SOURCE_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/ru_synod.json'

# abbrev в источнike -> каноническое название книги для поля "book".
# Порядок словаря = порядок книг в итоговом файле (канонический порядок НЗ).
NT_BOOKS = {
    'mt': 'Матфея',
    'mc': 'Марка',
    'lc': 'Луки',
    'jo': 'Иоанна',
    'atos': 'Деяний',
    'rm': 'Римлянам',
    '1co': '1 Коринфянам',
    '2co': '2 Коринфянам',
    'gl': 'Галатам',
    'ef': 'Ефесянам',
    'fp': 'Филиппийцам',
    'cl': 'Колоссянам',
    '1ts': '1 Фессалоникийцам',
    '2ts': '2 Фессалоникийцам',
    '1tm': '1 Тимофею',
    '2tm': '2 Тимофею',
    'tt': 'Титу',
    'fm': 'Филимону',
    'hb': 'Евреям',
    'tg': 'Иакова',
    '1pe': '1 Петра',
    '2pe': '2 Петра',
    '1jo': '1 Иоанна',
    '2jo': '2 Иоанна',
    '3jo': '3 Иоанна',
    'jd': 'Иуды',
    'ap': 'Откровение',
}


def main():
    print(f'Скачиваю {SOURCE_URL}...')
    with urllib.request.urlopen(SOURCE_URL) as resp:
        raw = resp.read().decode('utf-8-sig')
    books_by_abbrev = {b['abbrev']: b for b in json.loads(raw)}

    verses = []
    for abbrev, name in NT_BOOKS.items():
        book = books_by_abbrev.get(abbrev)
        if not book:
            raise SystemExit(f'Книга с кодом "{abbrev}" не найдена в источнике.')
        for chapter_num, chapter in enumerate(book['chapters'], start=1):
            for verse_num, text in enumerate(chapter, start=1):
                verses.append({
                    'book': name,
                    'chapter': chapter_num,
                    'verse': verse_num,
                    'text': text.strip(),
                })

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(verses, f, ensure_ascii=False)

    print(f'Записано {len(verses)} стихов, {len(NT_BOOKS)} книг -> {OUTPUT_FILE}')


if __name__ == '__main__':
    main()
