const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');

async function exportToExcel() {
    try {
        // Чтение mapping.json
        const mappingsPath = path.join(__dirname, 'mapping.json');
        const mappingsData = await fs.readFile(mappingsPath, 'utf8');
        const mappings = JSON.parse(mappingsData);
        
        // Преобразуем объект в массив и фильтруем
        const itemsArray = Object.values(mappings).filter(item => 
            item && 
            !item.ignore && // Пропускаем товары с ignore:1
            item.name &&    // Пропускаем товары без имени
            item.name.trim() !== ''
        );
        
        if (itemsArray.length === 0) {
            console.log('Нет данных для экспорта после фильтрации');
            return;
        }
        
        // Формируем данные для Excel
        const excelData = itemsArray.map(item => {
            // Генерируем безопасное имя файла из оригинального имени
            const safeName = (item.name || '')
                .trim()
                .replace(/\s+/g, '_')
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/_{2,}/g, '_');
            
            // Определяем путь к изображению: берём первое изображение или генерируем путь
            const imagePath = item.images && item.images[0] 
                ? item.images[0] 
                : `/uploads/${safeName}.jpg`;
            
            return {
                name: item.name || '',
                size: item.size ? String(item.size) : '', // Преобразуем в строку
                price: item.price || 0,
                item: item.item || '',
                image: imagePath,
                category: item.category || '',
                color: item.color || '',
                stock: item.stock || 0
            };
        });
        
        // Создаем рабочую книгу
        const wb = XLSX.utils.book_new();
        
        // Создаем лист данных
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Добавляем лист в книгу
        XLSX.utils.book_append_sheet(wb, ws, 'Товары');
        
        // Формируем название файла
        const date = new Date().toISOString().split('T')[0];
        const fileName = `products_export_${date}.xlsx`; // Используем xlsx для современного формата
        const outputPath = path.join(__dirname, fileName);
        
        // Сохраняем файл
        XLSX.writeFile(wb, outputPath);
        
        console.log(`✅ Экспорт успешно завершен! Файл сохранен: ${outputPath}`);
        console.log(`📊 Экспортировано товаров: ${excelData.length} (из ${Object.keys(mappings).length} исходных записей)`);
        
    } catch (error) {
        console.error('❌ Ошибка при экспорте в Excel:', error);
        if (error instanceof SyntaxError) {
            console.error('❗ Проверьте корректность JSON в файле mapping.json');
        }
        process.exit(1);
    }
}

// Запускаем функцию
exportToExcel();