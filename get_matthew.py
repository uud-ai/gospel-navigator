import json
import os

def extract_matthew():
    output_file = 'bible.json'
    search_dir = 'temp_bible'
    
    print("🔍 Ищу файл с русским переводом...")
    
    target_file = None
    for root, dirs, files in os.walk(search_dir):
        for file in files:
            if file.endswith(".json") and ("ru" in file.lower() or "synodal" in file.lower()):
                target_file = os.path.join(root, file)
                break
        if target_file: break

    if not target_file:
        print("❌ Не удалось найти файл перевода.")
        return

    print(f"📖 Файл найден: {target_file}")
    print("Начинаю извлечение (с поддержкой UTF-8-SIG)...")
    
    try:
        # Используем utf-8-sig, чтобы проигнорировать BOM-символы
        with open(target_file, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        books = data.get('books', data) if isinstance(data, dict) else data
        
        matthew_verses = []
        matthew_book = next((b for b in books if b.get('abbrev') == 'mt' or 'Матф' in b.get('name', '')), None)
        
        if not matthew_book:
            print("❌ Книга 'Матфея' не найдена.")
            return

        for c_idx, chapter in enumerate(matthew_book['chapters']):
            for v_idx, verse_text in enumerate(chapter):
                matthew_verses.append({
                    "book": "Матфея",
                    "chapter": c_idx + 1,
                    "verse": v_idx + 1,
                    "text": verse_text
                })

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(matthew_verses, f, ensure_ascii=False, indent=2)

        print(f"✅ УСПЕХ! Создан файл {output_file}.")
        print(f"📚 Всего стихов: {len(matthew_verses)}")
        
        os.system('rm -rf temp_bible')
        
    except Exception as e:
        print(f"❌ Ошибка при обработке: {e}")

if __name__ == "__main__":
    extract_matthew()