require('dotenv').config(); // Загрузка переменных из .env файла
const axios = require('axios');
const bcrypt = require('bcrypt');
const saltRounds = 12;
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const fse = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const app = express();
const loginCodes = new Map();
app.use(cookieParser());

// Настройки
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const ADMIN_DIR = path.join(__dirname, 'admin');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const VISIBLE_CATEGORIES_FILE = path.join(__dirname, 'visible_categories.json');
const LAST_UPDATE_FILE = path.join(__dirname, '.last_update.json');
const FEEDBACK_FILE = path.join(__dirname, 'feedback.json');
const INPUT_DIR = path.join(__dirname, 'input');
const PARTNERS_FILE = path.join(__dirname, 'partners.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const TEMP_PRODUCTS_FILE = path.join(__dirname, 'temp.json');

// Создаем папки
[UPLOADS_DIR, ADMIN_DIR, PUBLIC_DIR, INPUT_DIR].forEach(dir => {
    if (!fse.existsSync(dir)) {
        fse.mkdirSync(dir);
        console.log(`📁 Создана папка: ${dir}`);
    }
});

// Настройка сессий ДО любых роутов
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 часа
    }
}));

// grespoyer
// Middleware защиты админки (должно идти ПОСЛЕ настройки сессий, но ДО статических файлов и роутов)
const requireAdminAuth = (req, res, next) => {
    const publicAdminPaths = [
        '/admin/login',
        '/admin/request-login-code',
        '/admin/verify-login-code'
    ];
    
    // Если путь публичный для админки - пропускаем
    if (publicAdminPaths.includes(req.path)) {
        return next();
    }
    
    // Если пользователь пытается получить доступ к админке и не аутентифицирован
    if (req.path.startsWith('/admin') && !req.session.isAdminAuthenticated) {
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(401).json({ error: 'Требуется аутентификация' });
        }
        return res.redirect('/admin/login');
    }
    
    next();
};
// Middleware для аутентификации партнеров
const requirePartnerAuth = (req, res, next) => {
  if (!req.session.partner || !req.session.partner.id) {
    return res.status(401).json({ error: 'Требуется аутентификация партнера' });
  }
  next();
};

// Middleware для проверки прав доступа к данным партнера
const requirePartnerAccess = (req, res, next) => {
    if (!req.session.partner || !req.session.partner.id) {
        return res.status(401).json({ error: 'Требуется аутентификация партнера' });
    }
    const requestedPartnerId = req.params.id;
    const sessionPartnerId = String(req.session.partner.id);
    
    // Используем преобразование к строке для сравнения
    if (sessionPartnerId !== String(requestedPartnerId)) {
        return res.status(403).json({ error: 'Доступ запрещен: попытка доступа к чужим данным' });
    }
    next();
};
// Применяем middleware защиты СРАЗУ после настройки сессий
app.use(requireAdminAuth);

// Статические файлы (после middleware защиты)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/admin', express.static(ADMIN_DIR));

// Middleware для CSP (Content Security Policy)
app.use((req, res, next) => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
    res.setHeader('Content-Security-Policy', csp);
    next();
});

// Создаем файл партнеров, если его нет
if (!fse.existsSync(PARTNERS_FILE)) {
  console.log('📁 Файл партнеров не найден, создаем новый...');
  
  try {
    const initialPartners = [
      {
        id: '1',
        username: 'partner1',
        password: hashPassword('password1'), // Хеширование пароля
        name: 'Партнер №1',
        contactPerson: 'Иван Иванов',
        email: 'partner1@example.com',
        phone: '+7 (999) 123-45-67',
        createdAt: new Date().toISOString()
      }
    ];
    
    fse.writeFileSync(PARTNERS_FILE, JSON.stringify(initialPartners, null, 2));
    console.log(`✅ Файл партнеров создан с тестовыми данными: ${PARTNERS_FILE}`);
    console.log('Тестовый партнер: логин "partner1", пароль "password1"');
  } catch (error) {
    console.error('❌ Ошибка создания файла партнеров:', error);
  }
} else {
  console.log(`✅ Файл партнеров уже существует: ${PARTNERS_FILE}`);
  
  // Проверяем и восстанавливаем содержимое файла при необходимости
  try {
    const data = fse.readFileSync(PARTNERS_FILE, 'utf8');
    const partners = JSON.parse(data);
    console.log(`📁 В файле партнеров ${partners.length} записей`);
    
    // Проверяем целостность данных
    let needsFix = false;
    partners.forEach(partner => {
      if (!partner.password || partner.password.length < 10) { // Хеш обычно длиннее 10 символов
        console.warn(`⚠️ Партнер ${partner.username} имеет некорректный пароль, исправляем...`);
        partner.password = hashPassword('password1'); // Новый пароль по умолчанию
        needsFix = true;
      }
      
      // Убеждаемся, что есть все необходимые поля
      if (!partner.createdAt) {
        partner.createdAt = new Date().toISOString();
        needsFix = true;
      }
    });
    
    if (needsFix) {
      fse.writeFileSync(PARTNERS_FILE, JSON.stringify(partners, null, 2));
      console.log('✅ Файл партнеров исправлен и сохранен');
    }
  } catch (e) {
    console.error('❌ Ошибка чтения файла партнеров:', e);
    console.log('Попытка восстановления файла...');
    
    try {
      // Создаем новый файл с тестовыми данными
      const initialPartners = [
        {
          id: '1',
          username: 'partner1',
          password: hashPassword('password1'),
          name: 'Партнер №1',
          contactPerson: 'Иван Иванов',
          email: 'partner1@example.com',
          phone: '+7 (999) 123-45-67',
          createdAt: new Date().toISOString()
        }
      ];
      
      fse.writeFileSync(PARTNERS_FILE, JSON.stringify(initialPartners, null, 2));
      console.log('✅ Файл партнеров восстановлен с тестовыми данными');
    } catch (recoveryError) {
      console.error('❌ Критическая ошибка восстановления файла партнеров:', recoveryError);
    }
  }
}

// Создаем файл заказов, если его нет
if (!fse.existsSync(ORDERS_FILE)) {
    fse.writeFileSync(ORDERS_FILE, '[]');
    console.log(`📁 Создан файл для хранения заказов: ${ORDERS_FILE}`);
}

