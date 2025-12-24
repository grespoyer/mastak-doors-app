const fs = require('fs');
const path = require('path');

// Корректируем путь: поднимаемся на уровень вверх из utilities/ в project/
const DATA_FILE = path.join(__dirname, '../mapping.json');

try {
  // Проверяем существование файла перед чтением
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Файл не найден: ${DATA_FILE}`);
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  const products = JSON.parse(rawData);
  
  const duplicatesMap = new Map();
  const items = Object.values(products);
  
  items.forEach(item => {
    // Создаем уникальный ключ с нормализацией пробелов и регистра
    const key = `${item.name.trim().toLowerCase()}||${String(item.size).trim()}`;
    
    if (!duplicatesMap.has(key)) {
      duplicatesMap.set(key, []);
    }
    duplicatesMap.get(key).push(item.id);
  });
  
  let hasDuplicates = false;
  duplicatesMap.forEach((ids, key) => {
    if (ids.length > 1) {
      hasDuplicates = true;
      const [name, size] = key.split('||');
      console.log(`\n⚠️ Дубликаты найдены:`);
      console.log(`- name: "${name}"`);
      console.log(`- size: "${size}"`);
      console.log(`- ID: ${ids.join(', ')}`);
    }
  });
  
  console.log(hasDuplicates 
    ? `\n✅ Найдено ${Object.keys(Array.from(duplicatesMap).filter(([_, ids]) => ids.length > 1)).length} групп дубликатов` 
    : '\n✅ Дубликатов по связке name+size не найдено'
  );

} catch (error) {
  console.error('❌ ОШИБКА:', error.message);
  console.error(`💡 Проверьте путь к файлу: ${DATA_FILE.replace(process.cwd(), '')}`);
  process.exit(1);
}