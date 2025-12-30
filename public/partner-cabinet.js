// Глобальные переменные для личного кабинета
let partnerProfile = {};
let partnerOrders = [];
// Элементы DOM для личного кабинета
const partnerCabinetModal = document.getElementById('partner-cabinet-modal');
const ordersTabBtn = document.getElementById('orders-tab');
const profileTabBtn = document.getElementById('profile-tab');
const ordersContent = document.getElementById('orders-content');
const profileContent = document.getElementById('profile-content');
const partnerProfileForm = document.getElementById('partner-profile-form');
const partnerNameInput = document.getElementById('partner-name-input');
const partnerEmailInput = document.getElementById('partner-email-input');
const ordersFilterSelect = document.getElementById('orders-filter');
const ordersSearchInput = document.getElementById('orders-search');
// Загрузка профиля партнера
async function loadPartnerProfile() {
    if (!partner || !partner.id) return;
    try {
        const response = await fetch(`/api/partner/${partner.id}/profile`);
        if (response.ok) {
            partnerProfile = await response.json();
            // Обновляем отображение имени партнера в хедере
            if (document.getElementById('partner-name')) {
                const displayName = partnerProfile.contactPerson || partner.name || 'Партнер';
                document.getElementById('partner-name').textContent = displayName;
            }
            // Заполняем форму профиля
            if (partnerNameInput) partnerNameInput.value = partnerProfile.contactPerson || partner.name || '';
            if (partnerEmailInput) partnerEmailInput.value = partnerProfile.email || '';
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля партнера:', error);
    }
}
// Загрузка заказов партнера
async function loadPartnerOrders() {
    if (!partner || !partner.id) return;
    const ordersList = document.getElementById('partner-orders-list');
    if (!ordersList) return;
    try {
        const response = await fetch(`/api/partner/${partner.id}/orders`);
        if (response.ok) {
            partnerOrders = await response.json();
            renderPartnerOrders();
        } else {
            ordersList.innerHTML = '<p class="error">Ошибка загрузки заказов. Попробуйте позже.</p>';
        }
    } catch (error) {
        console.error('Ошибка загрузки заказов партнера:', error);
        ordersList.innerHTML = `<p class="error">Ошибка загрузки заказов: ${error.message}</p>`;
    }
}
// grespoyer
// Отображение заказов партнера
function renderPartnerOrders(filterStatus = 'all', searchTerm = '') {
    const ordersList = document.getElementById('partner-orders-list');
    if (!ordersList) return;
    
    if (!partnerOrders || partnerOrders.length === 0) {
        ordersList.innerHTML = '<p class="no-orders">У вас пока нет заказов</p>';
        return;
    }
    
    // Фильтрация по статусу
    let filteredOrders = [...partnerOrders];
    if (filterStatus !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === filterStatus);
    }
    
    // Фильтрация по поиску в товарах
    if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredOrders = filteredOrders.filter(order => {
            return order.items.some(item => {
                const nameMatch = item.name.toLowerCase().includes(searchLower);
                const numberMatch = item.itemNumber && item.itemNumber.toLowerCase().includes(searchLower);
                return nameMatch || numberMatch;
            });
        });
    }
    
    if (filteredOrders.length === 0) {
        ordersList.innerHTML = '<p class="no-orders">Не найдено заказов, соответствующих критериям</p>';
        return;
    }
    
    // Сортируем заказы по дате (новые первыми)
    const sortedOrders = filteredOrders.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    let html = '';
    
    // Функция для выделения совпадений в тексте
    function highlightText(text, searchTerm) {
        if (!searchTerm || searchTerm.length === 0 || !text) return text;
        
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedSearch, 'gi');
        
        return text.replace(regex, match => `<mark class="search-highlight">${match}</mark>`);
    }
    
    sortedOrders.forEach(order => {
        const orderDate = new Date(order.createdAt);
        const formattedDate = `${orderDate.getDate()}.${orderDate.getMonth() + 1}.${orderDate.getFullYear()} ${orderDate.getHours().toString().padStart(2, '0')}:${orderDate.getMinutes().toString().padStart(2, '0')}`;
        const statusClass = order.status || 'new';
        let statusText = getStatusText(order.status);
        
        // Добавляем специальный статус для заказов с товарами под заказ
        const hasOutOfStockItems = order.items.some(item => item.isOutOfStock);
        if (hasOutOfStockItems) {
            statusText += ' (есть товары под заказ)';
        }
        
        // Группируем товары по имени для компактного отображения
        const itemsByGroup = {};
        order.items.forEach(item => {
            const key = `${item.name}_${item.size || ''}`;
            if (!itemsByGroup[key]) {
                itemsByGroup[key] = {
                    name: item.name,
                    size: item.size,
                    totalQuantity: 0,
                    totalPrice: 0,
                    items: [],
                    hasOutOfStock: item.isOutOfStock
                };
            }
            itemsByGroup[key].totalQuantity += item.quantity;
            itemsByGroup[key].totalPrice += item.price * item.quantity;
            itemsByGroup[key].items.push(item);
            if (item.isOutOfStock) {
                itemsByGroup[key].hasOutOfStock = true;
            }
        });
        
        const itemsHtml = Object.values(itemsByGroup).map(group => {
            // Выделяем совпадения в названии товара
            const highlightedName = highlightText(group.name, searchTerm);
            const stockNotice = group.hasOutOfStock ? '<span class="stock-notice">(часть товаров под заказ)</span>' : '';
            
            const itemDetails = group.items.map(item => {
                const sizeText = item.size ? item.size + 'мм' : '';
                const highlightedSize = highlightText(sizeText, searchTerm);
                const highlightedNumber = item.itemNumber ? highlightText(item.itemNumber, searchTerm) : '';
                const stockStatus = item.isOutOfStock ? ' (под заказ)' : '';
                
                let detailsText = `${highlightedSize} × ${item.quantity} шт.`;
                if (highlightedNumber) detailsText += ` | арт. ${highlightedNumber}`;
                if (item.isOutOfStock) detailsText += highlightText(stockStatus, searchTerm);
                detailsText += ` (${(item.price * item.quantity).toFixed(2)} ₽)`;
                
                return detailsText;
            }).join(', ');
            
            return `
            <span class="order-item-name">
                ${highlightedName} | Всего: ${group.totalQuantity} шт. | ${group.totalPrice.toFixed(2)} ₽ ${stockNotice}
                <div class="item-details">${itemDetails}</div>
            </span>
            `;
        }).join('');
        
        // Автоматически раскрываем заказы при поиске
        const isExpanded = searchTerm ? 'expanded' : '';
        
        html += `
        <div class="order-item" data-order-id="${order.id}">
            <div class="order-header">
                <span class="order-id">Заказ #${order.id}</span>
                <span class="order-date">${formattedDate}</span>
                <span class="order-total">${order.total.toFixed(2)} ₽</span>
                <span class="order-status ${statusClass}">${statusText}</span>
            </div>
            <div class="order-items ${isExpanded}">
                ${generateInvoiceHTML(order, searchTerm)}
            </div>
        </div>
        `;
    });
    
    ordersList.innerHTML = html;
    
    // Добавляем обработчики для раскрытия заказов
    document.querySelectorAll('.order-header').forEach(header => {
        header.addEventListener('click', () => {
            const orderItem = header.closest('.order-item');
            const orderItems = orderItem.querySelector('.order-items');
            orderItems.classList.toggle('expanded');
        });
    });
}
// Получение текста статуса заказа
function getStatusText(status) {
    const statuses = {
        'new': 'Новый',
        'processing': 'В обработке',
        'completed': 'Выполнен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}
// пкуызщнук
function numberToWords(number) {
    // Округляем до 2 знаков после запятой
    number = parseFloat(number.toFixed(2));
    
    let rubles = Math.floor(number);
    let kopecks = Math.round((number - rubles) * 100);
    
    // Функция для склонения слов в зависимости от числа
    function pluralize(count, words) {
        const cases = [2, 0, 1, 1, 1, 2];
        return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[(count % 10 < 5) ? count % 10 : 5]];
    }
    
    // Преобразование числа (0-999) в слова с учетом рода
    function convertHundreds(num, isMale = true) {
        if (num === 0) return '';
        
        const unitsMale = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
            'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
            'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
            
        const unitsFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
            'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
            'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
            
        const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 
            'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
            
        const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 
            'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
        
        let result = [];
        
        // Сотни
        const h = Math.floor(num / 100);
        if (h > 0) result.push(hundreds[h]);
        
        // Десятки и единицы
        const t = Math.floor((num % 100) / 10);
        const u = num % 10;
        
        if (t === 1) {
            // 10-19
            result.push(isMale ? unitsMale[10 + u] : unitsFemale[10 + u]);
        } else {
            // 20-99
            if (t > 1) result.push(tens[t]);
            if (u > 0) result.push(isMale ? unitsMale[u] : unitsFemale[u]);
        }
        
        return result.join(' ');
    }
    
    // Обработка граничных случаев
    if (rubles === 0 && kopecks === 0) {
        return 'ноль рублей 00 копеек';
    }
    
    // Обработка рублей
    if (rubles === 0) {
        var rublesText = 'ноль рублей';
    } else {
        // Разбиваем число на части для больших значений
        let billions = Math.floor(rubles / 1000000000);
        let millions = Math.floor((rubles % 1000000000) / 1000000);
        let thousands = Math.floor((rubles % 1000000) / 1000);
        let units = rubles % 1000;
        
        let parts = [];
        
        if (billions > 0) {
            parts.push(convertHundreds(billions, true) + ' ' + pluralize(billions, ['миллиард', 'миллиарда', 'миллиардов']));
        }
        
        if (millions > 0) {
            parts.push(convertHundreds(millions, true) + ' ' + pluralize(millions, ['миллион', 'миллиона', 'миллионов']));
        }
        
        if (thousands > 0) {
            parts.push(convertHundreds(thousands, false) + ' ' + pluralize(thousands, ['тысяча', 'тысячи', 'тысяч']));
        }
        
        if (units > 0) {
            parts.push(convertHundreds(units, true));
        }
        
        const rublesWord = pluralize(rubles, ['рубль', 'рубля', 'рублей']);
        rublesText = parts.join(' ') + ' ' + rublesWord;
    }
    
    // Обработка копеек
    const kopecksWord = pluralize(kopecks, ['копейка', 'копейки', 'копеек']);
    const kopecksText = kopecks.toString().padStart(2, '0') + ' ' + kopecksWord;
    
    return rublesText + ' ' + kopecksText;
}
// Генерация HTML для отображения счета
function generateInvoiceHTML(order, searchTerm = '') {
    // Функция для выделения совпадений
    function highlightInInvoice(text) {
        if (!searchTerm || !text) return text;
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedSearch, 'gi');
        return text.replace(regex, match => `<mark class="search-highlight">${match}</mark>`);
    }
    
    const orderDate = new Date(order.createdAt);
    const formattedDate = `${orderDate.getDate()}.${orderDate.getMonth() + 1}.${orderDate.getFullYear()}`;
    const invoiceNumber = order.id;
    let itemsHtml = '';
    let totalQuantity = 0;
    let totalAmount = 0;
    
    order.items.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        // Формируем полное наименование с размером и артикулом
        let itemNameFull = item.name;
        if (item.size) {
            itemNameFull += ` ${item.size}, `;
        }
        if (item.itemNumber) {
            itemNameFull += ` ${item.itemNumber}`;
        }
        
        // Выделяем совпадения
        const highlightedName = highlightInInvoice(itemNameFull);
        const highlightedDesc = item.description ? highlightInInvoice(item.description) : '';
        
        itemsHtml += `
        <tr>
            <td>${index + 1}</td>
            <td>${highlightedName}<br>${highlightedDesc || ''}</td>
            <td>шт.</td>
            <td>${item.quantity}</td>
            <td>${item.price.toFixed(2)}</td>
            <td>${itemTotal.toFixed(2)}</td>
        </tr>
        `;
        totalQuantity += item.quantity;
        totalAmount += itemTotal;
    });
    
    // Сумма прописью
    const amountInWords = numberToWords(totalAmount);
    
    return `
    <div class="invoice-preview" style="padding: 15px; background: white;">
        <h3 style="text-align: center; margin-top: 0;">СЧЕТ № ${invoiceNumber} от ${formattedDate}</h3>
        <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <thead>
                <tr>
                    <th>№</th>
                    <th>Наименование</th>
                    <th>Ед. изм</th>
                    <th>Кол-во</th>
                    <th>Цена</th>
                    <th>Сумма</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr>
                    <td colspan="3">Итого:</td>
                    <td>${totalQuantity}</td>
                    <td></td>
                    <td>${totalAmount.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
        <p>Сумма прописью: ${amountInWords}</p>
    </div>
    `;
}
// Переключение вкладок в личном кабинете с сохранением позиции скролла
function switchTab(tabName) {
  // Сохраняем текущую позицию скролла для каждой вкладки
  const scrollPositions = {
    orders: ordersContent?.scrollTop || 0,
    profile: profileContent?.scrollTop || 0
  };
  
  // Обновляем активные кнопки вкладок
  if (ordersTabBtn) ordersTabBtn.classList.toggle('active', tabName === 'orders');
  if (profileTabBtn) profileTabBtn.classList.toggle('active', tabName === 'profile');
  
  // Обновляем видимость контента
  if (ordersContent) ordersContent.classList.toggle('active', tabName === 'orders');
  if (profileContent) profileContent.classList.toggle('active', tabName === 'profile');
  
  // Восстанавливаем позицию скролла для выбранной вкладки
  if (tabName === 'orders' && ordersContent) {
    ordersContent.scrollTop = scrollPositions.orders;
  } else if (profileContent) {
    profileContent.scrollTop = scrollPositions.profile;
  }
  
  // Если переключаемся на профиль и данные еще не загружены, загружаем их
  if (tabName === 'profile' && Object.keys(partnerProfile).length === 0) {
    loadPartnerProfile();
  }
  
  // Если переключаемся на заказы, всегда загружаем их (не только если массив пустой)
  if (tabName === 'orders') {
    // Загружаем временные данные перед заказами
    loadTempProducts().then(() => {
      loadPartnerOrders();
    }).catch(error => {
      console.error('Ошибка загрузки временных данных:', error);
      loadPartnerOrders();
    });
  }
}
// grespoyer
// Показ личного кабинета партнера
function showPartnerCabinet() {
    // Проверяем, залогинен ли партнер
    if (!partner) {
        showNotification('Пожалуйста, войдите в систему', 'error', 3000);
        return;
    }
    
    // Добавьте проверку аутентификации на сервере
    fetch('/api/partner/check-auth')
        .then(response => {
            if (!response.ok) {
                // Сессия истекла - очищаем данные и просим перелогиниться
                localStorage.removeItem('partner');
                partner = null;
                showNotification('Сессия истекла. Пожалуйста, войдите снова', 'error', 5000);
                return;
            }
            
            // Если все ок, продолжаем
            partnerCabinetModal.classList.remove('hidden');
            switchTab('orders');
            loadPartnerProfile();
            loadTempProducts().then(() => {
                loadPartnerOrders();
            }).catch(error => {
                console.error('Ошибка загрузки временных данных:', error);
                loadPartnerOrders();
            });
        })
        .catch(error => {
            console.error('Ошибка проверки аутентификации:', error);
        });
}
// Инициализация обработчиков событий для личного кабинета
function initPartnerCabinetEventListeners() {
    // Обработчики для вкладок
    if (ordersTabBtn) {
        ordersTabBtn.addEventListener('click', () => switchTab('orders'));
    }
    if (profileTabBtn) {
        profileTabBtn.addEventListener('click', () => switchTab('profile'));
    }
    // Обработчик формы профиля партнера
    if (partnerProfileForm) {
        partnerProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = partnerNameInput.value.trim();
            const email = partnerEmailInput.value.trim();
            if (!name || !email) {
                alert('Пожалуйста, заполните все поля');
                return;
            }
            try {
                const response = await fetch(`/api/partner/${partner.id}/profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        contactPerson: name,
                        email: email
                    })
                });
                if (response.ok) {
                    // Обновляем данные партнера в памяти
                    partner.name = name;
                    partnerProfile.contactPerson = name;
                    partnerProfile.email = email;
                    // Обновляем отображение имени партнера в header
                    if (document.getElementById('partner-name')) {
                        document.getElementById('partner-name').textContent = name;
                    }
                    // Показываем сообщение об успешном сохранении
                    let successMsg = document.querySelector('.profile-save-success');
                    if (!successMsg) {
                        successMsg = document.createElement('div');
                        successMsg.className = 'profile-save-success';
                        partnerProfileForm.appendChild(successMsg);
                    }
                    successMsg.textContent = '✅ Профиль успешно обновлен!';
                    successMsg.style.display = 'block';
                    setTimeout(() => {
                        successMsg.style.display = 'none';
                    }, 3000);
                } else {
                    const errorData = await response.json();
                    alert(`Ошибка обновления профиля: ${errorData.error || 'Неизвестная ошибка'}`);
                }
            } catch (error) {
                console.error('Ошибка обновления профиля:', error);
                alert('Ошибка при обновлении профиля. Попробуйте позже.');
            }
        });
    }
    // Обработчики для фильтрации заказов
    if (ordersFilterSelect) {
        ordersFilterSelect.addEventListener('change', (e) => {
            const filterStatus = e.target.value;
            const searchTerm = ordersSearchInput ? ordersSearchInput.value.trim() : '';
            renderPartnerOrders(filterStatus, searchTerm);
        });
    }
    if (ordersSearchInput) {
        ordersSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            const filterStatus = ordersFilterSelect ? ordersFilterSelect.value : 'all';
            renderPartnerOrders(filterStatus, searchTerm);
        });
    }
}
// Инициализация личного кабинета
document.addEventListener('DOMContentLoaded', () => {
    initPartnerCabinetEventListeners();
    // Обработчик для кнопки закрытия модального окна
    const closeBtn = partnerCabinetModal?.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            partnerCabinetModal.classList.add('hidden');
        });
    }
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (e) => {
        if (e.target === partnerCabinetModal) {
            partnerCabinetModal.classList.add('hidden');
        }
    });
});
// Экспортируем функцию для обновления заказов извне
window.refreshPartnerOrders = loadPartnerOrders;