// Создаем файл для временных данных, если его нет
if (!fse.existsSync(TEMP_PRODUCTS_FILE)) {
    fse.writeFileSync(TEMP_PRODUCTS_FILE, '[]');
    console.log(`📁 Создан файл для временных данных: ${TEMP_PRODUCTS_FILE}`);
}

// API: Получить список партнеров
app.get('/api/partners', async (req, res) => {
  try {
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    const partners = JSON.parse(data);
    // Возвращаем партнеров без паролей
    const partnersWithoutPasswords = partners.map(({ password, ...partner }) => partner);
    res.json(partnersWithoutPasswords);
  } catch (err) {
    console.error('Ошибка получения списка партнеров:', err);
    res.status(500).json({ error: 'Ошибка получения списка партнеров' });
  }
});
// API: Получить данные партнера по ID
app.get('/api/partners/:id', async (req, res) => {
  try {
    const partnerId = req.params.id;
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    const partners = JSON.parse(data);
    const partner = partners.find(p => p.id === partnerId);
    
    if (!partner) {
      return res.status(404).json({ error: 'Партнер не найден' });
    }
    
    // Возвращаем партнера без пароля
    const { password, ...partnerWithoutPassword } = partner;
    res.json(partnerWithoutPassword);
  } catch (err) {
    console.error('Ошибка получения данных партнера:', err);
    res.status(500).json({ error: 'Ошибка получения данных партнера' });
  }
});
// === API: Проверка аутентификации партнера ===
app.get('/api/partner/check-auth', requirePartnerAuth, async (req, res) => {
    try {
        res.json({ authenticated: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка проверки аутентификации' });
    }
});
// API: Создать нового партнера
app.post('/api/partners', async (req, res) => {
  try {
    const { username, password, name, contactPerson, email, phone } = req.body;
    
    // Валидация обязательных полей
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Логин, пароль и название партнера обязательны' });
    }
    
    // Проверка уникальности логина
    let partners = [];
    try {
      const data = await fs.readFile(PARTNERS_FILE, 'utf8');
      partners = JSON.parse(data);
    } catch (e) {
      // Файл не существует, создадим его
    }
    
    if (partners.some(p => p.username === username)) {
      return res.status(400).json({ error: 'Партнер с таким логином уже существует' });
    }
    
    // Хеширование пароля
    const hashedPassword = hashPassword(password);
    
    // Создание нового партнера
    const newPartner = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      name,
      contactPerson: contactPerson || '',
      email: email || '',
      phone: phone || '',
      createdAt: new Date().toISOString()
    };
    
    partners.push(newPartner);
    await fs.writeFile(PARTNERS_FILE, JSON.stringify(partners, null, 2));
    
    // Возвращаем партнера без пароля
    const { password: _, ...partnerWithoutPassword } = newPartner;
    res.status(201).json(partnerWithoutPassword);
  } catch (err) {
    console.error('Ошибка создания партнера:', err);
    res.status(500).json({ error: 'Ошибка создания партнера' });
  }
});

// API: Обновить данные партнера
app.put('/api/partners/:id', async (req, res) => {
  try {
    const partnerId = req.params.id;
    const { username, name, contactPerson, email, phone, newPassword } = req.body;
    
    // Валидация обязательных полей
    if (!username || !name) {
      return res.status(400).json({ error: 'Логин и название партнера обязательны' });
    }
    
    // Загрузка партнеров
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    let partners = JSON.parse(data);
    
    const partnerIndex = partners.findIndex(p => p.id === partnerId);
    if (partnerIndex === -1) {
      return res.status(404).json({ error: 'Партнер не найден' });
    }
    
    // Проверка уникальности логина
    if (partners.some(p => p.username === username && p.id !== partnerId)) {
      return res.status(400).json({ error: 'Партнер с таким логином уже существует' });
    }
    
    // Обновление данных партнера
    const updatedPartner = {
      ...partners[partnerIndex],
      username,
      name,
      contactPerson: contactPerson || '',
      email: email || '',
      phone: phone || ''
    };
    
    // Если указан новый пароль, хешируем его
    if (newPassword && newPassword.trim() !== '') {
      updatedPartner.password = hashPassword(newPassword.trim());
    }
    
    partners[partnerIndex] = updatedPartner;
    await fs.writeFile(PARTNERS_FILE, JSON.stringify(partners, null, 2));
    
    // Возвращаем партнера без пароля
    const { password: _, ...partnerWithoutPassword } = updatedPartner;
    res.json(partnerWithoutPassword);
  } catch (err) {
    console.error('Ошибка обновления партнера:', err);
    res.status(500).json({ error: 'Ошибка обновления партнера' });
  }
});

// API: Удалить партнера
app.delete('/api/partners/:id', async (req, res) => {
  try {
    const partnerId = req.params.id;
    
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    let partners = JSON.parse(data);
    
    const originalLength = partners.length;
    partners = partners.filter(p => p.id !== partnerId);
    
    if (partners.length === originalLength) {
      return res.status(404).json({ error: 'Партнер не найден' });
    }
    
    await fs.writeFile(PARTNERS_FILE, JSON.stringify(partners, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления партнера:', err);
    res.status(500).json({ error: 'Ошибка удаления партнера' });
  }
});

// API: Сгенерировать и отправить новый пароль партнера
app.post('/api/partners/:id/reset-password', async (req, res) => {
  try {
    const partnerId = req.params.id;
    
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    let partners = JSON.parse(data);
    
    const partnerIndex = partners.findIndex(p => p.id === partnerId);
    if (partnerIndex === -1) {
      return res.status(404).json({ error: 'Партнер не найден' });
    }
    
    // Генерация нового пароля
    const newPassword = Math.random().toString(36).slice(-8);
    partners[partnerIndex].password = hashPassword(newPassword);
    
    await fs.writeFile(PARTNERS_FILE, JSON.stringify(partners, null, 2));
    
    // Отправка нового пароля администратору
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
      try {
        const partner = partners[partnerIndex];
        const message = `
🔐 *Сброс пароля партнера*
👤 *Партнер:* ${partner.name}
🆔 *ID:* ${partner.id}
🔑 *Новый пароль:* ${newPassword}
❗ *Важно:* Передайте пароль партнеру и попросите сменить его после первого входа
`;
        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN,
          process.env.TELEGRAM_ADMIN_CHAT_ID,
          message,
          'Markdown'
        );
      } catch (telegramError) {
        console.error('Ошибка отправки пароля в Telegram:', telegramError);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Пароль сброшен и отправлен администратору через Telegram' 
    });
  } catch (err) {
    console.error('Ошибка сброса пароля партнера:', err);
    res.status(500).json({ error: 'Ошибка сброса пароля партнера' });
  }
});

