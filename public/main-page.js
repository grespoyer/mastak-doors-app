// grespoyer
// Глобальные переменные
let allProducts = [];  // Массив для хранения всех товаров
let visibleCategories = [];  // Массив для хранения видимых категорий
let filters = { category: '', color: '', search: '' };  // Объект для хранения значений фильтров
let viewMode = 'tile'; // tile или list
let lastUpdateDate = '5.12.2025'; // Дата по умолчанию
let tempProducts = []; // Временные данные для товаров "в обработке"
let lastProcessedDate = null; // Дата последней обработки временных данных
// Параметры пагинации
let currentPage = 1;
let itemsPerPage = 24;

// Глобальные переменные для фильтра цены
let priceRange = { min: 1, max: 10000 }; // Будут обновлены динамически
let isDraggingMin = false;
let isDraggingMax = false;
let initialPriceRange = { min: 1, max: 10000 };

let detailedView = true; // По умолчанию подробный вид
// Избранное и корзина
let favorites = [];
let cart = [];
// Статус партнера
let partner = null;
// Флаг для отображения уведомления о заказе сверх остатка
let shownOutOfStockNotification = false;
// Модальное окно детального просмотра
let productDetailModal = null;
// Получаем элементы DOM
const productsContainer = document.getElementById('products');
const categoryFilter = document.getElementById('category-filter');
const colorFilter = document.getElementById('color-filter');
const colorSearchInput = document.getElementById('color-search');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const itemsPerPageSelect = document.getElementById('items-per-page');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfoSpan = document.getElementById('page-info');
const tileViewBtn = document.getElementById('tile-view-btn');
const listViewBtn = document.getElementById('list-view-btn');
const lastUpdateDateEl = document.getElementById('last-update-date');
const feedbackBtn = document.getElementById('feedback-btn');
const feedbackModal = document.getElementById('feedback-modal');
const feedbackForm = document.getElementById('feedback-form');
const feedbackStatus = document.getElementById('feedback-status');
const closeModal = document.querySelector('#feedback-modal .close');
const partnerBtn = document.getElementById('partner-btn');
const logoutBtn = document.getElementById('logout-btn');
const partnerNameEl = document.getElementById('partner-name');
const cartBtn = document.getElementById('cart-btn');
const favoritesBtn = document.getElementById('favorites-btn');
const cartModal = document.getElementById('cart-modal');
const favoritesModal = document.getElementById('favorites-modal');
const cartItemsContainer = document.getElementById('cart-items');
const favoritesItemsContainer = document.getElementById('favorites-items');
const cartTotalEl = document.getElementById('cart-total');
const modalCloseBtns = document.querySelectorAll('.modal .close');
const checkoutBtn = document.getElementById('checkout-btn');
// Инициализация состояния
initUserStorage();
// Инициализация пользовательского хранилища
function initUserStorage() {
    // Пытаемся получить данные партнера из localStorage
    const storedPartner = localStorage.getItem('partner');
    if (storedPartner) {
        partner = JSON.parse(storedPartner);
        // Загружаем данные партнера
        favorites = loadUserData('favorites', []);
        cart = loadUserData('cart', []);
    } else {
        // Для анонимного пользователя создаем уникальный ID сессии
        let sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('sessionId', sessionId);
        }
        // Загружаем данные анонимного пользователя
        favorites = loadUserData('favorites_anon_' + sessionId, []);
        cart = loadUserData('cart_anon_' + sessionId, []);
    }
}
// Загрузка пользовательских данных с учетом типа пользователя
function loadUserData(key, defaultValue) {
    if (partner) {
        return JSON.parse(localStorage.getItem(`partner_${partner.id}_${key}`) || '[]');
    } else {
        const sessionId = localStorage.getItem('sessionId');
        return JSON.parse(localStorage.getItem(`anon_${sessionId}_${key}`) || JSON.stringify(defaultValue));
    }
}
// Сохранение пользовательских данных с учетом типа пользователя
function saveUserData(key, value) {
    if (partner) {
        localStorage.setItem(`partner_${partner.id}_${key}`, JSON.stringify(value));
    } else {
        const sessionId = localStorage.getItem('sessionId');
        localStorage.setItem(`anon_${sessionId}_${key}`, JSON.stringify(value));
    }
}
// Сортировка товаров по умолчанию (дверные полотна вверху, остальное внизу)
function getDefaultSortedProducts(products) {
    // Определяем товары категории "Межкомнатные двери" как дверные полотна
    const doorPanels = products.filter(p => p.category === 'Межкомнатные двери');
    const otherProducts = products.filter(p => p.category !== 'Межкомнатные двери');
    
    // Сортируем дверные полотна по цене (возрастание)
    doorPanels.sort((a, b) => a.price - b.price);
    
    // Сортируем остальные товары по категории и названию
    otherProducts.sort((a, b) => {
        if (a.category !== b.category) {
            // Задаем порядок категорий
            const categoryOrder = ['Деталь короба', 'Наличник', 'Доборный элемент'];
            const aIndex = categoryOrder.indexOf(a.category);
            const bIndex = categoryOrder.indexOf(b.category);
            
            // Если категория не найдена в списке, она идет последней
            if (aIndex === -1 && bIndex === -1) return a.category.localeCompare(b.category);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        }
        // Внутри одной категории сортируем по названию
        return a.name.localeCompare(b.name);
    });
    
    // Объединяем отсортированные массивы
    return [...doorPanels, ...otherProducts];
}
// Функция для отображения товаров с группировкой по названию (режим плитки)
function renderProductsTileView(productGroups) {
    if (productGroups.length === 0) {
        productsContainer.innerHTML = '<p class="no-products">Нет товаров, соответствующих выбранным фильтрам или запросу</p>';
        return;
    }

    productsContainer.innerHTML = productGroups.map(group => {
        const firstProduct = group[0];
        // Сортируем размеры по возрастанию (600, 700, 800, 900)
        const sortedSizes = [...group].sort((a, b) => a.size - b.size);
        // Определяем статус остатка для всей группы
        const hasStockProgram = group.some(p => p.stockProgram === 1);
        const stockStatus = hasStockProgram ? 'СКЛАД' : 'ОСТАТОК';
        const stockStatusClass = hasStockProgram ? 'in-stock' : 'on-balance';
        
        // Генерируем HTML для изображения с обработкой ошибки
        let imageHtml = '';
        if (firstProduct.images && firstProduct.images[0]) {
            imageHtml = `
                <img 
                    src="${firstProduct.images[0]}" 
                    alt="${firstProduct.name}" 
                    class="product-image" 
                    data-group-name="${firstProduct.name}"
                    onerror="this.onerror=null; this.style.display='none'; this.parentElement.querySelector('.placeholder-image').style.display='flex';"
                >
            `;
        }
        
        // Всегда добавляем placeholder
        let placeholderHtml = `
            <div class="placeholder-image" data-group-name="${firstProduct.name}" style="${firstProduct.images && firstProduct.images[0] ? 'display: none;' : 'display: flex;'}">
                Нет фото
            </div>
        `;

        // Проверяем, есть ли товары этой группы в избранном
        const groupInFavorites = favorites.some(f => 
            group.some(p => p.id === f.id)
        );
        
        // Определяем, является ли эта группа "Межкомнатными дверями" для возможности открытия деталей
        const isDoorCategory = group.some(p => 
            p.category === 'Межкомнатные двери' || 
            (p.category && p.category.toLowerCase().includes('двери'))
        );
        
        // Добавляем класс для возможности клика только если это двери
        const clickableClass = isDoorCategory ? 'clickable-product' : '';
        
        // Режим отображения: подробный или компактный
        const viewModeClass = detailedView ? 'detailed-view' : 'compact-view';
        
        if (detailedView) {
            // Формируем HTML для размеров и остатков (подробный режим)
            const sizesHtml = sortedSizes.map(p => {
                const isFavorite = favorites.some(f => f.id === p.id);
                const inCart = cart.find(c => c.id === p.id);
                // Проверяем, не показывали ли мы уже уведомление о возможности заказа сверх остатка
                const showOutOfStockNotice = p.stock <= 0 && !shownOutOfStockNotification;
                let cartButtonsHtml = `
                    <div class="action-buttons">
                        <button class="action-btn favorite-btn ${isFavorite ? 'active' : ''}" 
                                data-id="${p.id}" 
                                title="${isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                            ${isFavorite ? '❤️' : '♡'}
                        </button>
                        <div class="cart-control-container">
                            <button class="action-btn add-to-cart-btn ${p.stock <= 0 ? 'out-of-stock' : ''}" data-id="${p.id}" 
                                    title="${inCart ? 'В корзине' : p.stock <= 0 ? 'Товар под заказ' : 'Добавить в корзину'}">
                                ${inCart ? '✓' : '🛒'}
                            </button>
                            <div class="cart-popup hidden" data-id="${p.id}">
                                <button class="quantity-btn decrease-btn" data-id="${p.id}">-</button>
                                <input type="number" class="quantity-input" value="1" min="1" max="99" data-id="${p.id}">
                                <button class="quantity-btn increase-btn" data-id="${p.id}">+</button>
                                <button class="buy-btn" data-id="${p.id}">Купить</button>
                            </div>
                        </div>
                    </div>
                `;
                let stockDisplay;
                if (p.stock > 0) {
                    stockDisplay = `<span class="stock-quantity available">${p.stock} шт</span>`;
                } else {
                    if (showOutOfStockNotice) {
                        stockDisplay = `
                            <span class="stock-quantity unavailable">Нет в наличии</span>
                        `;
                        shownOutOfStockNotification = true; // Устанавливаем флаг, что уведомление показано
                    } else {
                        stockDisplay = `<span class="stock-quantity unavailable">Нет в наличии</span>`;
                    }
                }
                return `
                    <div class="size-item" data-id="${p.id}">
                        <span class="size-label">${p.size} мм</span>
                        ${stockDisplay}
                        ${cartButtonsHtml}
                    </div>
                `;
            }).join('');
            
            return `
                <div class="product-group ${clickableClass} ${viewModeClass}" data-name="${firstProduct.name}">
                    <div class="stock-status ${stockStatusClass}">${stockStatus}</div>
                    <div class="favorite-status" title="${groupInFavorites ? 'В избранном' : 'Добавить в избранное'}">
                        ${groupInFavorites ? '❤️' : '♡'}
                    </div>
                    <div class="image-container">
                        ${imageHtml}
                        ${placeholderHtml}
                    </div>
                    <h3>${firstProduct.name}</h3>
                    <p class="price">${firstProduct.price.toFixed(2)} ₽</p>
                    <div class="sizes-container">
                        ${sizesHtml}
                    </div>
                </div>
            `;
        } else {
            // Компактный режим: только изображение, название и цена
            return `
                <div class="product-group ${clickableClass} ${viewModeClass}" data-name="${firstProduct.name}">
                    <div class="stock-status ${stockStatusClass}">${stockStatus}</div>
                    <div class="favorite-status" title="${groupInFavorites ? 'В избранном' : 'Добавить в избранное'}">
                        ${groupInFavorites ? '❤️' : '♡'}
                    </div>
                    <div class="image-container full-height">
                        ${imageHtml}
                        ${placeholderHtml}
                    </div>
                    <div class="product-info">
                        <h3>${firstProduct.name}</h3>
                        <p class="price">${firstProduct.price.toFixed(2)} ₽</p>
                    </div>
                </div>
            `;
        }
    }).join('');

    // Добавляем обработчики событий для кнопок после рендеринга
    document.querySelectorAll('.favorite-status').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToFavoriteGroup(btn.parentElement.dataset.name);
        });
    });
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', toggleFavorite);
    });
    
    // Добавляем обработчики для попапов корзины
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.removeEventListener('click', toggleCartPopup);
        btn.addEventListener('click', toggleCartPopup);
    });
    
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.removeEventListener('click', buyProductFromPopup);
        btn.addEventListener('click', buyProductFromPopup);
    });
    
    document.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.removeEventListener('click', decreaseQuantity);
        btn.addEventListener('click', decreaseQuantity);
    });
    
    document.querySelectorAll('.increase-btn').forEach(btn => {
        btn.removeEventListener('click', increaseQuantity);
        btn.addEventListener('click', increaseQuantity);
    });
    
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.removeEventListener('change', updateQuantity);
        input.addEventListener('change', updateQuantity);
    });
    
    // Закрытие попапов при клике вне их
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.cart-control-container')) {
            document.querySelectorAll('.cart-popup').forEach(popup => {
                popup.classList.add('hidden');
            });
        }
    }, { passive: true });
    
    // Добавляем обработчики для всей карточки товара
    document.querySelectorAll('.product-group.clickable-product').forEach(element => {
        element.removeEventListener('click', handleProductImageClick);
        element.addEventListener('click', handleProductImageClick);
    });
    
    // Также добавляем обработчики для изображений и placeholder'ов для совместимости
    document.querySelectorAll('.product-image, .placeholder-image').forEach(element => {
        element.removeEventListener('click', handleProductImageClick);
        element.addEventListener('click', handleProductImageClick);
    });
    
    // Если есть товары с нулевым остатком и мы еще не показали уведомление, показываем его единожды
    if (!shownOutOfStockNotification && document.querySelector('.stock-quantity.unavailable')) {
        showNotification('Некоторые товары доступны только под заказ. Вы можете добавить их в корзину, и мы сообщим о сроках поставки.', 'info', 5000);
        shownOutOfStockNotification = true;
    }
}
// Функция обработки клика по изображению товара
function handleProductImageClick(e) {
    e.stopPropagation();
    const productElement = e.currentTarget.closest('.product-group');
    if (!productElement) return;
    const groupName = productElement.dataset.name;
    if (groupName) {
        // Фильтруем только товары в категории "Межкомнатные двери" или с категорией, содержащей "двери"
        const productGroup = allProducts.filter(p => 
            p.name === groupName && 
            (p.category === 'Межкомнатные двери' || 
             (p.category && p.category.toLowerCase().includes('двери')))
        );
        if (productGroup.length > 0) {
            showProductDetails(productGroup);
        }
    }
}
// Функция для отображения товаров в виде списка
function renderProductsListView(filteredProducts) {
    if (filteredProducts.length === 0) {
        productsContainer.innerHTML = '<p class="no-products">Нет товаров, соответствующих выбранным фильтрам или запросу</p>';
        updatePaginationButtons([]);
        return;
    }
    // Пагинация для режима списка
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    // Сначала сортируем товары по приоритету категорий
    const priorityOrder = [
        'Межкомнатные двери',
        'Деталь короба',
        'Наличник',
        'Доборный элемент'
    ];
    // Группируем товары по категориям
    const categorized = {};
    paginatedProducts.forEach(product => {
        const category = product.category || 'Другое';
        if (!categorized[category]) {
            categorized[category] = [];
        }
        categorized[category].push(product);
    });
    // Сортируем товары в каждой категории
    Object.keys(categorized).forEach(category => {
        if (category === 'Межкомнатные двери') {
            categorized[category].sort((a, b) => a.name.localeCompare(b.name));
        } else {
            categorized[category].sort((a, b) => {
                // Сначала сортируем по имени
                const nameCompare = a.name.localeCompare(b.name);
                if (nameCompare !== 0) return nameCompare;
                // Если имена одинаковые, сортируем по размеру
                return (a.size || 0) - (b.size || 0);
            });
        }
    });
    // Формируем отсортированный массив, сначала приоритетные категории
    const sortedCategories = [...priorityOrder.filter(cat => categorized[cat]), 
                              ...Object.keys(categorized).filter(cat => !priorityOrder.includes(cat)).sort()];
    let html = '';
    sortedCategories.forEach(category => {
        if (!categorized[category] || categorized[category].length === 0) return;
        // Заголовок категории
        html += `<div class="product-list-item category-header">${category}</div>`;
        categorized[category].forEach(product => {
            const stockClass = product.stock > 0 ? 'available' : 'unavailable';
            const stockText = product.stock > 0 ? `${product.stock} шт` : 'Нет в наличии';
            // Проверяем, не показывали ли мы уже уведомление о возможности заказа сверх остатка
            const showOutOfStockNotice = product.stock <= 0 && !shownOutOfStockNotification;
            let displayName = product.name;
            // Статус остатка для фона
            const rowClass = product.stockProgram === 0 ? 'on-balance-row' : '';
            // Кнопки для всех пользователей
            const isFavorite = favorites.some(f => f.id === product.id);
            const inCart = cart.find(c => c.id === product.id);
            let stockInfo = stockText;
            if (showOutOfStockNotice && product.stock <= 0) {
                stockInfo += ' *Под заказ';
                shownOutOfStockNotification = true; // Устанавливаем флаг, что уведомление показано
            }
            let actionButtons = `
                <div class="list-actions">
                    <button class="action-btn favorite-btn ${isFavorite ? 'active' : ''}" 
                            data-id="${product.id}" 
                            title="${isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                        ${isFavorite ? '❤️' : '♡'}
                    </button>
                    <div class="cart-control-container">
                        <button class="action-btn add-to-cart-btn ${product.stock <= 0 ? 'out-of-stock' : ''}" data-id="${product.id}" 
                                title="${inCart ? 'В корзине' : product.stock <= 0 ? 'Товар под заказ' : 'Добавить в корзину'}">
                            ${inCart ? '✅' : '🛒'}
                        </button>
                        <div class="cart-popup hidden" data-id="${product.id}">
                            <button class="quantity-btn decrease-btn" data-id="${product.id}">-</button>
                            <input type="number" class="quantity-input" value="1" min="1" max="99" data-id="${product.id}">
                            <button class="quantity-btn increase-btn" data-id="${product.id}">+</button>
                            <button class="buy-btn" data-id="${product.id}">Купить</button>
                        </div>
                    </div>
                </div>
            `;
            html += `
                <div class="product-list-item ${rowClass}" data-id="${product.id}">
                    <div class="model-name">${displayName}</div>
                    <div class="size-info">${product.size ? `${product.size} мм` : '-'}</div>
                    <div class="price-info">${product.price.toFixed(2)} ₽</div>
                    <div class="stock-info ${stockClass}">${stockInfo}</div>
                    <div class="color-info">${product.color || '-'}</div>
                    ${actionButtons}
                </div>
            `;
        });
    });
    productsContainer.innerHTML = html;
    // Обновляем пагинацию
    updatePaginationButtons(filteredProducts);
    // Добавляем обработчики событий для кнопок после рендеринга
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', toggleFavorite);
    });
    // Добавляем обработчики для попапов корзины
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.removeEventListener('click', toggleCartPopup);
        btn.addEventListener('click', toggleCartPopup);
    });
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.removeEventListener('click', buyProductFromPopup);
        btn.addEventListener('click', buyProductFromPopup);
    });
    document.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.removeEventListener('click', decreaseQuantity);
        btn.addEventListener('click', decreaseQuantity);
    });
    document.querySelectorAll('.increase-btn').forEach(btn => {
        btn.removeEventListener('click', increaseQuantity);
        btn.addEventListener('click', increaseQuantity);
    });
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.removeEventListener('change', updateQuantity);
        input.addEventListener('change', updateQuantity);
    });
    // Закрытие попапов при клике вне их
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.cart-control-container')) {
            document.querySelectorAll('.cart-popup').forEach(popup => {
                popup.classList.add('hidden');
            });
        }
    }, { passive: true });
    // Если есть товары с нулевым остатком и мы еще не показали уведомление, показываем его единожды
    if (!shownOutOfStockNotification && document.querySelector('.stock-info.unavailable')) {
        showNotification('Некоторые товары доступны только под заказ. Вы можете добавить их в корзину, и мы сообщим о сроках поставки.', 'info', 5000);
        shownOutOfStockNotification = true;
    }
}
// Функции для работы с избранным
function toggleFavorite(e) {
    e.stopPropagation();
    const productId = e.target.dataset.id;
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const isFavorite = favorites.some(f => f.id === productId);
    if (isFavorite) {
        favorites = favorites.filter(f => f.id !== productId);
    } else {
        favorites.push({
            id: product.id,
            name: product.name,
            price: product.price,
            size: product.size,
            addedAt: new Date().toISOString()
        });
    }
    saveUserData('favorites', favorites);
    applyFilters(); // Обновляем отображение
    renderFavoritesModal();
}
function addToFavoriteGroup(productName) {
    const productsInGroup = allProducts.filter(p => p.name === productName);
    // Проверяем, есть ли уже товары из этой группы в избранном
    const areAllInFavorites = productsInGroup.every(p => favorites.some(f => f.id === p.id));
    if (areAllInFavorites) {
        // Удаляем все товары группы из избранного
        favorites = favorites.filter(f => !productsInGroup.some(p => p.id === f.id));
    } else {
        // Добавляем все товары группы в избранное
        productsInGroup.forEach(product => {
            if (!favorites.some(f => f.id === product.id)) {
                favorites.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    size: product.size,
                    addedAt: new Date().toISOString()
                });
            }
        });
    }
    saveUserData('favorites', favorites);
    applyFilters();
    renderFavoritesModal();
}
// Функции для работы с корзиной
function addToCart(e) {
    e.stopPropagation();
    const productId = e.target.dataset.id;
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const existingItem = cart.find(item => item.id === productId);
    const quantity = 1; // По умолчанию добавляем 1 товар
    // Проверяем, достаточно ли товара на складе
    if (quantity > product.stock && product.stock > 0) {
        showNotification(`На складе доступно только ${product.stock} шт. остальное будет под заказ`, 'warning', 3000);
    } else if (quantity > product.stock && product.stock <= 0) {
        showNotification(`Товар "${product.name}" будет заказан под заказ. Мы сообщим о сроках поставки.`, 'info', 3000);
    }
    if (existingItem) {
        // Если товар уже в корзине, увеличиваем количество
        const newQuantity = existingItem.quantity + quantity;
        existingItem.quantity = newQuantity;
    } else {
        // Добавляем новый товар в корзину
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            size: product.size,
            quantity: quantity,
            addedAt: new Date().toISOString(),
            isOutOfStock: (product.stock <= 0) // Флаг для товаров под заказ
        });
    }
    saveUserData('cart', cart);
    renderCartModal();
    updateCartCounter();
    applyFilters(); // Обновляем отображение
    // Показываем уведомление
    const sizeText = product.size ? `${product.size} мм` : '';
    const statusText = product.stock <= 0 ? ' (под заказ)' : '';
    showNotification(`Товар "${product.name}" ${sizeText} добавлен в корзину (1 шт.)${statusText}`);
}
function updateCartCounter() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartBtn) {
        cartBtn.innerHTML = `🛒 Корзина (${totalCount})`;
    }
}
// Вспомогательная функция для нормализации текста при поиске (заменяет "ё" на "е")
function normalizeForSearch(text) {
    // Карта преобразования английской раскладки в русскую
    const engToRus = {
        'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ',
        'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д', ';': 'ж', "'": 'э',
        'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю', '/': '.',
        'Q': 'Й', 'W': 'Ц', 'E': 'У', 'R': 'К', 'T': 'Е', 'Y': 'Н', 'U': 'Г', 'I': 'Ш', 'O': 'Щ', 'P': 'З', '{': 'Х', '}': 'Ъ',
        'A': 'Ф', 'S': 'Ы', 'D': 'В', 'F': 'А', 'G': 'П', 'H': 'Р', 'J': 'О', 'K': 'Л', 'L': 'Д', ':': 'Ж', '"': 'Э',
        'Z': 'Я', 'X': 'Ч', 'C': 'С', 'V': 'М', 'B': 'И', 'N': 'Т', 'M': 'Ь', '<': 'Б', '>': 'Ю', '?': '.',
        '~': 'ё', '`': 'ё', '@': '"', '#': '№', '$': ';', '^': ':', '&': '?'
    };
    
    // Сначала преобразуем раскладку
    let convertedText = '';
    for (let char of text) {
        convertedText += engToRus[char] || char;
    }
    
    // Затем применяем остальные преобразования
    let normalized = convertedText.toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/э/g, 'е')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Специальное правило для "неоклассика pro"
    if (normalized.includes('неоклассика про')) {
        normalized = normalized.replace(/неоклассика\s+про/g, 'неоклассика pro');
    }
    
    return normalized;
}
// Функция применения фильтров и поиска (измененная версия)
function applyFilters(resetPage = true) {
    let filtered = [...allProducts];
    
    // Применяем фильтр по цене
    if (priceRange.min > 0 || priceRange.max < initialPriceRange.max) {
        filtered = filtered.filter(product => 
            product.price >= priceRange.min && product.price <= priceRange.max
        );
    }
    
    // Применяем фильтр по категории
    if (filters.category) {
        filtered = filtered.filter(product => product.category === filters.category);
    }
    
    // Применяем фильтр по цвету
    if (filters.color) {
        filtered = filtered.filter(product => product.color === filters.color);
    }
    
    // Применяем поиск по названию (регистронезависимый) с нормализацией "ё" -> "е"
    if (filters.search) {
        const normalizedSearch = normalizeForSearch(filters.search);
        const searchTerms = normalizedSearch.split(/\s+/).filter(term => term.length > 0);
        filtered = filtered.filter(product => {
            const nameNormalized = normalizeForSearch(product.name);
            const itemNormalized = normalizeForSearch(product.item || '');
            return searchTerms.every(term => 
                nameNormalized.includes(term) || itemNormalized.includes(term)
            );
        });
    }
    
    // Фильтруем по видимым категориям (если они заданы)
    if (visibleCategories.length > 0) {
        filtered = filtered.filter(product => {
            // Если категория товара не указана или она в списке игнорируемых, показываем всегда
            if (!product.category || product.category === 'ignore') {
                return true;
            }
            // Иначе проверяем, есть ли категория в списке видимых
            return visibleCategories.includes(product.category);
        });
    }
    
    // Применяем сортировку по умолчанию, если нет других активных сортировок
    if (!filters.sortBy) {
        filtered = getDefaultSortedProducts(filtered);
    }
    
    // В режиме списка рендерим отфильтрованные товары
    if (viewMode === 'list') {
        renderProductsListView(filtered);
        return;
    }
    
    // В режиме плитки группируем товары по name
    const groupedProducts = {};
    filtered.forEach(product => {
        const key = `${product.name}_${product.category}_${product.color}_${product.glass}`; // Уникальный ключ для группировки
        if (!groupedProducts[key]) {
            groupedProducts[key] = [];
        }
        groupedProducts[key].push(product);
    });
    
    // Сбрасываем на первую страницу ТОЛЬКО если это необходимо
    if (resetPage) {
        currentPage = 1;
    }
    
    // Конвертируем объект групп в массив и применяем сортировку по умолчанию для групп
    let productGroups = Object.values(groupedProducts);
    if (!filters.sortBy) {
        // Сортируем группы так, чтобы сначала шли группы, содержащие дверные полотна
        productGroups.sort((a, b) => {
            const aIsDoorPanel = a.some(p => p.category === 'Межкомнатные двери');
            const bIsDoorPanel = b.some(p => p.category === 'Межкомнатные двери');
            
            if (aIsDoorPanel && !bIsDoorPanel) return -1;
            if (!aIsDoorPanel && bIsDoorPanel) return 1;
            
            // Внутри групп "Межкомнатные двери" сортируем по минимальной цене
            if (aIsDoorPanel && bIsDoorPanel) {
                const aMinPrice = Math.min(...a.map(p => p.price));
                const bMinPrice = Math.min(...b.map(p => p.price));
                return aMinPrice - bMinPrice;
            }
            
            // Для остальных групп сортируем по первой категории в группе
            const aCategory = a[0].category || '';
            const bCategory = b[0].category || '';
            
            if (aCategory !== bCategory) {
                const categoryOrder = ['Деталь короба', 'Наличник', 'Доборный элемент'];
                const aIndex = categoryOrder.indexOf(aCategory);
                const bIndex = categoryOrder.indexOf(bCategory);
                
                if (aIndex === -1 && bIndex === -1) return aCategory.localeCompare(bCategory);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            }
            
            return a[0].name.localeCompare(b[0].name);
        });
    }
    
    updatePaginationButtons(productGroups);
    renderPaginatedProducts(productGroups);
    // В конце функции добавьте:
    if (typeof populateColorPalette === 'function') {
        populateColorPalette();
    }
}
// Функция инициализации слайдера цены
function initPriceRangeSlider() {
    const sliderContainer = document.querySelector('.price-range-container');
    if (!sliderContainer) return;
    const slider = sliderContainer.querySelector('.price-range-slider');
    const track = sliderContainer.querySelector('.slider-track');
    const range = sliderContainer.querySelector('.slider-range');
    const minThumb = sliderContainer.querySelector('.min-thumb');
    const maxThumb = sliderContainer.querySelector('.max-thumb');
    const minTooltip = sliderContainer.querySelector('.min-tooltip');
    const maxTooltip = sliderContainer.querySelector('.max-tooltip');
    const minValueEl = sliderContainer.querySelector('.min-value');
    const maxValueEl = sliderContainer.querySelector('.max-value');
    
    // Определяем минимальную и максимальную цены из товаров
    const allPrices = allProducts.map(p => p.price);
    initialPriceRange = {
        min: Math.max(1, Math.floor(Math.min(...allPrices) / 100) * 100), // Гарантируем, что минимум не меньше 1
        max: Math.ceil(Math.max(...allPrices) / 100) * 100  // Округляем до сотен вверх
    };
    
    // Устанавливаем начальные значения
    priceRange = { ...initialPriceRange };
    
    // Обновляем отображение
    updateSliderPosition();
    
    // Обновляем палитру при инициализации
    populateColorPalette();
    
    // Обработчики событий для мыши
    function setupThumbEvents(thumb, isMinThumb) {
        // Обработчики для мыши
        thumb.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (isMinThumb) {
                isDraggingMin = true;
            } else {
                isDraggingMax = true;
            }
            document.body.style.cursor = 'grabbing';
            thumb.classList.add('active');
        });
        
        // Обработчики для тач-устройств
        thumb.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (isMinThumb) {
                isDraggingMin = true;
            } else {
                isDraggingMax = true;
            }
            thumb.classList.add('active');
        }, { passive: false });
    }
    
    setupThumbEvents(minThumb, true);
    setupThumbEvents(maxThumb, false);
    
    // Общая функция для обработки движения (мышь и тач)
    function handleMove(clientX) {
        const rect = slider.getBoundingClientRect();
        const sliderWidth = rect.width;
        const clickX = clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (clickX / sliderWidth) * 100));
        
        if (isDraggingMin) {
            const newMin = Math.round((percent / 100) * (initialPriceRange.max - initialPriceRange.min)) + initialPriceRange.min;
            priceRange.min = Math.max(initialPriceRange.min, Math.min(newMin, priceRange.max - 100));
            showTooltip(minTooltip, priceRange.min);
            positionTooltipAboveThumb(minTooltip, minThumb);
        } else if (isDraggingMax) {
            const newMax = Math.round((percent / 100) * (initialPriceRange.max - initialPriceRange.min)) + initialPriceRange.min;
            priceRange.max = Math.min(initialPriceRange.max, Math.max(newMax, priceRange.min + 100));
            showTooltip(maxTooltip, priceRange.max);
            positionTooltipAboveThumb(maxTooltip, maxThumb);
        }
        
        updateSliderPosition();
    }
    
    // Обработчики для мыши
    document.addEventListener('mousemove', (e) => {
        if (!isDraggingMin && !isDraggingMax) return;
        handleMove(e.clientX);
    });
    
    // Обработчики для тач-устройств
    document.addEventListener('touchmove', (e) => {
        if (!isDraggingMin && !isDraggingMax) return;
        if (e.touches.length > 0) {
            handleMove(e.touches[0].clientX);
        }
    }, { passive: false });
    
    // Общая функция для завершения перетаскивания
    function handleEnd() {
        if (isDraggingMin || isDraggingMax) {
            document.body.style.cursor = 'default';
            minThumb.classList.remove('active');
            maxThumb.classList.remove('active');
            isDraggingMin = false;
            isDraggingMax = false;
            minTooltip.classList.remove('visible');
            maxTooltip.classList.remove('visible');
            applyFilters();
        }
    }
    
    // Обработчики для мыши
    document.addEventListener('mouseup', handleEnd);
    
    // Обработчики для тач-устройств
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    
    // Обработчик клика по треку
    track.addEventListener('click', (e) => {
        handleTrackClick(e, slider, track, minThumb, maxThumb);
    });
    
    // Обработчик тапа по треку для мобильных устройств
    track.addEventListener('touchend', (e) => {
        // Предотвращаем двойное срабатывание на устройствах, поддерживающих и touch, и mouse
        if (e.cancelable) {
            e.preventDefault();
        }
        handleTrackClick(e, slider, track, minThumb, maxThumb, true);
    }, { passive: false });
    
    // Позиционируем tooltip'ы при загрузке
    positionTooltipAboveThumb(minTooltip, minThumb);
    positionTooltipAboveThumb(maxTooltip, maxThumb);
}
// Вспомогательная функция для обработки клика по треку
function handleTrackClick(e, slider, track, minThumb, maxThumb, isTouch = false) {
    const rect = slider.getBoundingClientRect();
    const sliderWidth = rect.width;
    const clickX = isTouch ? e.changedTouches[0].clientX - rect.left : e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (clickX / sliderWidth) * 100));
    const value = Math.round((percent / 100) * (initialPriceRange.max - initialPriceRange.min)) + initialPriceRange.min;
    
    // Определяем, к какому ползунку ближе клик
    const minPercent = ((priceRange.min - initialPriceRange.min) / (initialPriceRange.max - initialPriceRange.min)) * 100;
    const maxPercent = ((priceRange.max - initialPriceRange.min) / (initialPriceRange.max - initialPriceRange.min)) * 100;
    const clickPercent = percent;
    
    if (Math.abs(clickPercent - minPercent) < Math.abs(clickPercent - maxPercent)) {
        priceRange.min = Math.max(initialPriceRange.min, Math.min(value, priceRange.max - 100));
    } else {
        priceRange.max = Math.min(initialPriceRange.max, Math.max(value, priceRange.min + 100));
    }
    
    updateSliderPosition();
    applyFilters();
}
// Функция для позиционирования tooltip точно над ползунком
function positionTooltipAboveThumb(tooltip, thumb) {
    if (!tooltip || !thumb) return;
    
    // Используем requestAnimationFrame для правильного расчета после рендеринга
    requestAnimationFrame(() => {
        const thumbRect = thumb.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const sliderContainer = document.querySelector('.price-range-container');
        
        if (!sliderContainer) return;
        
        const containerRect = sliderContainer.getBoundingClientRect();
        
        // Положение центра ползунка относительно контейнера
        const thumbCenterX = thumbRect.left + (thumbRect.width / 2) - containerRect.left;
        
        // Центрируем tooltip над ползунком
        tooltip.style.left = `${thumbCenterX - (tooltipRect.width / 2)}px`;
    });
}
// Вспомогательная функция для обновления позиции слайдера
function updateSliderPosition() {
    const sliderContainer = document.querySelector('.price-range-container');
    if (!sliderContainer) return;
    
    const range = sliderContainer.querySelector('.slider-range');
    const minThumb = sliderContainer.querySelector('.min-thumb');
    const maxThumb = sliderContainer.querySelector('.max-thumb');
    const minValueEl = sliderContainer.querySelector('.min-value');
    const maxValueEl = sliderContainer.querySelector('.max-value');
    
    const minPercent = ((priceRange.min - initialPriceRange.min) / (initialPriceRange.max - initialPriceRange.min)) * 100;
    const maxPercent = ((priceRange.max - initialPriceRange.min) / (initialPriceRange.max - initialPriceRange.min)) * 100;
    
    range.style.left = `${minPercent}%`;
    range.style.right = `${100 - maxPercent}%`;
    
    minThumb.style.left = `${minPercent}%`;
    maxThumb.style.left = `${maxPercent}%`;
    
    minValueEl.textContent = priceRange.min.toLocaleString('ru');
    maxValueEl.textContent = priceRange.max.toLocaleString('ru');
}

