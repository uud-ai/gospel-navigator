import json
import os

def extract_gospels():
    output_file = 'bible.json'
    input_file = 'temp_bible/json/ru_synodal.json'
    
    # Целевые книги
    target_map = [
        {'id': 'mt', 'name': 'Матфея'},
        {'id': 'mk', 'name': 'Марка'},
        {'id': 'lk', 'name': 'Луки'},
        {'id': 'jo', 'name': 'Иоанна'} 
    ]
    
    if not os.path.exists('temp_bible'):
        print("📥 Скачиваю архив...")
        os.system('git clone --depth 1 https://github.com/thiagobodruk/bible.git temp_bible')

    try:
        print("📖 Читаю файл...")
        with open(input_file, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        # ПРОВЕРКА: Если данные — список, берем как есть. Если словарь — ищем ключ 'books'
        books = data if isinstance(data, list) else data.get('books', [])
        
        all_verses = []

        for target in target_map:
            # Ищем книгу в списке
            book_data = next((b for b in books if b.get('abbrev') == target['id']), None)
            
            # Запасной план для Иоанна (если 'jo' не сработал, ищем 'jn' с проверкой на длинную книгу)
            if not book_data and target['id'] == 'jo':
                book_data = next((b for b in books if b.get('abbrev') == 'jn' and len(b.get('chapters', [])) > 10), None)

            if book_data:
                chapters = book_data.get('chapters', [])
                print(f"✅ Обработка: {target['name']} ({len(chapters)} глав)...")
                for c_idx, chapter in enumerate(chapters):
                    for v_idx, verse_text in enumerate(chapter):
                        all_verses.append({
                            "book": target['name'],
                            "chapter": c_idx + 1,
                            "verse": v_idx + 1,
                            "text": verse_text
                        })
            else:
                print(f"⚠️ Книга {target['name']} не найдена в архиве!")

        if all_verses:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(all_verses, f, ensure_ascii=False, indent=2)
            print(f"\n🚀 ПОБЕДА! Собрано {len(all_verses)} стихов.")
            # os.system('rm -rf temp_bible') # Можно раскомментировать, чтобы удалять временную папку
        else:
            print("❌ Ошибка: Не удалось собрать ни одного стиха.")
        
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")

if __name__ == "__main__":
    extract_gospels()