// Функция хеширования паролей
function hashPassword(password) {
  try {
    return bcrypt.hashSync(password, saltRounds);
  } catch (error) {
    console.error('❌ Ошибка хеширования пароля:', error);
    throw new Error('Ошибка хеширования пароля');
  }
}

function verifyPassword(password, hash) {
  try {
    return bcrypt.compareSync(password, hash);
  } catch (error) {
    console.error('❌ Ошибка проверки пароля:', error);
    return false;
  }
}

// Генерация 6-значного кода
function generateLoginCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Функция отправки сообщения в Telegram
async function sendTelegramMessage(botToken, chatId, message, parseMode = 'Markdown') {
    if (!botToken || !chatId) {
        console.warn('⚠️ Не установлены параметры для Telegram бота');
        return null;
    }
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const data = {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode
    };
    try {
        const response = await axios.post(url, data);
        console.log(`✅ Сообщение успешно отправлено в Telegram: ${response.data?.ok ? 'OK' : 'Ошибка'}`);
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения в Telegram:', error.response?.data || error.message);
        return null;
    }
}

// Настройка загрузки изображений
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Только изображения (JPEG, PNG, WebP)'));
    }
});

// === API: Получить все товары ===
app.get('/api/products', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.writeFile(PRODUCTS_FILE, '[]');
            return res.json([]);
        }
        res.status(500).json({ error: 'Ошибка чтения данных' });
    }
});

// === API: Получить товар по ID ===
app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        const product = products.find(p => p.id === productId);
        if (!product) return res.status(404).json({ error: 'Товар не найден' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка обработки данных' });
    }
});

// === API: Добавить/обновить товар ===
app.post('/api/products', upload.array('images', 5), async (req, res) => {
    const {
        id,
        name,
        price,
        category,
        color = '',
        glass = '',
        size,
        stock,
        item = '',
        stockProgram = ''
    } = req.body;
    if (!name || price === undefined || category === undefined) {
        return res.status(400).json({ error: 'Заполните обязательные поля: название, цена, категория' });
    }
    try {
        let products = [];
        try {
            const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
            products = JSON.parse(data);
        } catch (e) {
            // Игнорируем ошибку — файл не существует
        }
        const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
        if (id) {
            const index = products.findIndex(p => p.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'Товар не найден для обновления' });
            }
            // Сохраняем старые изображения, если новые не загружены
            const existingImages = imageUrls.length > 0 ? imageUrls : products[index].images || [];
            products[index] = {
                ...products[index],
                name: name.trim(),
                price: parseFloat(price),
                category: category.trim(),
                color: (color || '').trim(),
                glass: (glass || '').trim(),
                size: size ? parseInt(size, 10) : null,
                stock: stock ? parseInt(stock, 10) : 0,
                item: (item || '').trim(),
                stockProgram: stockProgram ? parseInt(stockProgram, 10) : 0,
                images: existingImages
            };
        } else {
            const newProduct = {
                id: Date.now().toString(),
                name: name.trim(),
                price: parseFloat(price),
                category: category.trim(),
                color: (color || '').trim(),
                glass: (glass || '').trim(),
                size: size ? parseInt(size, 10) : null,
                stock: stock ? parseInt(stock, 10) : 0,
                item: (item || '').trim(),
                stockProgram: stockProgram ? parseInt(stockProgram, 10) : 0,
                images: imageUrls,
                createdAt: new Date().toISOString()
            };
            products.push(newProduct);
        }
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка при сохранении товара:', err);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

// === API: Удалить товар ===
app.delete('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        let products = [];
        try {
            const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
            products = JSON.parse(data);
        } catch (e) {}
        const originalLength = products.length;
        products = products.filter(p => p.id !== productId);
        if (products.length === originalLength) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

// === API: Массовое обновление товаров ===
app.patch('/api/bulk-update', async (req, res) => {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Неверный формат данных' });
    }
    const allowedFields = ['category', 'color', 'price', 'item', 'stockProgram'];
    const cleanUpdates = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined && updates[key] !== '') {
            if (key === 'price') {
                cleanUpdates[key] = parseFloat(updates[key]);
            } else if (key === 'stockProgram') {
                cleanUpdates[key] = parseInt(updates[key], 10);
            } else {
                cleanUpdates[key] = (updates[key] || '').trim();
            }
        }
    }
    if (Object.keys(cleanUpdates).length === 0) {
        return res.status(400).json({ error: 'Нет допустимых полей для обновления' });
    }
    try {
        let products = [];
        try {
            const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
            products = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: 'Файл products.json не найден' });
        }
        let updatedCount = 0;
        products = products.map(p => {
            if (ids.includes(p.id)) {
                updatedCount++;
                return { ...p, ...cleanUpdates };
            }
            return p;
        });
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        res.json({ success: true, updated: updatedCount });
    } catch (err) {
        console.error('Ошибка массового обновления:', err);
        res.status(500).json({ error: 'Ошибка при массовом обновлении' });
    }
});

