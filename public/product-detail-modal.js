// Инициализация модального окна детального просмотра
function initProductDetailModal() {
    // Создаем модальное окно, если его нет
    productDetailModal = document.createElement('div');
    productDetailModal.id = 'product-detail-modal';
    productDetailModal.className = 'modal hidden';
    productDetailModal.innerHTML = `
        <div class="modal-content product-detail-content">
            <span class="close">&times;</span>
            <div class="product-detail-container">
                <div class="product-main">
                    <div class="product-images">
                        <img id="detail-product-image" src="" alt="" class="detail-image">
                        <div id="detail-placeholder" class="placeholder-image-large" style="display: none;">Нет фото</div>
                    </div>
                    <div class="product-info">
                        <h2 id="detail-product-name"></h2>
                        <p class="detail-price" id="detail-product-price"></p>
                        <div class="detail-sizes-table">
                            <div class="table-header">
                                <div class="table-cell size-header">Размер</div>
                                <div class="table-cell price-header">Цена</div>
                                <div class="table-cell item-header">Артикул</div>
                                <div class="table-cell stock-header">Остаток</div>
                                <div class="table-cell actions-header"></div>
                            </div>
                            <div id="detail-sizes-container" class="table-body"></div>
                        </div>
                    </div>
                </div>
                <div class="trim-items">
                    <h3>Погонаж в этом цвете</h3>
                    <div id="trim-items-list">
                        <!-- Элементы погонажа будут добавлены динамически -->
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(productDetailModal);
    // Добавляем обработчики событий для закрытия модального окна
    const closeModalBtn = productDetailModal.querySelector('.close');
    closeModalBtn.addEventListener('click', () => {
        productDetailModal.classList.add('hidden');
    });
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (e) => {
        if (e.target === productDetailModal) {
            productDetailModal.classList.add('hidden');
        }
    });
}
// Функция поиска погонажа по цвету
function findTrimItemsByColor(color, excludeName = '') {
    if (!color) return [];
    const trimCategories = [
        'Погонаж телескопический',
        'Погонаж простой',
        'Декор',
        'Плинтус'
    ];
    
    // Сначала находим все товары в нужных категориях с нужным цветом
    let result = allProducts.filter(product => {
        if (product.name === excludeName) return false;
        if (!trimCategories.includes(product.category)) return false;
        return product.color === color;
    });
    
    // Проверяем, есть ли в категории "Погонаж телескопический" товары кроме соединительной планки
    const telecopicItems = result.filter(item => 
        item.category === "Погонаж телескопический" && 
        item.name !== "Соединительная планка для доборных элементов без покрытия"
    );
    
    // Дополнительные товары, которые должны быть добавлены в определенные категории
    const specialItems = [
        {
            name: "Соединительная планка для доборных элементов без покрытия",
            targetCategory: "Погонаж телескопический",
            shouldAdd: telecopicItems.length > 0 // Добавлять только если есть другие телескопические элементы
        },
        {
            name: "Крепление Clipstar для плинтуса Tarkett",
            targetCategory: "Плинтус"
        }
    ];
    
    specialItems.forEach(specialItem => {
        // Для соединительной планки проверяем условие
        if (specialItem.name === "Соединительная планка для доборных элементов без покрытия" && !specialItem.shouldAdd) {
            return; // Не добавляем если нет других телескопических элементов
        }
        
        // Проверяем, нет ли уже такого товара в результате
        const alreadyExists = result.some(item => item.name === specialItem.name && item.color === color);
        if (alreadyExists) return;
        
        // Ищем специальный товар по имени, независимо от категории
        const foundItem = allProducts.find(item => item.name === specialItem.name);
        if (foundItem) {
            // Клонируем объект, чтобы не изменять исходные данные
            const clonedItem = {...foundItem};
            // Устанавливаем цвет для соответствия основному товару
            clonedItem.color = color;
            // Устанавливаем категорию для правильной группировки
            clonedItem.category = specialItem.targetCategory;
            result.push(clonedItem);
        }
    });
    
    return result;
}
function handleTrimGroupClick(e) {
    e.stopPropagation();
    const header = this;
    const group = header.closest('.trim-group');
    const content = group.querySelector('.trim-group-content');
    
    // Переключаем состояние expanded
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        header.querySelector('.expand-icon').textContent = '+';
        header.classList.remove('active');
    } else {
        content.classList.add('expanded');
        header.querySelector('.expand-icon').textContent = '-';
        header.classList.add('active');
    }
    
    // Принудительно пересчитываем высоту контейнера для плавной анимации
    setTimeout(() => {
        content.style.maxHeight = content.classList.contains('expanded') ? 
            content.scrollHeight + 'px' : '0px';
    }, 10);
}
// Функция отображения деталей товара
function showProductDetails(productGroup) {
    if (!productGroup || productGroup.length === 0) return;
    const firstProduct = productGroup[0];
    
    // Заполняем информацию о товаре
    document.getElementById('detail-product-name').textContent = firstProduct.name;
    document.getElementById('detail-product-price').textContent = `${firstProduct.price.toFixed(2)} ₽`;
    
    // Заполняем изображение
    const detailImage = document.getElementById('detail-product-image');
    const detailPlaceholder = document.getElementById('detail-placeholder');
    if (firstProduct.images && firstProduct.images[0]) {
        detailImage.src = firstProduct.images[0];
        detailImage.style.display = 'block';
        detailPlaceholder.style.display = 'none';
        detailImage.alt = firstProduct.name;
        detailImage.onerror = function() {
            this.style.display = 'none';
            detailPlaceholder.style.display = 'flex';
        };
    } else {
        detailImage.style.display = 'none';
        detailPlaceholder.style.display = 'flex';
    }
    
    // Заполняем размеры
    const sizesContainer = document.getElementById('detail-sizes-container');
    const sortedSizes = [...productGroup].sort((a, b) => a.size - b.size);
    let sizesHtml = '';
    
    // Проверяем наличие стандартных размеров (600, 700, 800, 900 мм)
    const standardSizes = [600, 700, 800, 900];
    const availableStandardSizes = new Set();
    
    sortedSizes.forEach(product => {
        const isFavorite = favorites.some(f => f.id === product.id);
        const inCart = cart.find(c => c.id === product.id);
        const itemNumber = product.item || product.id;
        const stockClass = product.stock > 0 ? 'available' : 'unavailable';
        const stockText = product.stock > 0 ? `${product.stock} шт` : 'Нет в наличии';
        const outOfStockClass = product.stock <= 0 ? 'out-of-stock' : '';
        const addToCartTitle = product.stock <= 0 ? 'Товар под заказ' : (inCart ? 'В корзине' : 'Добавить в корзину');
        const addToCartText = inCart ? '✅' : '🛒';
        
        // Проверяем наличие стандартных размеров
        if (standardSizes.includes(product.size)) {
            if (product.stock > 0) {
                availableStandardSizes.add(product.size);
            }
        }
        
        sizesHtml += `
            <div class="table-row size-item ${outOfStockClass}" data-id="${product.id}">
                <div class="table-cell size-cell">${product.size} мм</div>
                <div class="table-cell price-cell">${product.price.toFixed(2)} ₽</div>
                <div class="table-cell item-cell">${itemNumber}</div>
                <div class="table-cell stock-cell ${stockClass}">
                    ${stockText}
                    ${product.stock <= 0 ? '<span class="out-of-stock-tag">Под заказ</span>' : ''}
                </div>
                <div class="table-cell actions-cell">
                    <div class="hover-actions">
                        <button class="action-btn favorite-btn ${isFavorite ? 'active' : ''}" 
                                data-id="${product.id}" 
                                title="${isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                            ${isFavorite ? '❤️' : '♡'}
                        </button>
                        <div class="cart-control-container">
                            <button class="action-btn add-to-cart-btn ${outOfStockClass}" data-id="${product.id}" 
                                    title="${addToCartTitle}">
                                ${addToCartText}
                            </button>
                            <div class="cart-popup hidden" data-id="${product.id}">
                                <button class="quantity-btn decrease-btn" data-id="${product.id}">-</button>
                                <input type="number" class="quantity-input" value="1" min="1" max="${product.stock > 0 ? product.stock : 99}" data-id="${product.id}">
                                <button class="quantity-btn increase-btn" data-id="${product.id}">+</button>
                                <button class="buy-btn" data-id="${product.id}">Купить</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    sizesContainer.innerHTML = sizesHtml;
    
    // Добавляем уведомление о товарах под заказ только если отсутствуют стандартные размеры
    const hasMissingStandardSizes = standardSizes.some(size => !availableStandardSizes.has(size));
    const hasNoStandardSizes = availableStandardSizes.size === 0;
    
    // Удаляем все предыдущие уведомления
    const existingNotices = document.querySelectorAll('.out-of-stock-notice');
    existingNotices.forEach(notice => notice.remove());
    
    // Добавляем уведомление, если отсутствуют некоторые или все стандартные размеры
    if (hasMissingStandardSizes || hasNoStandardSizes) {
        sizesContainer.insertAdjacentHTML('beforebegin', `
            <div class="out-of-stock-notice">
                <p>⚠️ Некоторые размеры доступны только под заказ. Мы сообщим о сроках поставки при оформлении заказа.</p>
            </div>
        `);
    }
    
    // Заполняем погонаж
    const trimItemsContainer = document.getElementById('trim-items-list');
    const trimItems = findTrimItemsByColor(firstProduct.color, firstProduct.name);
    
    if (trimItems.length === 0) {
        trimItemsContainer.innerHTML = '<p>Нет погонажа в этом цвете</p>';
    } else {
        // Сначала сгруппируем погонаж по категориям
        const groupedTrim = {};
        trimItems.forEach(item => {
            let category = item.category;
            // Гарантируем правильную категорию для дополнительных товаров
            if (item.name === "Соединительная планка для доборных элементов без покрытия") {
                category = "Погонаж телескопический";
            } else if (item.name === "Крепление Clipstar для плинтуса Tarkett") {
                category = "Плинтус";
            }
            if (!groupedTrim[category]) {
                groupedTrim[category] = [];
            }
            groupedTrim[category].push(item);
        });
        
        // Определяем порядок категорий
        const categoryOrder = [
            'Погонаж телескопический',
            'Погонаж простой',
            'Декор',
            'Плинтус'
        ];
        
        // Специальный порядок для элементов внутри категорий
        const itemOrder = [
            'Деталь короба 70',
            'Деталь короба 80',
            'Деталь короба 100',
            'Наличник (Т)', // Сначала телескопический наличник
            'Наличник "Классика" (Т)', // Затем наличник "Классика" телескопический
            'Наличник',
            'Доборный элемент 100',
            'Доборный элемент 150',
            'Доборный элемент 200',
            'Доборный элемент 320',
            'Плинтус',
            'Притворная планка'
        ];
        
        let trimHtml = '';
        categoryOrder.forEach(category => {
            if (groupedTrim[category] && groupedTrim[category].length > 0) {
                // Сортируем элементы по специальному порядку
                let sortedItems = [...groupedTrim[category]].sort((a, b) => {
                    // Сначала проверяем специальный порядок
                    const indexA = itemOrder.findIndex(order => 
                        a.name.includes(order) || 
                        (order === 'Наличник (Т)' && a.name.includes('Наличник (Т')) ||
                        (order === 'Наличник "Классика" (Т)' && a.name.includes('Наличник "Классика" (Т'))
                    );
                    const indexB = itemOrder.findIndex(order => 
                        b.name.includes(order) || 
                        (order === 'Наличник (Т)' && b.name.includes('Наличник (Т')) ||
                        (order === 'Наличник "Классика" (Т)' && b.name.includes('Наличник "Классика" (Т'))
                    );
                    
                    // Если оба элемента не в специальном порядке, сортируем по алфавиту
                    if (indexA === -1 && indexB === -1) {
                        return a.name.localeCompare(b.name);
                    }
                    // Если только один элемент в специальном порядке, он идет первым
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    // Оба элемента в специальном порядке - сортируем по их порядку
                    return indexA - indexB;
                });
                
                // ДОПОЛНИТЕЛЬНО: Перемещаем специальные товары в конец категории
                if (category === 'Погонаж телескопический') {
                    // Находим все вхождения специального товара
                    const specialItems = sortedItems.filter(item => 
                        item.name === "Соединительная планка для доборных элементов без покрытия"
                    );
                    // Удаляем их из основного массива
                    sortedItems = sortedItems.filter(item => 
                        item.name !== "Соединительная планка для доборных элементов без покрытия"
                    );
                    // Добавляем в конец
                    sortedItems = [...sortedItems, ...specialItems];
                }
                if (category === 'Плинтус') {
                    // Находим все вхождения специального товара
                    const specialItems = sortedItems.filter(item => 
                        item.name === "Крепление Clipstar для плинтуса Tarkett"
                    );
                    // Удаляем их из основного массива
                    sortedItems = sortedItems.filter(item => 
                        item.name !== "Крепление Clipstar для плинтуса Tarkett"
                    );
                    // Добавляем в конец
                    sortedItems = [...sortedItems, ...specialItems];
                }
                
                // Группируем элементы по name
                const groupedByName = {};
                sortedItems.forEach(item => {
                    const nameKey = item.name;
                    if (!groupedByName[nameKey]) {
                        groupedByName[nameKey] = [];
                    }
                    groupedByName[nameKey].push(item);
                });
                
                // Формируем HTML для категории
                trimHtml += `<div class="trim-category"><h4>${category}</h4>`;
                // Формируем HTML для каждой группы по name
                Object.keys(groupedByName).forEach(nameKey => {
                    const items = groupedByName[nameKey];
                    // Сортируем элементы по размеру
                    const sortedGroup = [...items].sort((a, b) => (a.size || 0) - (b.size || 0));
                    trimHtml += `
                        <div class="trim-group" data-name="${nameKey}">
                            <div class="trim-group-header">
                                <span>${nameKey}</span>
                                <span class="expand-icon">+</span>
                            </div>
                            <div class="trim-group-content">
                                <div class="trim-table">
                                    <div class="table-header">
                                        <div class="table-cell size-header">Размер</div>
                                        <div class="table-cell price-header">Цена</div>
                                        <div class="table-cell item-header">Артикул</div>
                                        <div class="table-cell stock-header">Остаток</div>
                                        <div class="table-cell actions-header"></div>
                                    </div>
                    `;
                    sortedGroup.forEach(item => {
                        const isFavorite = favorites.some(f => f.id === item.id);
                        const inCart = cart.find(c => c.id === item.id);
                        const itemNumber = item.item || item.id;
                        // Формируем отображение только размера и артикула
                        let displaySize = item.size ? `${item.size} мм` : '—';
                        if (item.dimensions) {
                            displaySize = item.dimensions;
                        } else if (item.size && item.width && item.height) {
                            displaySize = `${item.size}x${item.width}x${item.height} мм`;
                        }
                        const stockClass = item.stock > 0 ? 'available' : 'unavailable';
                        const stockText = item.stock > 0 ? `${item.stock} шт` : 'Нет в наличии';
                        const outOfStockClass = item.stock <= 0 ? 'out-of-stock' : '';
                        const addToCartTitle = item.stock <= 0 ? 'Товар под заказ' : (inCart ? 'В корзине' : 'Добавить в корзину');
                        const addToCartText = inCart ? '✅' : '🛒';
                        trimHtml += `
                            <div class="table-row trim-item ${outOfStockClass}" data-id="${item.id}">
                                <div class="table-cell size-cell">${displaySize}</div>
                                <div class="table-cell price-cell">${item.price.toFixed(2)} ₽</div>
                                <div class="table-cell item-cell">${itemNumber}</div>
                                <div class="table-cell stock-cell ${stockClass}">
                                    ${stockText}
                                    ${item.stock <= 0 ? '<span class="out-of-stock-tag">Под заказ</span>' : ''}
                                </div>
                                <div class="table-cell actions-cell">
                                    <div class="hover-actions">
                                        <button class="action-btn favorite-btn ${isFavorite ? 'active' : ''}" 
                                                data-id="${item.id}" 
                                                title="${isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                                            ${isFavorite ? '❤️' : '♡'}
                                        </button>
                                        <div class="cart-control-container">
                                            <button class="action-btn add-to-cart-btn ${outOfStockClass}" data-id="${item.id}" 
                                                    title="${addToCartTitle}">
                                                ${addToCartText}
                                            </button>
                                            <div class="cart-popup hidden" data-id="${item.id}">
                                                <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                                                <input type="number" class="quantity-input" value="1" min="1" max="${item.stock > 0 ? item.stock : 99}" data-id="${item.id}">
                                                <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                                                <button class="buy-btn" data-id="${item.id}">Купить</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    trimHtml += `
                                </div>
                            </div>
                        </div>
                    `;
                });
                trimHtml += '</div>';
            }
        });
        trimItemsContainer.innerHTML = trimHtml;
        
        // Добавляем обработчики для раскрытия групп (можно открыть несколько одновременно)
        document.querySelectorAll('.trim-group-header').forEach(header => {
            header.removeEventListener('click', handleTrimGroupClick);
            header.addEventListener('click', handleTrimGroupClick);
        });
        
        // Добавляем обработчики для кнопок в модальном окне для дополнительных товаров
        addDetailModalEventListeners();
    }
    
    // Отображаем модальное окно
    productDetailModal.classList.remove('hidden');
    
    // Сохраняем позицию скролла перед открытием
    setTimeout(() => {
        const scrollPosition = document.documentElement.scrollTop || document.body.scrollTop;
        // Добавляем обработчики для кнопок в модальном окне
        addDetailModalEventListeners();
        // Восстанавливаем позицию скролла
        setTimeout(() => {
            document.documentElement.scrollTop = scrollPosition;
            document.body.scrollTop = scrollPosition;
        }, 50);
    }, 50);
}
// Функция добавления обработчиков событий для модального окна
function addDetailModalEventListeners() {
    const modal = document.getElementById('product-detail-modal');
    // Обработчики только для элементов внутри модального окна
    modal.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.removeEventListener('click', toggleFavorite);
        btn.addEventListener('click', toggleFavorite);
    });
    modal.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.removeEventListener('click', toggleCartPopup);
        btn.addEventListener('click', toggleCartPopup);
    });
    modal.querySelectorAll('.buy-btn').forEach(btn => {
        btn.removeEventListener('click', buyProductFromPopup);
        btn.addEventListener('click', buyProductFromPopup);
    });
    modal.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.removeEventListener('click', decreaseQuantity);
        btn.addEventListener('click', decreaseQuantity);
    });
    modal.querySelectorAll('.increase-btn').forEach(btn => {
        btn.removeEventListener('click', increaseQuantity);
        btn.addEventListener('click', increaseQuantity);
    });
    modal.querySelectorAll('.quantity-input').forEach(input => {
        input.removeEventListener('change', updateQuantity);
        input.addEventListener('change', updateQuantity);
        // Добавляем обработчик для нажатия Enter
        input.removeEventListener('keydown', handleQuantityInputKeydown);
        input.addEventListener('keydown', handleQuantityInputKeydown);
    });
    // Закрытие попапов при клике вне их
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.cart-control-container')) {
            modal.querySelectorAll('.cart-popup').forEach(popup => {
                popup.classList.add('hidden');
            });
        }
    }, { passive: true });
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
document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768) {
        const row = e.target.closest('.table-row');
        if (row && !e.target.closest('.cart-control-container') && !e.target.closest('.cart-popup')) {
            // Закрываем все всплывающие окна корзины
            document.querySelectorAll('.cart-popup').forEach(popup => {
                popup.classList.add('hidden');
            });
        }
    }
});