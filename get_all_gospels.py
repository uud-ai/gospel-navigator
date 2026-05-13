import json
import os

def extract_gospels():
    output_file = 'bible.json'
    input_file = 'temp_bible/json/ru_synodal.json'
    
    if not os.path.exists('temp_bible'):
        print("📥 Скачиваю архив...")
        os.system('git clone --depth 1 https://github.com/thiagobodruk/bible.git temp_bible')

    try:
        print(f"📖 Открываю {input_file}...")
        with open(input_file, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        # Определяем структуру (список или словарь)
        books = data if isinstance(data, list) else data.get('books', [])
        
        if not books:
            print("❌ Файл пуст или имеет неизвестный формат!")
            return

        # --- БЛОК ДИАГНОСТИКИ ---
        print("\n🔍 Список первых 5 книг в файле для проверки:")
        for b in books[:5]:
            print(f"   - Name: '{b.get('name')}', Abbrev: '{b.get('abbrev')}'")
        print("-" * 30)
        # ------------------------

        all_verses = []
        # Ищем по коротким кодам (они обычно стабильнее имен)
        # В этом репозитории коды обычно: mt, mk, lk, jo (или jn)
        target_codes = {
            'mt': 'Матфея',
            'mk': 'Марка',
            'lk': 'Луки',
            'jo': 'Иоанна',
            'jn': 'Иоанна' # на случай если код jn
        }

        found_names = set()
        for b in books:
            code = b.get('abbrev', '').lower()
            if code in target_codes:
                name = target_codes[code]
                
                # Защита от дублей и Ионы (Иона обычно 'jon', а Иоанн 'jo' или 'jn')
                if name == 'Иоанна' and len(b.get('chapters', [])) < 10:
                    continue
                
                if name in found_names: continue
                
                chapters = b.get('chapters', [])
                print(f"✅ Нашел: {name} ({len(chapters)} глав)")
                for c_idx, chapter in enumerate(chapters):
                    for v_idx, verse_text in enumerate(chapter):
                        all_verses.append({
                            "book": name,
                            "chapter": c_idx + 1,
                            "verse": v_idx + 1,
                            "text": verse_text
                        })
                found_names.add(name)

        if all_verses:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(all_verses, f, ensure_ascii=False, indent=2)
            print(f"\n🚀 УСПЕХ! Собрано {len(all_verses)} стихов.")
        else:
            print("❌ Книги не найдены. Проверьте вывод диагностики выше.")

    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    extract_gospels()