// Функция применения временных данных к обновленным остаткам
async function applyTempProductsToUpdatedStocks() {
    console.log('🔄 Обновление данных: временно вычтенные остатки будут сброшены, так как новые данные актуальны');
    try {
        // Загружаем временные данные для логирования
        let tempProducts = [];
        try {
            const tempData = await fs.readFile(TEMP_PRODUCTS_FILE, 'utf8');
            tempProducts = JSON.parse(tempData);
            if (tempProducts.length > 0) {
                console.log(`ℹ️ Обнаружены временные данные, которые будут сброшены (${tempProducts.length} записей):`);
                // Логируем информацию о том, какие товары были в обработке
                const summary = {};
                tempProducts.forEach(temp => {
                    if (!summary[temp.name]) {
                        summary[temp.name] = { count: 0, totalQuantity: 0 };
                    }
                    summary[temp.name].count++;
                    summary[temp.name].totalQuantity += temp.orderedQuantity;
                });
                Object.entries(summary).forEach(([name, data]) => {
                    console.log(`  - ${name}: ${data.count} заказов, всего ${data.totalQuantity} шт.`);
                });
            }
        } catch (e) {
            console.log('ℹ️ Нет временных данных для сброса');
        }
        // 🔥 ПОЛНОСТЬЮ ОЧИЩАЕМ временные данные без применения к остаткам
        // Так как при обновлении из Excel новые остатки уже отражают актуальное состояние склада
        await fs.writeFile(TEMP_PRODUCTS_FILE, '[]', 'utf8');
        console.log('✅ Все временные данные успешно сброшены. Новые остатки из Excel считаются актуальными.');
        // Дополнительно: очищаем статусы заказов "В обработке", чтобы они вернулись в статус "Новые"
        try {
            const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
            let orders = JSON.parse(ordersData);
            let processingOrdersChanged = false;
            orders = orders.map(order => {
                if (order.status === 'processing') {
                    console.log(`🔄 Заказ #${order.id} переведен из статуса "В обработке" в "Новый" из-за обновления данных`);
                    order.status = 'new';
                    processingOrdersChanged = true;
                }
                return order;
            });
            if (processingOrdersChanged) {
                await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
                console.log('✅ Статусы заказов обновлены: все заказы в статусе "В обработке" переведены в "Новые"');
            }
        } catch (e) {
            console.error('⚠️ Не удалось обновить статусы заказов:', e);
        }
    } catch (error) {
        console.error('❌ Ошибка при сбросе временных данных:', error);
        throw error;
    }
}

// === API: Сверить/Обновить данные из Excel ===
app.get('/api/check-update', async (req, res) => {
    console.log('🔍 Начинаю проверку обновлений из локальных файлов...');
    try {
        // Получаем список файлов в папке input
        const files = await fs.readdir(INPUT_DIR);
        // Ищем Excel файл с остатками Альбере
        const excelFiles = files.filter(file =>
            file.toLowerCase().includes('альберо') &&
            file.toLowerCase().includes('остатки') &&
            (file.toLowerCase().endsWith('.xls') || file.toLowerCase().endsWith('.xlsx'))
        ).sort((a, b) => {
            // Сортируем файлы по дате в имени, чтобы взять самый свежий
            const dateA = a.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)?.[1] || '';
            const dateB = b.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)?.[1] || '';
            return new Date(dateB.split('.').reverse().join('-')) - new Date(dateA.split('.').reverse().join('-'));
        });
        if (excelFiles.length === 0) {
            throw new Error('Не найден подходящий Excel файл с остатками Альбере в папке input/');
        }
        const latestFile = excelFiles[0];
        const inputFile = path.join(INPUT_DIR, latestFile);
        console.log(`✅ Найден файл: ${latestFile}`);
        // Извлекаем дату из имени файла
        let fileDate = 'unknown';
        const dateMatch = latestFile.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (dateMatch) {
            fileDate = dateMatch[1];
            console.log(`📅 Дата файла: ${fileDate}`);
        } else {
            console.log('⚠️ Дата в имени файла не найдена, использую текущую дату');
            const today = new Date();
            fileDate = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
        }
        // Проверяем, нужно ли обновлять - сравниваем дату с последним обновлением
        let lastUpdate = {};
        try {
            const lastUpdateData = await fs.readFile(LAST_UPDATE_FILE, 'utf8');
            lastUpdate = JSON.parse(lastUpdateData);
        } catch (e) {
            console.log('ℹ️ Файл последнего обновления не найден');
        }
        // Если дата файла такая же, как в последнем обновлении, не обновляем
        if (lastUpdate.date === fileDate) {
            console.log('ℹ️ Файл не изменился. Обновление не требуется.');
            return res.json({
                updated: false,
                message: 'Файл не изменился. Обновление не требуется.',
                date: fileDate,
                fileName: latestFile
            });
        }
        // Запускаем скрипты обработки
        console.log('🔄 Запускаем скрипт update-products.js...');
        try {
            await execPromise(`node update-products.js "${inputFile}"`);
            console.log('✅ update-products.js завершен успешно');
        } catch (updateError) {
            console.error('❌ Ошибка при запуске update-products.js:', updateError.stderr || updateError.message);
            throw new Error('Ошибка при обработке файла update-products.js');
        }
        console.log('🔄 Запускаем скрипт sync-products.js...');
        try {
            await execPromise('node sync-products.js');
            console.log('✅ sync-products.js завершен успешно');
        } catch (syncError) {
            console.error('❌ Ошибка при запуске sync-products.js:', syncError.stderr || syncError.message);
            throw new Error('Ошибка при синхронизации данных sync-products.js');
        }
        // Применяем временные данные к новым остаткам
        await applyTempProductsToUpdatedStocks();
        // Сохраняем информацию об обновлении
        await fs.writeFile(LAST_UPDATE_FILE, JSON.stringify({
            date: fileDate,
            updatedAt: new Date().toISOString(),
            fileName: latestFile,
            filePath: inputFile
        }, null, 2));
        console.log('✅ Обновление успешно завершено!');
        res.json({
            updated: true,
            message: `Файл обновлен. Обработано с использованием скриптов обработки.`,
            date: fileDate,
            fileName: latestFile,
            debug: {
                inputFile: inputFile,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Критическая ошибка при обновлении:');
        console.error(error);
        // Создаем отчет об ошибке
        const errorReport = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        // Сохраняем отчет в файл
        try {
            const errorLogPath = path.join(INPUT_DIR, 'update_error.log');
            await fs.writeFile(errorLogPath, JSON.stringify(errorReport, null, 2));
            console.log(`📄 Отчет об ошибке сохранен в: ${errorLogPath}`);
        } catch (logError) {
            console.error('❌ Не удалось сохранить отчет об ошибке:', logError.message);
        }
        res.status(500).json({
            error: 'Ошибка при обработке Excel-файла',
            details: error.message,
            debug: errorReport
        });
    }
});

// === API: Получить дату последнего обновления ===
app.get('/api/last-update', async (req, res) => {
    try {
        const data = await fs.readFile(LAST_UPDATE_FILE, 'utf8');
        const lastUpdate = JSON.parse(data);
        res.json({ date: lastUpdate.date || '5.12.2025' });
    } catch (err) {
        console.error('Ошибка чтения даты обновления:', err);
        res.json({ date: '5.12.2025' }); // Дата по умолчанию
    }
});

// === API: Получить видимые категории ===
app.get('/api/visible-categories', async (req, res) => {
    try {
        const data = await fs.readFile(VISIBLE_CATEGORIES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            // Если файл не существует, возвращаем пустой массив
            return res.json([]);
        }
        res.status(500).json({ error: 'Ошибка чтения данных о видимых категориях' });
    }
});

// === API: Обновить видимые категории ===
app.post('/api/visible-categories', async (req, res) => {
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
        return res.status(400).json({ error: 'Неверный формат данных' });
    }
    try {
        await fs.writeFile(VISIBLE_CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf8');
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка при сохранении видимых категорий:', err);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

// === API: Обратная связь ===
app.post('/api/feedback', async (req, res) => {
    try {
        const { message, email } = req.body;
        if (!message || message.trim().length < 5) {
            return res.status(400).json({ error: 'Сообщение должно содержать минимум 5 символов' });
        }
        let feedbackList = [];
        try {
            const data = await fs.readFile(FEEDBACK_FILE, 'utf8');
            feedbackList = JSON.parse(data);
        } catch (e) {
            // Игнорируем ошибку - файла не существует
        }
        const newFeedback = {
            id: Date.now().toString(),
            message: message.trim(),
            email: email ? email.trim() : null,
            date: new Date().toISOString()
        };
        feedbackList.push(newFeedback);
        await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedbackList, null, 2), 'utf8');
        // Логируем в консоль
        console.log(`Новое сообщение обратной связи от ${email || 'аноним'}: ${message}`);
        // Отправляем сообщение в Telegram администратору
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            try {
                const adminMessage = `
📨 *Новое сообщение обратной связи*
📧 *Email:* ${email ? email : 'не указан'}
👤 *IP адрес:* ${req.ip}
⏰ *Время:* ${new Date().toLocaleString('ru-RU')}
💬 *Сообщение:*
${message}
`.trim();
                await sendTelegramMessage(
                    process.env.TELEGRAM_BOT_TOKEN,
                    process.env.TELEGRAM_CHAT_ID,
                    adminMessage,
                    'Markdown'
                );
            } catch (telegramError) {
                console.error('❌ Ошибка отправки сообщения в Telegram:', telegramError);
            }
        } else {
            console.warn('⚠️ Переменные окружения для Telegram не установлены. Сообщение не отправлено.');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения обратной связи:', err);
        res.status(500).json({ error: 'Ошибка при сохранении сообщения' });
    }
});

// === API: Вход партнера ===
app.post('/api/partner/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    const partners = JSON.parse(data);
    const partner = partners.find(p =>
      p.username === username && verifyPassword(password, p.password)
    );
    if (partner) {
      // Устанавливаем сессию партнера
      req.session.partner = { id: partner.id };
      
      // Возвращаем данные партнера без пароля
      const { password: _, ...partnerData } = partner;
      res.json(partnerData);
    } else {
      res.status(401).json({ error: 'Неверный логин или пароль' });
    }
  } catch (err) {
    console.error('Ошибка при входе партнера:', err);
    res.status(500).json({ error: 'Ошибка аутентификации' });
  }
});