// Показать tooltip со значением
function showTooltip(tooltip, value) {
    // Обновляем текст и форматируем цену с разделителями
    tooltip.innerHTML = `${Math.round(value / 10) * 10}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
    tooltip.classList.add('visible');
    
    // Автоматически позиционируем tooltip точно над ползунком
    requestAnimationFrame(() => {
        const thumbRect = tooltip.parentElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Вычисляем положение для центрирования tooltip над ползунком
        const leftPosition = (thumbRect.width / 2) - (tooltipRect.width / 2);
        tooltip.style.left = `${leftPosition}px`;
    });
}
// Функция отображения пагинированного списка (только для режима плитки)
function renderPaginatedProducts(productGroups) {
    if (viewMode === 'list') {
        return;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedGroups = productGroups.slice(startIndex, endIndex);
    renderProductsTileView(paginatedGroups);
}
// Функция обновления кнопок пагинации
function updatePaginationButtons(items) {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    if (viewMode === 'list') {
        pageInfoSpan.textContent = `Страница ${currentPage} из ${totalPages} (всего товаров: ${items.length})`;
    } else {
        pageInfoSpan.textContent = `Страница ${currentPage} из ${totalPages} (всего групп: ${items.length})`;
    }
}
// Загрузка видимых категорий с сервера
async function loadVisibleCategories() {
    try {
        const response = await fetch('/api/visible-categories');
        if (response.ok) {
            visibleCategories = await response.json();
            // Если файл с видимыми категориями пустой (новая установка), показываем все категории
            if (visibleCategories.length === 0) {
                visibleCategories = [...new Set(allProducts.map(p => p.category).filter(c => c && c !== 'ignore'))];
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки видимых категорий:', error);
        // При ошибке показываем все категории
        visibleCategories = [...new Set(allProducts.map(p => p.category).filter(c => c && c !== 'ignore'))];
    }
}
// Применение временных данных к основным товарам
function applyTempProducts() {
    if (!tempProducts || tempProducts.length === 0) return;
    // Агрегируем заказанные количества по каждому товару
    const aggregatedOrders = {};
    tempProducts.forEach(temp => {
        if (!aggregatedOrders[temp.id]) {
            aggregatedOrders[temp.id] = 0;
        }
        aggregatedOrders[temp.id] += temp.orderedQuantity;
    });
    // Применяем агрегированные данные к товарам
    allProducts.forEach(product => {
        const orderedQuantity = aggregatedOrders[product.id] || 0;
        if (orderedQuantity > 0) {
            // Сохраняем оригинальный остаток для отображения
            product.originalStock = product.stock;
            // Создаем виртуальное поле для отображения количества "под заказ"
            product.orderedQuantity = orderedQuantity;
            // ВАЖНО: больше не уменьшаем фактический остаток здесь
            // product.stock = Math.max(0, product.stock - orderedQuantity);
        }
    });
}
// Загрузка временных данных для товаров под заказ
async function loadTempProducts() {
    try {
        const response = await fetch('/api/temp-products');
        if (response.ok) {
            tempProducts = await response.json();
            lastProcessedDate = localStorage.getItem('lastProcessedDate');
            // Если дата обновления изменилась, обновляем временные данные
            if (lastProcessedDate !== lastUpdateDate) {
                localStorage.setItem('lastProcessedDate', lastUpdateDate);
            }
        } else {
            tempProducts = [];
        }
    } catch (error) {
        console.error('Ошибка загрузки временных данных:', error);
        tempProducts = [];
    }
}
// Загрузка товаров с сервера
async function loadProducts() {
    try {
        // Сначала загружаем дату последнего обновления
        try {
            const updateResponse = await fetch('/api/last-update');
            if (updateResponse.ok) {
                const updateData = await updateResponse.json();
                lastUpdateDate = updateData.date || '5.12.2025';
                lastUpdateDateEl.textContent = `Актуально на вечер: ${lastUpdateDate}`;
                // Сохраняем дату для проверки при следующей загрузке
                localStorage.setItem('siteLastUpdateDate', lastUpdateDate);
            }
        } catch (error) {
            console.error('Ошибка загрузки даты обновления:', error);
        }
        // Загружаем временные данные
        await loadTempProducts();
        // Загружаем основные товары
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error('Ошибка загрузки товаров');
        }
        allProducts = await response.json();
        // Применяем временные данные к товарам (Только для отображения, не для изменения остатков)
        applyTempProducts();
        await loadVisibleCategories();
        populateFilterOptions();
        // Добавляем слайдер цены после загрузки товаров
        addPriceRangeFilter();
        initPriceRangeSlider();
        // После загрузки товаров инициализируем состояние флажка
        const detailedViewCheckbox = document.getElementById('detailed-view-checkbox');
        if (detailedViewCheckbox) {
            detailedView = localStorage.getItem('detailedView') === 'true' || detailedViewCheckbox.checked;
            detailedViewCheckbox.checked = detailedView;
        }
        applyFilters(); // Отображаем все товары по умолчанию
        updateUIBasedOnAuth();
    } catch (error) {
        console.error('Ошибка:', error);
        productsContainer.innerHTML = '<p class="error">Не удалось загрузить товары. Попробуйте позже.</p>';
    }
}
// Обновление интерфейса в зависимости от статуса авторизации
function updateUIBasedOnAuth() {
    if (partner) {
        partnerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        partnerNameEl.textContent = partner.name;
        partnerNameEl.style.display = 'inline';
        partnerNameEl.style.cursor = 'pointer';
        cartBtn.style.display = 'inline-block';
        favoritesBtn.style.display = 'inline-block';
        updateCartCounter();
        // Обновляем профиль партнера
        if (typeof loadPartnerProfile === 'function') {
            loadPartnerProfile();
        }
    } else {
        partnerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        partnerNameEl.style.display = 'none';
        cartBtn.style.display = 'inline-block';
        favoritesBtn.style.display = 'inline-block';
        updateCartCounter();
    }
}
// Рендеринг модального окна корзины
function renderCartModal() {
    if (!cartItemsContainer) return;
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Ваша корзина пуста</p>';
        cartTotalEl.textContent = '0.00';
        return;
    }
    let html = '';
    let total = 0;
    let hasOutOfStockItems = false;
    cart.forEach(item => {
        const product = allProducts.find(p => p.id === item.id);
        const price = item.price * item.quantity;
        total += price;
        // Проверяем, есть ли товары под заказ
        const isOutOfStock = product && product.stock <= 0;
        const maxQuantity = 99; // Устанавливаем разумный максимум, а не ограничиваемся остатками
        const quantityToShow = item.quantity;
        if (isOutOfStock || quantityToShow > product.stock) {
            hasOutOfStockItems = true;
        }
        const stockInfo = isOutOfStock ? 
            '<span class="stock-warning">Товар под заказ</span>' : 
            (quantityToShow > product.stock && product.stock > 0 ? 
                `<span class="stock-warning">${product.stock} шт. в наличии, ${quantityToShow - product.stock} шт. под заказ</span>` : 
                `${quantityToShow} шт. в наличии`);
        html += `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name} ${item.size ? `${item.size} мм` : ''}</div>
                    <div class="cart-item-stock">${stockInfo}</div>
                    <div class="cart-item-price">${item.price.toFixed(2)} ₽ × ${item.quantity} = ${price.toFixed(2)} ₽</div>
                </div>
                <div class="cart-item-actions">
                    <button class="action-btn decrease-btn" data-id="${item.id}">-</button>
                    <input type="number" class="quantity-input cart-quantity" value="${item.quantity}" min="1" max="${maxQuantity}" data-id="${item.id}">
                    <button class="action-btn increase-btn" data-id="${item.id}">+</button>
                    <button class="action-btn remove-btn" data-id="${item.id}" title="Удалить из корзины">×</button>
                </div>
            </div>
        `;
    });
    if (hasOutOfStockItems) {
        html += `
            <div class="cart-notice">
                <p class="notice-warning">⚠️ Некоторые товары будут заказаны под заказ. Мы сообщим вам о сроках поставки после оформления заказа.</p>
            </div>
        `;
    }
    cartItemsContainer.innerHTML = html;
    cartTotalEl.textContent = total.toFixed(2);
    // Добавляем обработчики событий
    document.querySelectorAll('.cart-item .decrease-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const input = document.querySelector(`.cart-quantity[data-id="${id}"]`);
            let quantity = parseInt(input.value) || 1;
            if (quantity > 1) {
                quantity--;
                input.value = quantity;
                updateCartItemQuantity(id, quantity);
            }
        });
    });
    document.querySelectorAll('.cart-item .increase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const input = document.querySelector(`.cart-quantity[data-id="${id}"]`);
            let quantity = parseInt(input.value) || 1;
            const product = allProducts.find(p => p.id === id);
            // Проверяем, достаточно ли товара на складе
            const actualStock = product ? product.stock : 0;
            if (quantity >= actualStock && actualStock > 0) {
                showNotification(`На складе доступно только ${actualStock} шт. остальное будет под заказ`, 'warning', 3000);
            } else if (quantity >= actualStock && actualStock <= 0) {
                if (!document.querySelector('.cart-notice')) {
                    showNotification(`Товар будет заказан под заказ. Мы сообщим о сроках поставки.`, 'info', 3000);
                }
            }
            quantity++;
            input.value = quantity;
            updateCartItemQuantity(id, quantity);
        });
    });
    document.querySelectorAll('.cart-item .quantity-input').forEach(input => {
        input.addEventListener('change', (e) => {
            e.stopPropagation();
            const id = input.dataset.id;
            let quantity = parseInt(input.value) || 1;
            const product = allProducts.find(p => p.id === id);
            // Проверяем лимиты количества
            if (quantity < 1) quantity = 1;
            if (quantity > 99) quantity = 99;
            input.value = quantity;
            updateCartItemQuantity(id, quantity);
        });
        // Добавляем обработчик для нажатия Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                const id = input.dataset.id;
                let quantity = parseInt(input.value) || 1;
                if (quantity < 1) quantity = 1;
                if (quantity > 99) quantity = 99;
                input.value = quantity;
                updateCartItemQuantity(id, quantity);
            }
        });
    });
    document.querySelectorAll('.cart-item .remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            cart = cart.filter(item => item.id !== id);
            saveUserData('cart', cart);
            renderCartModal();
            updateCartCounter();
            applyFilters(false);
        });
    });
}
// Рендеринг модального окна избранного
function renderFavoritesModal() {
    if (!favoritesItemsContainer) return;
    if (favorites.length === 0) {
        favoritesItemsContainer.innerHTML = '<p class="empty-favorites">Список избранного пуст</p>';
        return;
    }
    let html = '';
    favorites.forEach(item => {
        const isCart = cart.some(c => c.id === item.id);
        html += `
            <div class="favorite-item" data-id="${item.id}">
                <div class="favorite-item-info">
                    <div class="favorite-item-name">${item.name} ${item.size ? `${item.size} мм` : ''}</div>
                    <div class="favorite-item-price">${item.price.toFixed(2)} ₽</div>
                </div>
                <div class="favorite-item-actions">
                    <button class="action-btn add-to-cart-btn favorite-add-to-cart" data-id="${item.id}" title="${isCart ? 'Уже в корзине' : 'Добавить в корзину'}">
                        ${isCart ? '✅' : '🛒'}
                    </button>
                    <button class="action-btn remove-favorite-btn" data-id="${item.id}" title="Убрать из избранного">×</button>
                </div>
            </div>
        `;
    });
    favoritesItemsContainer.innerHTML = html;
    // Добавляем обработчики событий
    document.querySelectorAll('.favorite-add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (!cart.some(c => c.id === id)) {
                const product = allProducts.find(p => p.id === id);
                if (product) {
                    addToCartDirectly(id, 1);
                }
            }
        });
    });
    document.querySelectorAll('.remove-favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            favorites = favorites.filter(f => f.id !== id);
            saveUserData('favorites', favorites);
            renderFavoritesModal();
            applyFilters(); // Обновляем отображение
        });
    });
}
// Прямое добавление в корзину
function addToCartDirectly(productId, quantity) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const existingItem = cart.find(item => item.id === productId);
    const isOutOfStock = quantity > product.stock;
    // Проверяем, достаточно ли товара на складе
    const actualStock = product.stock;
    if (quantity > actualStock && actualStock > 0) {
        showNotification(`На складе доступно только ${actualStock} шт. остальное будет под заказ`, 'warning', 3000);
    } else if (quantity > actualStock && actualStock <= 0) {
        showNotification(`Товар "${product.name}" будет заказан под заказ. Мы сообщим о сроках поставки.`, 'info', 3000);
    }
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.isOutOfStock = isOutOfStock || existingItem.isOutOfStock;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            size: product.size,
            quantity: quantity,
            addedAt: new Date().toISOString(),
            isOutOfStock: isOutOfStock
        });
    }
    if (isOutOfStock && quantity > actualStock) {
        showNotification(`Товар будет частично заказан под заказ. Мы сообщим о сроках поставки.`, 'info', 5000);
    }
    saveUserData('cart', cart);
    renderCartModal();
    updateCartCounter();
    applyFilters(false); // Обновляем отображение
    // Показываем уведомление
    const sizeText = product.size ? `${product.size} мм` : '';
    const quantityText = quantity > 1 ? `${quantity} шт.` : '1 шт.';
    const statusText = isOutOfStock ? ' (под заказ)' : '';
    showNotification(`Товар "${product.name}" ${sizeText} добавлен в корзину (${quantityText})${statusText}`);
}
// Функция входа партнера
async function loginPartner(username, password) {
    try {
        const response = await fetch('/api/partner/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) {
            const data = await response.json();
            partner = {
                id: data.id,
                name: data.name,
                username: data.username
            };
            localStorage.setItem('partner', JSON.stringify(partner));
            // Загружаем данные партнера
            favorites = loadUserData('favorites', []);
            cart = loadUserData('cart', []);
            updateUIBasedOnAuth();
            applyFilters();
            return true;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка входа');
        }
    } catch (error) {
        console.error('Ошибка входа партнера:', error);
        return false;
    }
}
// Функция выхода партнера
function logoutPartner() {
    partner = null;
    localStorage.removeItem('partner');
    // Очищаем данные текущего пользователя
    favorites = [];
    cart = [];
    // Инициализируем новое хранилище для анонимного пользователя
    initUserStorage();
    updateUIBasedOnAuth();
    applyFilters();
}
// Функция обновления количества товара в корзине
function updateCartItemQuantity(productId, quantity) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        const product = allProducts.find(p => p.id === productId);
        const actualStock = product ? product.stock : 0;
        // Проверяем, достаточно ли товара на складе
        if (quantity > actualStock && actualStock > 0) {
            showNotification(`На складе доступно только ${actualStock} шт. остальное будет под заказ`, 'warning', 3000);
        } else if (quantity > actualStock && actualStock <= 0) {
            if (!cartItem.isOutOfStock) {
                showNotification(`Товар будет заказан под заказ. Мы сообщим о сроках поставки.`, 'info', 3000);
                cartItem.isOutOfStock = true;
            }
        }
        cartItem.quantity = quantity;
        if (quantity <= 0) {
            cart = cart.filter(item => item.id !== productId);
        }
    } else if (quantity > 0) {
        const product = allProducts.find(p => p.id === productId);
        if (product) {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                size: product.size,
                quantity: quantity,
                addedAt: new Date().toISOString(),
                isOutOfStock: (quantity > product.stock) // Флаг для товаров под заказ
            });
        }
    }
    saveUserData('cart', cart);
    renderCartModal();
    updateCartCounter();
    applyFilters(); // Обновляем отображение кнопок
}
// Функция показа уведомления
// grespoyer
function showNotification(message, type = 'success', duration = 3000) {
    const notificationsContainer = document.getElementById('notifications-container');
    if (!notificationsContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const iconMap = {
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'info': 'ℹ️'
    };
    
    const icon = iconMap[type] || 'ℹ️';
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icon}</span>
            <div class="notification-message">${message}</div>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    notificationsContainer.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Автоматическое закрытие
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
    
    // Обработчик закрытия
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
}
// Функция закрытия уведомления
function closeNotification(notification) {
    // Анимация исчезания
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    // Удаление элемента после анимации
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}
// Функция для добавления товара в корзину из выпадающего окна с кнопкой "Купить"
function buyProductFromPopup(e) {
    e.stopPropagation();
    const button = e.target.closest('button');
    const productId = button.dataset.id;
    // Ищем input внутри того же cart-popup, где находится кнопка
    const cartPopup = button.closest('.cart-popup');
    const input = cartPopup.querySelector('.quantity-input');
    if (!input) return;
    const quantity = parseInt(input.value) || 1;
    
    // Меняем кнопку на "Готово"
    button.textContent = 'Готово';
    button.classList.add('added');
    
    // Добавляем товар в корзину
    addToCartDirectly(productId, quantity);
    
    // Сбрасываем текст кнопки через 2 секунды
    setTimeout(() => {
        button.textContent = 'Купить';
        button.classList.remove('added');
    }, 2000);
}
// Инициализация обработчиков событий
function initEventListeners() {
    // Инициализация модального окна детального просмотра
    initProductDetailModal();
    // Начальные обработчики фильтров
    initFilterEventListeners();
    // Пагинация
    itemsPerPageSelect.addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1; // Всегда начинаем с первой страницы при изменении количества
        applyFilters();
    });
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            if (viewMode === 'tile') {
                const productGroups = getFilteredGroups();
                updatePaginationButtons(productGroups);
                renderPaginatedProducts(productGroups);
            } else {
                applyFilters();
            }
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (viewMode === 'tile') {
            const productGroups = getFilteredGroups();
            const totalPages = Math.ceil(productGroups.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                updatePaginationButtons(productGroups);
                renderPaginatedProducts(productGroups);
            }
        } else {
            const items = getFilteredProducts();
            const totalPages = Math.ceil(items.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                applyFilters();
            }
        }
    });
    const detailedViewCheckbox = document.getElementById('detailed-view-checkbox');
    if (detailedViewCheckbox) {
        detailedViewCheckbox.addEventListener('change', (e) => {
            detailedView = e.target.checked;
            applyFilters(false); // Не сбрасываем страницу при переключении режима
        });
    }
    // Переключение режима отображения
    tileViewBtn.addEventListener('click', () => {
        setViewMode('tile');
    });
    listViewBtn.addEventListener('click', () => {
        setViewMode('list');
    });
    // Обратная связь
    feedbackBtn.addEventListener('click', () => {
        feedbackModal.classList.remove('hidden');
    });
    closeModal.addEventListener('click', () => {
        feedbackModal.classList.add('hidden');
    });
    // Отправка формы обратной связи
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = document.getElementById('feedback-message').value.trim();
        const email = document.getElementById('feedback-email').value.trim();
        if (!message || message.length < 5) {
            feedbackStatus.textContent = '❌ Сообщение должно содержать минимум 5 символов';
            feedbackStatus.className = 'message error';
            feedbackStatus.classList.remove('hidden');
            return;
        }
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    email: email || null
                })
            });
            if (response.ok) {
                feedbackStatus.textContent = '✅ Спасибо за ваше сообщение! Мы обязательно рассмотрим его.';
                feedbackStatus.className = 'message success';
                feedbackStatus.classList.remove('hidden');
                feedbackForm.reset();
                setTimeout(() => {
                    feedbackModal.classList.add('hidden');
                    feedbackStatus.classList.add('hidden');
                }, 2000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка отправки сообщения');
            }
        } catch (error) {
            console.error('Ошибка отправки обратной связи:', error);
            feedbackStatus.textContent = `❌ ${error.message}. Попробуйте позже.`;
            feedbackStatus.className = 'message error';
            feedbackStatus.classList.remove('hidden');
        }
    });
    // Обработчики для партнера
    if (partnerBtn) {
        partnerBtn.addEventListener('click', () => {
            const username = prompt('Введите логин партнера:');
            const password = prompt('Введите пароль партнера:');
            if (username && password) {
                loginPartner(username, password).then(success => {
                    if (!success) {
                        alert('Неверный логин или пароль. Попробуйте снова.');
                    }
                });
            }
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutPartner);
    }
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            renderCartModal();
            cartModal.classList.remove('hidden');
        });
    }
    if (favoritesBtn) {
        favoritesBtn.addEventListener('click', () => {
            renderFavoritesModal();
            favoritesModal.classList.remove('hidden');
        });
    }
    // Закрытие модальных окон
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.add('hidden');
        });
    });
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });
    // Обработка нажатия Enter в форме обратной связи
    const feedbackMessage = document.getElementById('feedback-message');
    if (feedbackMessage) {
        feedbackMessage.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                feedbackForm.requestSubmit();
            }
        });
    }
    // Обработчик для кнопки "Оформить заказ"
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Ваша корзина пуста. Добавьте товары перед оформлением заказа.');
                return;
            }
            // Проверяем, есть ли товары под заказ
            const outOfStockItems = cart.filter(item => {
                const product = allProducts.find(p => p.id === item.id);
                return product && product.stock < item.quantity;
            });
            if (outOfStockItems.length > 0) {
                const confirmMessage = `В вашей корзине есть товары под заказ:\n\n` + 
                    outOfStockItems.map(item => `- ${item.name} (${item.quantity} шт.)`).join('\n') + 
                    `\n\nМы сообщим вам о сроках поставки после оформления заказа. Продолжить оформление?`;
                
                if (!confirm(confirmMessage)) {
                    return;
                }
            }
            // Проверяем, авторизован ли пользователь как партнер
            if (partner) {
                // Для партнера показываем форму с минимальными реквизитами
                showOrderForm(true);
            } else {
                // Для розничного покупателя показываем полную форму с реквизитами
                showOrderForm(false);
            }
        });
    }
    // Обработчик клика на имя партнера для открытия кабинета
    if (partnerNameEl) {
        partnerNameEl.addEventListener('click', () => {
            if (partner && typeof showPartnerCabinet === 'function') {
                showPartnerCabinet();
            }
        });
    }
}
// Показ формы оформления заказа
function showOrderForm(isPartner) {
    const orderModal = document.createElement('div');
    orderModal.className = 'modal';
    // Инициализируем переменные для данных партнера
    let defaultCustomerName = '';
    let defaultEmail = '';
    let defaultPhone = '';
    // Если есть партнер и его профиль загружен, используем его данные
    if (isPartner && typeof partnerProfile !== 'undefined' && partnerProfile) {
        defaultCustomerName = partnerProfile.contactPerson || partner.name || '';
        defaultEmail = partnerProfile.email || '';
        defaultPhone = partnerProfile.phone || '';
    }
    
    // Создаем разную форму в зависимости от типа пользователя
    let formHtml = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>${isPartner ? 'Оформление заказа для партнера' : 'Оформление заказа'}</h2>
            <form id="order-form">
                <div class="form-group">
                    <label for="customer-name">ФИО клиента *</label>
                    <input type="text" id="customer-name" name="customer-name" value="${defaultCustomerName}" required>
                </div>
    `;
    
    if (isPartner) {
        // Форма для партнера: запрашиваем email вместо телефона
        formHtml += `
                <div class="form-group">
                    <label for="email">Email для связи *</label>
                    <input type="email" id="email" name="email" value="${defaultEmail}" required>
                </div>
                <div class="form-group">
                    <label for="comments">Комментарии</label>
                    <textarea id="comments" name="comments"></textarea>
                </div>
        `;
    } else {
        // Форма для розничного покупателя (без изменений)
        formHtml += `
                <div class="form-group">
                    <label for="phone">Телефон *</label>
                    <input type="tel" id="phone" name="phone" value="${defaultPhone}" required>
                </div>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" value="${defaultEmail}">
                </div>
                <div class="form-group">
                    <label for="address">Адрес доставки *</label>
                    <textarea id="address" name="address" required></textarea>
                </div>
                <div class="form-group">
                    <label for="comments">Комментарии</label>
                    <textarea id="comments" name="comments"></textarea>
                </div>
        `;
    }
    
    formHtml += `
                <div class="form-notice">
                    <p>Товары, которые отсутствуют на складе, будут заказаны под заказ. Мы сообщим вам о сроках поставки.</p>
                </div>
                <button type="submit" class="checkout-btn">Отправить заказ</button>
            </form>
            <div id="order-status" class="message hidden"></div>
        </div>
    `;
    
    orderModal.innerHTML = formHtml;
    document.body.appendChild(orderModal);
    
    // Обработчики для модального окна заказа
    const closeBtn = orderModal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        orderModal.remove();
    });
    orderModal.addEventListener('click', (e) => {
        if (e.target === orderModal) {
            orderModal.remove();
        }
    });
    
    const orderForm = orderModal.querySelector('#order-form');
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Валидация полей
        const customerName = document.getElementById('customer-name').value.trim();
        if (!customerName) {
            alert('Пожалуйста, укажите ФИО клиента');
            return;
        }
        
        let phone = '';
        let email = '';
        let address = '';
        
        if (isPartner) {
            // Для партнера валидируем email
            email = document.getElementById('email').value.trim();
            if (!email) {
                alert('Пожалуйста, укажите email для связи');
                return;
            }
            if (!/\S+@\S+\.\S+/.test(email)) {
                alert('Пожалуйста, введите корректный email');
                return;
            }
        } else {
            // Для обычных клиентов валидируем телефон и адрес
            phone = document.getElementById('phone').value.trim();
            if (!phone) {
                alert('Пожалуйста, укажите телефон');
                return;
            }
            
            email = document.getElementById('email').value.trim();
            address = document.getElementById('address').value.trim();
            if (!address) {
                alert('Пожалуйста, укажите адрес доставки');
                return;
            }
        }
        
        // Собираем данные формы
        const formData = {
            customerName: customerName,
            // Для партнера телефон не обязателен, поэтому оставляем пустым или используем значение из профиля
            phone: isPartner ? (defaultPhone || '') : phone,
            email: email,
            // Для партнера адрес не обязателен
            address: isPartner ? 'Не требуется' : address,
            comments: document.getElementById('comments').value.trim(),
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                size: item.size,
                price: item.price,
                quantity: item.quantity,
                itemNumber: allProducts.find(p => p.id === item.id)?.item || '',
                isOutOfStock: item.quantity > (allProducts.find(p => p.id === item.id)?.stock || 0)
            })),
            total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            isPartner: isPartner,
            partnerId: isPartner ? partner.id : null,
            status: 'new' // Новый заказ
        };
        
        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const statusEl = document.getElementById('order-status');
            if (response.ok) {
                const data = await response.json();
                statusEl.textContent = isPartner ? 
                    `✅ Заказ успешно оформлен! Номер заказа: ${data.orderId}. Наш менеджер свяжется с вами по email для подтверждения заказа.` :
                    `✅ Заказ успешно оформлен! Номер заказа: ${data.orderId}. Ожидайте звонка менеджера для подтверждения реквизитов и оплаты.`;
                statusEl.className = 'message success';
                statusEl.classList.remove('hidden');
                
                // Очищаем корзину
                cart = [];
                saveUserData('cart', cart);
                updateCartCounter();
                applyFilters();
                
                // Закрываем модальное окно корзины
                if (cartModal) cartModal.classList.add('hidden');
                
                // Обновляем заказы партнера, если таковой имеется
                if (partner && typeof window.refreshPartnerOrders === 'function') {
                    window.refreshPartnerOrders();
                }
                
                // Закрываем форму заказа через 3 секунды
                setTimeout(() => {
                    orderModal.remove();
                }, 3000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка оформления заказа: ' + response.status);
            }
        } catch (error) {
            console.error('Ошибка оформления заказа:', error);
            const statusEl = document.getElementById('order-status');
            statusEl.textContent = `❌ ${error.message || 'Неизвестная ошибка'}. Попробуйте позже.`;
            statusEl.className = 'message error';
            statusEl.classList.remove('hidden');
        }
    });
}
// Установка режима отображения
function setViewMode(mode) {
    viewMode = mode;
    tileViewBtn.classList.toggle('active', mode === 'tile');
    listViewBtn.classList.toggle('active', mode === 'list');
    // Обновляем классы контейнера
    productsContainer.className = '';
    productsContainer.classList.add(mode === 'tile' ? 'tile-view' : 'list-view');
    // Применяем фильтры для обновления отображения
    applyFilters();
}
// Вспомогательная функция для получения отфильтрованных групп товаров
function getFilteredGroups() {
    let filtered = [...allProducts];
    
    // Применяем фильтр по цене
    if (priceRange.min > 0 || priceRange.max < initialPriceRange.max) {
        filtered = filtered.filter(product => 
            product.price >= priceRange.min && product.price <= priceRange.max
        );
    }
    
    // Применяем фильтр по категории
    if (filters.category) {
        filtered = filtered.filter(product => product.category === filters.category);
    }
    
    // Применяем фильтр по цвету
    if (filters.color) {
        filtered = filtered.filter(product => product.color === filters.color);
    }
    
    // Применяем поиск по названию (регистронезависимый) с нормализацией "ё" -> "е"
    if (filters.search) {
        const normalizedSearch = normalizeForSearch(filters.search);
        const searchTerms = normalizedSearch.split(/\s+/).filter(term => term.length > 0);
        filtered = filtered.filter(product => {
            const nameNormalized = normalizeForSearch(product.name);
            const itemNormalized = normalizeForSearch(product.item || '');
            return searchTerms.every(term => 
                nameNormalized.includes(term) || itemNormalized.includes(term)
            );
        });
    }
    
    // Фильтруем по видимым категориям (если они заданы)
    if (visibleCategories.length > 0) {
        filtered = filtered.filter(product => {
            // Если категория товара не указана или она в списке игнорируемых, показываем всегда
            if (!product.category || product.category === 'ignore') {
                return true;
            }
            // Иначе проверяем, есть ли категория в списке видимых
            return visibleCategories.includes(product.category);
        });
    }
    
    // Группируем товары по уникальному ключу
    const groupedProducts = {};
    filtered.forEach(product => {
        const key = `${product.name}_${product.category}_${product.color}_${product.glass}`; // Уникальный ключ для группировки
        if (!groupedProducts[key]) {
            groupedProducts[key] = [];
        }
        groupedProducts[key].push(product);
    });
    
    // Применяем сортировку по умолчанию для групп
    let productGroups = Object.values(groupedProducts);
    if (!filters.sortBy) {
        // Сортируем группы так, чтобы сначала шли группы, содержащие дверные полотна
        productGroups.sort((a, b) => {
            const aIsDoorPanel = a.some(p => p.category === 'Межкомнатные двери');
            const bIsDoorPanel = b.some(p => p.category === 'Межкомнатные двери');
            if (aIsDoorPanel && !bIsDoorPanel) return -1;
            if (!aIsDoorPanel && bIsDoorPanel) return 1;
            // Внутри групп дверных полотен сортируем по минимальной цене
            if (aIsDoorPanel && bIsDoorPanel) {
                const aMinPrice = Math.min(...a.map(p => p.price));
                const bMinPrice = Math.min(...b.map(p => p.price));
                return aMinPrice - bMinPrice;
            }
            // Для остальных групп сортируем по первой категории в группе
            const aCategory = a[0].category || '';
            const bCategory = b[0].category || '';
            if (aCategory !== bCategory) {
                const categoryOrder = ['Деталь короба', 'Наличник', 'Доборный элемент'];
                const aIndex = categoryOrder.indexOf(aCategory);
                const bIndex = categoryOrder.indexOf(bCategory);
                if (aIndex === -1 && bIndex === -1) return aCategory.localeCompare(bCategory);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            }
            return a[0].name.localeCompare(b[0].name);
        });
    }
    
    return productGroups;
}
// Вспомогательная функция для получения отфильтрованных товаров
function getFilteredProducts() {
    let filtered = [...allProducts];
    // Применяем фильтр по категории
    if (filters.category) {
        filtered = filtered.filter(product => product.category === filters.category);
    }
    // Применяем фильтр по цвету
    if (filters.color) {
        filtered = filtered.filter(product => product.color === filters.color);
    }
    // Применяем поиск с нормализацией "ё" -> "е"
    if (filters.search) {
        const normalizedSearch = normalizeForSearch(filters.search);
        filtered = filtered.filter(product => 
            normalizeForSearch(product.name).includes(normalizedSearch) || 
            (product.item && normalizeForSearch(product.item).includes(normalizedSearch))
        );
    }
    // Фильтруем по видимым категориям
    if (visibleCategories.length > 0) {
        filtered = filtered.filter(product => {
            if (!product.category || product.category === 'ignore') {
                return true;
            }
            return visibleCategories.includes(product.category);
        });
    }
    return filtered;
}
function toggleCartPopup(e) {
    e.stopPropagation();
    const productId = e.target.dataset.id;
    const cartControl = e.target.closest('.cart-control-container');
    if (!cartControl) return;
    const popup = cartControl.querySelector('.cart-popup');
    if (!popup) return;
    // Закрываем все другие попапы
    document.querySelectorAll('.cart-popup').forEach(p => {
        if (p !== popup) p.classList.add('hidden');
    });
    // Переключаем видимость текущего попапа
    popup.classList.toggle('hidden');
}
function handleQuantityInputKeydown(e) {
    if (e.key === 'Enter') {
        e.stopPropagation();
        updateQuantity(e);
    }
}
function decreaseQuantity(e) {
    e.stopPropagation();
    const cartPopup = e.target.closest('.cart-popup');
    if (!cartPopup) return;
    const input = cartPopup.querySelector('.quantity-input');
    if (!input) return;
    const productId = input.dataset.id;
    let quantity = parseInt(input.value) || 1;
    if (quantity > 1) {
        quantity--;
        input.value = quantity;
    }
}
// Заменить increaseQuantity():
function increaseQuantity(e) {
    e.stopPropagation();
    const cartPopup = e.target.closest('.cart-popup');
    if (!cartPopup) return;
    const input = cartPopup.querySelector('.quantity-input');
    if (!input) return;
    const productId = input.dataset.id;
    let quantity = parseInt(input.value) || 1;
    const product = allProducts.find(p => p.id === productId);
    // Убираем ограничение по остатку, устанавливаем разумный максимум
    const maxQuantity = 99; // Вместо product.stock
    if (quantity < maxQuantity) {
        quantity++;
        input.value = quantity;
        // Добавляем уведомление, если превышаем остаток
        if (product && product.stock >= 0 && quantity > product.stock) {
            showNotification(`Внимание: ${quantity - product.stock} шт. будет заказано под заказ`, 'warning', 3000);
        }
    }
}
// Аналогично для updateQuantity():
function updateQuantity(e) {
    e.stopPropagation();
    const input = e.target;
    const productId = input.dataset.id;
    let quantity = parseInt(input.value) || 1;
    const product = allProducts.find(p => p.id === productId);
    if (quantity < 1) quantity = 1;
    if (quantity > 99) quantity = 99; // Вместо maxQuantity = product.stock
    input.value = quantity;
    // Добавляем уведомление при превышении остатка
    if (product && product.stock >= 0 && quantity > product.stock) {
        showNotification(`Внимание: ${quantity - product.stock} шт. будет заказано под заказ`, 'warning', 3000);
    }
}
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadProducts();
    // Устанавливаем начальный режим отображения
    setViewMode('tile');
    updateUIBasedOnAuth();
    updateCartCounter();
});