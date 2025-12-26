const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
// grespoyer
const INPUT_DIR = path.join(__dirname, 'input');
const MAPPING_FILE = path.join(__dirname, 'mapping.json');

// Определение вторника
function getNextTuesday() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 - воскресенье, 1 - понедельник, 2 - вторник и т.д.
  let daysToAdd = 2 - dayOfWeek; // 2 - вторник
  if (daysToAdd <= 0) {
    daysToAdd += 7; // если сегодня вторник или позже на этой неделе
  }
  const nextTuesday = new Date(today);
  nextTuesday.setDate(today.getDate() + daysToAdd);
  // Форматируем дату как ДД.ММ.ГГГГ
  const day = String(nextTuesday.getDate()).padStart(2, '0');
  const month = String(nextTuesday.getMonth() + 1).padStart(2, '0');
  const year = nextTuesday.getFullYear();
  return `${day}.${month}.${year}`;
}
// === Функция поиска Excel-файла ===
function findExcelFile() {
    const inputFiles = require('fs').readdirSync(INPUT_DIR);
    const excelFile = inputFiles.find(f => f.match(/\.(xlsx?|xls)$/i));
    return excelFile ? path.join(INPUT_DIR, excelFile) : null;
}

// === Функция для чтения mapping.json ===
async function readMapping() {
    try {
        const data = await fs.readFile(MAPPING_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

// === Функция для сохранения mapping.json ===
async function saveMapping(mapping) {
    await fs.writeFile(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    console.log('✅ mapping.json сохранён.');
}

// === Основная функция ===
async function updateMappingFromExcel() {
    const excelFile = findExcelFile();
    if (!excelFile) {
        console.error('❌ Excel-файл не найден в папке input/');
        return;
    }

    console.log(`📖 Читаю файл: ${excelFile}`);

    const mapping = await readMapping();

    const workbook = XLSX.readFile(excelFile);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Получаем все ключи ячеек (например, A1, A2, B1, B2...)
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    let prevRowNum = 0;
    let skippedRows = [];

    for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
        const currentRowNum = rowNum + 1; // Excel начинается с 1

        // Проверка пропусков
        if (prevRowNum && currentRowNum !== prevRowNum + 1) {
            for (let r = prevRowNum + 1; r < currentRowNum; r++) {
                console.warn(`⚠️ Пропущена строка: A${r}`);
                skippedRows.push(r);
            }
        }
        prevRowNum = currentRowNum;

        // Читаем A и B колонки
        const cellA = worksheet[XLSX.utils.encode_cell({ c: 0, r: rowNum })]; // A
        const cellB = worksheet[XLSX.utils.encode_cell({ c: 1, r: rowNum })]; // B

        if (!cellA) continue; // Пропускаем, если A пустой

        const name = cellA.v || cellA.w || '';
        if (typeof name !== 'string') continue; // Пропускаем, если не строка

        const stock = parseInt(cellB?.v || 0);
        const columnC = worksheet[XLSX.utils.encode_cell({ c: 2, r: rowNum })]; // Столбец С (индекс 2)
        const hasDeliveryInfo = columnC && columnC.v !== undefined && columnC.v !== null && columnC.v !== '';
        // Если записи с таким именем ещё нет в mapping, создаём её с минимальными данными
        if (!mapping[name]) {
            // Определяем, нужно ли игнорировать строку
            let ignore = 0;
            if (
                name.includes('Склад') ||
                name.includes('Свободный остаток') ||
                name.includes('Заказано на склад') ||
                name.includes('Дата') ||
                name.includes('Геометрия') ||
                name.includes('Классика') ||
                name.includes('Лайн') ||
                name.includes('Погонаж') ||
                name.includes('Деталь короба') ||
                name.includes('Доборный элемент') ||
                name.includes('Наличник') ||
                name.startsWith('_') // Служебные строки
            ) {
                ignore = 1;
            }

            mapping[name] = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                name: name,
                price: 0,
                category: ignore ? 'ignore' : 'НОВОЕ!', // ЕДИНСТВЕННОЕ ИЗМЕНЕНИЕ: все новые товары получают категорию "НОВОЕ!"
                color: '',
                glass: '',
                size: 0,
                stock: stock,
                images: [],
                createdAt: new Date().toISOString(),
                ignore: ignore,
                item: "000000",       // 🔥 Новое поле: артикул
                stockProgram: 0,        // 🔥 Новое поле: складская программа (0 — заказное, 1 — складское)
                expectedDeliveryDate: hasDeliveryInfo ? getNextTuesday() : null // <-- новое поле
            };
        } else {
            // Если запись существует, обновляем только stock, item и stockProgram (если они есть в Excel?)
            // В текущей логике мы не читаем C/D колонки — поэтому оставляем их без изменений
            mapping[name].stock = stock;
            if (hasDeliveryInfo) {
                mapping[name].expectedDeliveryDate = getNextTuesday();
            }
            // Если хочешь читать артикул и программу из Excel — нужно расширить логику
            // Пока просто оставляем существующие значения
        }
    }

    await saveMapping(mapping);

    console.log(`✅ Обновлен stock для ${Object.keys(mapping).length} записей в mapping.json.`);
    if (skippedRows.length > 0) {
        console.log(`ℹ️ Пропущено строк: ${skippedRows.length}`);
    }
}

// === Запуск ===
updateMappingFromExcel().catch(e => console.error('❌ Ошибка:', e));