// === API: Получить профиль партнера ===
app.get('/api/partner/:id/profile', requirePartnerAccess, async (req, res) => {
  try {
    const partnerId = req.params.id;
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    const partners = JSON.parse(data);
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) {
      return res.status(404).json({ error: 'Партнер не найден' });
    }
    // Возвращаем только профильные данные без пароля
    res.json({
      contactPerson: partner.contactPerson || '',
      email: partner.email || '',
      phone: partner.phone || ''
    });
  } catch (err) {
    console.error('Ошибка получения профиля партнера:', err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// === API: Сохранить профиль партнера ===
app.post('/api/partner/:id/profile', requirePartnerAccess, async (req, res) => {
  try {
    const partnerId = req.params.id;
    const profileData = req.body;
    const data = await fs.readFile(PARTNERS_FILE, 'utf8');
    let partners = JSON.parse(data);
    const partnerIndex = partners.findIndex(p => p.id === partnerId);
    if (partnerIndex === -1) {
      return res.status(404).json({ error: 'Партнер не найден' });
    }
    // Обновляем профильные данные партнера
    partners[partnerIndex] = {
      ...partners[partnerIndex],
      contactPerson: profileData.contactPerson || partners[partnerIndex].contactPerson || '',
      email: profileData.email || partners[partnerIndex].email || '',
      phone: profileData.phone || partners[partnerIndex].phone || ''
    };
    await fs.writeFile(PARTNERS_FILE, JSON.stringify(partners, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка сохранения профиля партнера:', err);
    res.status(500).json({ error: 'Ошибка сохранения профиля' });
  }
});

// === API: Получить заказы партнера ===
app.get('/api/partner/:id/orders', requirePartnerAccess, async (req, res) => {
  try {
    const partnerId = req.params.id;
    const data = await fs.readFile(ORDERS_FILE, 'utf8');
    let orders = JSON.parse(data);
    // Фильтруем заказы по партнеру
    const partnerOrders = orders.filter(order => order.partnerId === partnerId);
    // Сортируем заказы по дате (новые первыми)
    partnerOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(partnerOrders);
  } catch (err) {
    console.error('Ошибка получения заказов партнера:', err);
    res.status(500).json({ error: 'Ошибка получения заказов' });
  }
});
app.post('/api/partner/logout', (req, res) => {
  if (req.session.partner) {
    delete req.session.partner;
  }
  res.json({ success: true });
});
// === API: Создание заказа ===
app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        // Валидация обязательных полей
        if (!orderData.customerName || !orderData.phone || (!orderData.isPartner && !orderData.address)) {
            return res.status(400).json({ error: 'Заполните все обязательные поля' });
        }
        if (orderData.items.length === 0) {
            return res.status(400).json({ error: 'Корзина пуста' });
        }
        // Генерируем уникальный ID заказа
        const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
        // Формируем объект заказа
        const newOrder = {
            id: orderId,
            customerName: orderData.customerName,
            phone: orderData.phone,
            email: orderData.email || '',
            address: orderData.address || '',
            comments: orderData.comments || '',
            items: orderData.items,
            total: orderData.total,
            isPartner: orderData.isPartner || false,
            partnerId: orderData.partnerId || null,
            status: 'new',
            createdAt: new Date().toISOString()
        };
        // Загружаем существующие заказы
        let orders = [];
        try {
            const data = await fs.readFile(ORDERS_FILE, 'utf8');
            orders = JSON.parse(data);
        } catch (e) {
            // Игнорируем ошибку - файла не существует
        }
        // Добавляем новый заказ
        orders.push(newOrder);
        // Сохраняем заказы
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
        // Формируем сообщение для Telegram
        const orderDate = new Date().toLocaleString('ru-RU');
        let itemsList = '';
        newOrder.items.forEach((item, index) => {
            itemsList += `${index + 1}) ${item.name}, ${item.size ? `${item.size} мм` : ''}, ${item.itemNumber || 'без артикула'}, ${item.quantity} шт., ${(item.price * item.quantity).toFixed(2)} ₽
`;
        });
        const telegramMessage = `
🆕 НОВЫЙ ЗАКАЗ #${orderId}
👤 Данные пользователя:
Имя: ${newOrder.customerName}
Телефон: ${newOrder.phone}
${newOrder.email ? `Email: ${newOrder.email}
` : ''}
${newOrder.isPartner ? 'Тип: Партнер' : `Адрес: ${newOrder.address}`}
📅 Дата заказа: ${orderDate}
📦 Товары в заказе:
${itemsList}
💰 Итого: ${newOrder.total.toFixed(2)} ₽
💬 Комментарий: ${newOrder.comments || 'Не указан'}
`.trim();
        console.log(`📥 Новый заказ: ${orderId}`);
        console.log(`👤 Клиент: ${orderData.customerName}`);
        console.log(`📞 Телефон: ${orderData.phone}`);
        console.log(`💰 Сумма: ${orderData.total.toFixed(2)} ₽`);
        console.log(`📦 Товаров: ${orderData.items.length}`);
        // Отправляем уведомление в Telegram
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            try {
                await sendTelegramMessage(
                    process.env.TELEGRAM_BOT_TOKEN,
                    process.env.TELEGRAM_CHAT_ID,
                    telegramMessage,
                    'Markdown'
                );
                console.log('✅ Уведомление о заказе успешно отправлено в Telegram');
            } catch (telegramError) {
                console.error('❌ Ошибка отправки уведомления о заказе в Telegram:', telegramError);
            }
        } else {
            console.warn('⚠️ Переменные окружения для Telegram не установлены. Уведомление о заказе не отправлено.');
        }
        // Возвращаем успешный ответ
        res.json({ success: true, orderId: orderId });
    } catch (err) {
        console.error('Ошибка при создании заказа:', err);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
});

// === API: Получение заказов (для админки) ===
app.get('/api/orders', async (req, res) => {
    try {
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        const orders = JSON.parse(data);
        res.json(orders);
    } catch (err) {
        console.error('Ошибка при получении заказов:', err);
        res.status(500).json({ error: 'Ошибка при получении заказов' });
    }
});

app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Статус не указан' });
        }
        // Допустимые статусы
        const allowedStatuses = ['new', 'processing', 'completed', 'cancelled'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Недопустимый статус' });
        }
        // Загружаем заказы
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        let orders = JSON.parse(data);
        // Находим заказ
        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        const order = orders[orderIndex];
        const oldStatus = order.status;
        // Если статус не изменился, просто возвращаем заказ
        if (oldStatus === status) {
            return res.json(order);
        }
        // Загружаем текущие товары
        let products = [];
        try {
            const productsData = await fs.readFile(PRODUCTS_FILE, 'utf8');
            products = JSON.parse(productsData);
        } catch (e) {
            console.error('Ошибка загрузки товаров:', e);
            return res.status(500).json({ error: 'Ошибка загрузки товаров' });
        }
        // Загружаем временные данные (товары "в обработке")
        let tempProducts = [];
        try {
            const tempData = await fs.readFile(TEMP_PRODUCTS_FILE, 'utf8');
            tempProducts = JSON.parse(tempData);
        } catch (e) {
            // Игнорируем ошибку, если файла нет
        }
        // Логика обновления остатков в зависимости от изменения статуса
        if (status === 'processing' && oldStatus === 'new') {
            // При переводе в статус "в обработке" уменьшаем остатки
            order.items.forEach(item => {
                const productIndex = products.findIndex(p => p.id === item.id);
                if (productIndex !== -1) {
                    // Сохраняем исходные остатки
                    const originalStock = products[productIndex].stock;
                    const newStock = Math.max(0, originalStock - item.quantity);
                    products[productIndex].stock = newStock;
                    // Обновляем/добавляем запись во временных данных
                    const tempIndex = tempProducts.findIndex(t => t.id === item.id && t.orderId === orderId);
                    if (tempIndex !== -1) {
                        tempProducts[tempIndex] = {
                            ...tempProducts[tempIndex],
                            orderedQuantity: item.quantity,
                            originalStock: originalStock, // Сохраняем исходные остатки
                            currentStock: newStock       // Сохраняем текущие остатки
                        };
                    } else {
                        tempProducts.push({
                            id: item.id,
                            orderId: orderId,
                            orderedQuantity: item.quantity,
                            originalStock: originalStock, // Сохраняем исходные остатки
                            currentStock: newStock,       // Сохраняем текущие остатки
                            name: item.name,
                            size: item.size
                        });
                    }
                    console.log(`Товар ${item.name} (${item.size}мм): остаток изменен с ${originalStock} на ${newStock}`);
                }
            });
        } else if (status === 'cancelled' && oldStatus === 'processing') {
            // При отмене заказа, который был в обработке, восстанавливаем остатки
            order.items.forEach(item => {
                const tempItem = tempProducts.find(t => t.id === item.id && t.orderId === orderId);
                const productIndex = products.findIndex(p => p.id === item.id);
                if (productIndex !== -1 && tempItem) {
                    // Восстанавливаем остатки, добавляя обратно заказанное количество
                    const restoredStock = products[productIndex].stock + tempItem.orderedQuantity;
                    products[productIndex].stock = restoredStock;
                    console.log(`Товар ${item.name} (${item.size}мм): остаток восстановлен с ${products[productIndex].stock - tempItem.orderedQuantity} до ${restoredStock}`);
                }
                // Удаляем из временных данных
                tempProducts = tempProducts.filter(t => !(t.id === item.id && t.orderId === orderId));
            });
        } else if (status === 'completed' && oldStatus === 'processing') {
            // При завершении заказа обновляем исходные остатки
            order.items.forEach(item => {
                const tempIndex = tempProducts.findIndex(t => t.id === item.id && t.orderId === orderId);
                if (tempIndex !== -1) {
                    // Обновляем исходные остатки до текущих значений
                    const productIndex = products.findIndex(p => p.id === item.id);
                    if (productIndex !== -1) {
                        tempProducts[tempIndex].originalStock = products[productIndex].stock;
                    }
                }
            });
            // Удаляем временные данные после завершения заказа
            tempProducts = tempProducts.filter(t => t.orderId !== orderId);
        }
        // Обновляем статус заказа
        order.status = status;
        order.updatedAt = new Date().toISOString();
        // Сохраняем обновленные товары
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        // Сохраняем обновленные временные данные
        await fs.writeFile(TEMP_PRODUCTS_FILE, JSON.stringify(tempProducts, null, 2), 'utf8');
        // Сохраняем обновленные заказы
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        console.log(`Заказ ${orderId} изменен: статус ${oldStatus} -> ${status}`);
        // Возвращаем обновленный заказ
        res.json(order);
    } catch (err) {
        console.error('Ошибка обновления статуса заказа:', err);
        res.status(500).json({ error: 'Ошибка обновления статуса заказа и остатков' });
    }
});

