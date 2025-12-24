const fs = require('fs').promises;
const path = require('path');

const MAPPING_FILE = path.join(__dirname, 'mapping.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

async function readJson(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

async function saveJson(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
    console.log(`✅ ${file} обновлён.`);
}

async function syncProducts() {
    const mapping = await readJson(MAPPING_FILE);
    let products = await readJson(PRODUCTS_FILE);

    let updatedCount = 0;
    let addedCount = 0;

    for (const [originalName, item] of Object.entries(mapping)) {
        // Пропускаем игнорируемые товары
        if (item.ignore === 1) continue;

        // Ищем товар в products.json по id
        const existingProductIndex = products.findIndex(p => p.id === item.id);

        if (existingProductIndex !== -1) {
            // Обновляем все поля, кроме id и createdAt (или можно оставить createdAt)
            const product = products[existingProductIndex];
            product.name = item.name;
            product.price = item.price || 0;
            product.category = item.category || "НОВОЕ!";
            product.color = item.color || "";
            product.glass = item.glass || "";
            product.size = item.size || 0;
            product.stock = item.stock || 0;
            product.images = item.images || [];
            product.item = item.item || "000000";           // 🔥 Копируем артикул
            product.stockProgram = item.stockProgram || 0;  // 🔥 Копируем складскую программу

            console.log(`🔄 Обновлён: ${product.name} (id: ${item.id}) -> stock: ${product.stock}, item: ${product.item}, stockProgram: ${product.stockProgram}`);
            updatedCount++;
        } else {
            // Добавляем как "НОВОЕ!" с новым id
            const newProduct = {
                id: item.id, // Используем id из mapping.json
                name: item.name,
                price: item.price || 0,
                category: item.category || "НОВОЕ!",
                color: item.color || "",
                glass: item.glass || "",
                size: item.size || 0,
                stock: item.stock || 0,
                images: item.images || [],
                createdAt: new Date().toISOString(),
                item: item.item || "000000",           // 🔥 Добавляем артикул
                stockProgram: item.stockProgram || 0   // 🔥 Добавляем складскую программу
            };
            products.push(newProduct);
            console.log(`➕ Добавлен: ${newProduct.name} (id: ${newProduct.id}) -> stock: ${newProduct.stock}, item: ${newProduct.item}, stockProgram: ${newProduct.stockProgram}`);
            addedCount++;
        }
    }

    await saveJson(PRODUCTS_FILE, products);
    console.log(`\n📊 Итого: обновлено ${updatedCount}, добавлено ${addedCount} товаров.`);
}

// Запуск
syncProducts().catch(e => console.error('❌ Ошибка:', e));