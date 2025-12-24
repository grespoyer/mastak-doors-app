const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');

async function importFromExcel(excelFilePath) {
    try {
        if (!excelFilePath) {
            console.error('❌ Путь к Excel файлу не указан');
            console.log('Использование: node import-from-excel.js <путь_к_файлу.xlsx>');
            process.exit(1);
        }

        // Проверяем существование файла
        await fs.access(excelFilePath);

        // Чтение Excel файла
        const workbook = XLSX.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Конвертируем в JSON с сохранением типов данных
        const excelData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        if (!Array.isArray(excelData) || excelData.length === 0) {
            console.log('⚠️ Excel файл не содержит данных');
            return;
        }

        console.log(`📊 Прочитано записей из Excel: ${excelData.length}`);

        // Чтение текущих данных из mapping.json
        const mappingPath = path.join(__dirname, 'mapping.json');
        let mappingData = {};

        try {
            const rawData = await fs.readFile(mappingPath, 'utf8');
            mappingData = JSON.parse(rawData);
        } catch (err) {
            console.error('❌ Файл mapping.json не найден или содержит ошибки');
            process.exit(1);
        }

        // Обновляем товары по комбинации name + size
        let updatedCount = 0;
        let notFoundCount = 0;

        for (const row of excelData) {
            // Пропускаем записи без обязательных полей
            if (row.name === undefined || row.size === undefined) {
                console.log(`⚠️ Пропущена запись без названия или размера: ${JSON.stringify(row)}`);
                continue;
            }

            // Нормализуем данные из Excel: ВСЕГДА обрабатываем size как строку
            const excelName = row.name.toString().trim();
            const excelSize = row.size.toString().trim(); // <-- Ключевое изменение: размер всегда строка
            const excelPrice = row.price !== undefined ? parseFloat(row.price) : undefined;
            const excelItem = row.item !== undefined ? row.item.toString().trim() : undefined;
            const excelImage = row.image !== undefined ? row.image.toString().trim() : undefined;

            // Пропускаем записи с пустыми обязательными полями
            if (excelName === '' || excelSize === '') {
                console.log(`⚠️ Пропущена запись с пустым названием или размером: ${JSON.stringify(row)}`);
                continue;
            }

            // Валидация цены
            if (excelPrice !== undefined && (isNaN(excelPrice) || !isFinite(excelPrice))) {
                console.log(`⚠️ Некорректная цена "${row.price}" для товара "${excelName}". Игнорируем поле цены.`);
                excelPrice = undefined; // Не будем обновлять цену
            }

            // Ищем товар по точному совпадению name + size (как строки)
            let foundKey = null;
            for (const [key, product] of Object.entries(mappingData)) {
                // Пропускаем некорректные записи в mapping.json
                if (!product || !product.name || product.size === undefined) continue;

                const mappingName = product.name.trim();
                // Преобразуем размер из mapping в строку для сравнения
                const mappingSize = String(product.size).trim();

                if (mappingName === excelName && mappingSize === excelSize) {
                    foundKey = key;
                    break;
                }
            }

            if (foundKey) {
                const product = mappingData[foundKey];

                // Обновляем price только если есть валидное значение
                if (excelPrice !== undefined) {
                    product.price = excelPrice;
                }

                // Обновляем item если есть данные
                if (excelItem !== undefined && excelItem !== '') {
                    product.item = excelItem;
                }

                // Обновляем images строго по требованию: массив с одним элементом из поля image
                if (excelImage && excelImage !== '') {
                    product.images = [excelImage];
                }

                updatedCount++;
            } else {
                notFoundCount++;
                console.log(`ℹ️ Товар не найден в mapping.json: name="${excelName}", size="${excelSize}"`);
            }
        }

        // Сохраняем обновленные данные
        await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2), 'utf8');

        console.log(`✅ Импорт успешно завершен!`);
        console.log(`📈 Обновлено товаров: ${updatedCount}`);
        if (notFoundCount > 0) {
            console.log(`⚠️ Не найдено товаров: ${notFoundCount}`);
            console.log('💡 Совет: Проверьте точное совпадение названий и размеров в Excel и mapping.json');
        }
        console.log(`💾 Данные сохранены в: ${mappingPath}`);

    } catch (error) {
        console.error('❌ Ошибка при импорте из Excel:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Получаем путь к файлу из аргументов командной строки
const excelFilePath = process.argv[2];
importFromExcel(excelFilePath);