// === API: Изменить номер заказа ===
app.patch('/api/orders/:id/order-number', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { newOrderNumber } = req.body;
        if (!newOrderNumber || typeof newOrderNumber !== 'string' || newOrderNumber.trim() === '') {
            return res.status(400).json({ error: 'Новый номер заказа обязателен и должен быть строкой' });
        }
        // Загружаем заказы
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        let orders = JSON.parse(data);
        // Находим заказ
        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        // Сохраняем старый ID для возможного возврата временных данных
        const oldId = orders[orderIndex].id;
        // Проверяем, не существует ли уже заказа с таким номером
        if (orders.some(order => order.id === newOrderNumber.trim() && order.id !== oldId)) {
            return res.status(400).json({ error: 'Заказ с таким номером уже существует' });
        }
        // Обновляем номер заказа
        const updatedOrder = {
            ...orders[orderIndex],
            id: newOrderNumber.trim(),
            originalId: orders[orderIndex].originalId || oldId // Сохраняем оригинальный ID для отслеживания
        };
        // Обновляем заказ в массиве
        orders[orderIndex] = updatedOrder;
        // Обновляем временные данные для этого заказа, если они есть
        try {
            const tempData = await fs.readFile(TEMP_PRODUCTS_FILE, 'utf8');
            let tempProducts = JSON.parse(tempData);
            // Обновляем orderId во временных данных
            tempProducts = tempProducts.map(temp =>
                temp.orderId === oldId ? { ...temp, orderId: newOrderNumber.trim() } : temp
            );
            await fs.writeFile(TEMP_PRODUCTS_FILE, JSON.stringify(tempProducts, null, 2), 'utf8');
        } catch (e) {
            console.warn('Не удалось обновить временные данные:', e);
        }
        // Сохраняем обновленные заказы
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        console.log(`Номер заказа изменен: ${oldId} -> ${newOrderNumber.trim()}`);
        res.json({ success: true, order: updatedOrder });
    } catch (err) {
        console.error('Ошибка обновления номера заказа:', err);
        res.status(500).json({ error: 'Ошибка обновления номера заказа' });
    }
});

// === API: Получить временные данные (товары "в обработке") ===
app.get('/api/temp-products', async (req, res) => {
    try {
        let tempProducts = [];
        try {
            const data = await fs.readFile(TEMP_PRODUCTS_FILE, 'utf8');
            tempProducts = JSON.parse(data);
        } catch (e) {
            // Игнорируем ошибку - файла не существует
        }
        res.json(tempProducts);
    } catch (err) {
        console.error('Ошибка получения временных данных:', err);
        res.status(500).json({ error: 'Ошибка получения временных данных' });
    }
});

// === API: Обновить временные данные при оформлении заказа ===
app.post('/api/update-temp-products', async (req, res) => {
    try {
        const tempItems = req.body;
        // Загружаем текущие временные данные
        let currentTemp = [];
        try {
            const data = await fs.readFile(TEMP_PRODUCTS_FILE, 'utf8');
            currentTemp = JSON.parse(data);
        } catch (e) {
            // Игнорируем ошибку - файла не существует
        }
        // Добавляем/обновляем временные данные
        tempItems.forEach(newItem => {
            const existingIndex = currentTemp.findIndex(t => t.id === newItem.id && t.orderId === newItem.orderId);
            if (existingIndex !== -1) {
                currentTemp[existingIndex] = {
                    ...currentTemp[existingIndex],
                    ...newItem,
                    originalStock: newItem.originalStock || currentTemp[existingIndex].originalStock,
                    currentStock: newItem.currentStock || currentTemp[existingIndex].currentStock
                };
            } else {
                currentTemp.push(newItem);
            }
        });
        // Сохраняем обновленные данные
        await fs.writeFile(TEMP_PRODUCTS_FILE, JSON.stringify(currentTemp, null, 2), 'utf8');
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка обновления временных данных:', err);
        res.status(500).json({ error: 'Ошибка обновления временных данных' });
    }
});

// === API: Удалить заказ ===
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        let orders = JSON.parse(data);
        const order = orders.find(o => o.id === orderId);
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        // Если заказ был в статусе "processing", восстанавливаем остатки
        if (order.status === 'processing') {
            try {
                // Загружаем товары
                const productsData = await fs.readFile(PRODUCTS_FILE, 'utf8');
                let products = JSON.parse(productsData);
                // Загружаем временные данные
                let tempProducts = [];
                try {
                    const tempData = await fs.readFile(TEMP_PRODUCTS_FILE, 'utf8');
                    tempProducts = JSON.parse(tempData);
                } catch (e) {
                    // Игнорируем ошибку - файла не существует
                }
                // Восстанавливаем остатки для каждого товара в заказе
                order.items.forEach(item => {
                    const tempItem = tempProducts.find(t => t.id === item.id && t.orderId === orderId);
                    const productIndex = products.findIndex(p => p.id === item.id);
                    if (productIndex !== -1 && tempItem) {
                        // Восстанавливаем остатки, добавляя обратно заказанное количество
                        const restoredStock = products[productIndex].stock + tempItem.orderedQuantity;
                        products[productIndex].stock = restoredStock;
                        console.log(`Товар ${item.name}: остаток восстановлен с ${products[productIndex].stock - tempItem.orderedQuantity} до ${restoredStock}`);
                    }
                });
                // Сохраняем обновленные товары
                await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));
                // Удаляем временные данные для этого заказа
                tempProducts = tempProducts.filter(t => t.orderId !== orderId);
                await fs.writeFile(TEMP_PRODUCTS_FILE, JSON.stringify(tempProducts, null, 2));
            } catch (e) {
                console.error('Ошибка восстановления остатков при удалении заказа:', e);
            }
        }
        // Удаляем заказ
        orders = orders.filter(o => o.id !== orderId);
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка при удалении заказа:', err);
        res.status(500).json({ error: 'Ошибка при удалении заказа' });
    }
});

// Эндпоинт для запроса кода входа
app.post('/admin/request-login-code', async (req, res) => {
    try {
        const { username } = req.body;
        // Проверяем имя пользователя
        const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
        if (username !== ADMIN_USERNAME) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        // Генерируем код
        const code = generateLoginCode();
        const timestamp = Date.now();
        // Сохраняем код (действителен 5 минут)
        loginCodes.set(code, { username, timestamp, expiresAt: timestamp + 300000 });
        // Отправляем код в Telegram
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
            const message = `🔐 Код для входа в админку: *${code}*
Действителен 5 минут.
Запрошен доступ с IP: ${req.ip}`;
            await sendTelegramMessage(
                process.env.TELEGRAM_BOT_TOKEN,
                process.env.TELEGRAM_ADMIN_CHAT_ID,
                message,
                'Markdown'
            );
            console.log(`✅ Код входа отправлен в Telegram для пользователя ${username}`);
            res.json({ success: true, message: 'Код отправлен в Telegram' });
        } else {
            console.warn('⚠️ Переменные окружения для Telegram не установлены');
            loginCodes.delete(code); // Удаляем код, так как не можем отправить
            res.status(500).json({
                error: 'Сервис аутентификации недоступен. Обратитесь к администратору.'
            });
        }
    } catch (error) {
        console.error('❌ Ошибка запроса кода входа:', error);
        res.status(500).json({ error: 'Ошибка сервера при генерации кода' });
    }
});

// Эндпоинт для проверки кода входа
app.post('/admin/verify-login-code', (req, res) => {
    const { username, code } = req.body;
    const loginData = loginCodes.get(code);
    if (!loginData || loginData.username !== username) {
        return res.status(400).json({ error: 'Неверный код доступа' });
    }
    // Проверяем, не просрочен ли код
    if (Date.now() > loginData.expiresAt) {
        loginCodes.delete(code);
        return res.status(400).json({ error: 'Код просрочен. Запросите новый.' });
    }
    // Успешная аутентификация
    req.session.isAdminAuthenticated = true;
    req.session.adminUser = loginData.username;
    // Удаляем использованный код
    loginCodes.delete(code);
    console.log(`✅ Пользователь ${username} успешно вошел в систему`);
    res.json({ success: true });
});

// Автоматическая очистка просроченных кодов
function cleanupExpiredCodes() {
    const now = Date.now();
    loginCodes.forEach((value, key) => {
        if (now > value.expiresAt) {
            loginCodes.delete(key);
        }
    });
    setTimeout(cleanupExpiredCodes, 60000); // Проверяем каждую минуту
}

// Эндпоинт для запуска update-products.js
app.get('/api/update-products', (req, res) => {
    const scriptPath = path.join(__dirname, 'update-products.js');
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Ошибка выполнения update-products.js: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: `Ошибка при выполнении update-products.js: ${error.message}`
            });
        }
        if (stderr) {
            console.error(`stderr update-products.js: ${stderr}`);
        }
        console.log(`stdout update-products.js: ${stdout}`);
        res.json({
            success: true,
            message: 'Скрипт update-products.js успешно выполнен',
            output: stdout.substring(0, 200) // первые 200 символов вывода
        });
    });
});

// Эндпоинт для запуска sync-products.js
app.get('/api/sync-products', (req, res) => {
    const scriptPath = path.join(__dirname, 'sync-products.js');
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Ошибка выполнения sync-products.js: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: `Ошибка при выполнении sync-products.js: ${error.message}`
            });
        }
        if (stderr) {
            console.error(`stderr sync-products.js: ${stderr}`);
        }
        console.log(`stdout sync-products.js: ${stdout}`);
        res.json({
            success: true,
            message: 'Скрипт sync-products.js успешно выполнен',
            output: stdout.substring(0, 200) // первые 200 символов вывода
        });
    });
});

// Редирект на страницу логина для /admin если не аутентифицирован
app.get('/admin', (req, res) => {
    if (!req.session.isAdminAuthenticated) {
        return res.redirect('/admin/login');
    }
    res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});

// Страница логина
app.get('/admin/login', (req, res) => {
    if (req.session.isAdminAuthenticated) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(ADMIN_DIR, 'login.html'));
});

// Выход из системы
app.post('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
});

// Запуск
const server = app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`🛠 Админка: http://localhost:${PORT}/admin`);
    console.log(`📝 Файл обратной связи будет сохраняться в: ${FEEDBACK_FILE}`);
    console.log(`📥 Папка для Excel файлов: ${INPUT_DIR}`);
    console.log('✅ Скрипты обработки: update-products.js и sync-products.js');
    console.log('ℹ️ Для отладки можно проверить файл update_error.log в папке input');
    console.log(`👥 Файл партнеров: ${PARTNERS_FILE}`);
});

// Запускаем очистку при старте сервера
cleanupExpiredCodes();

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});