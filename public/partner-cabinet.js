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
            return order.items.some(item => 
                item.name.toLowerCase().includes(searchLower) ||
                (item.itemNumber && item.itemNumber.toLowerCase().includes(searchLower))
            );
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
            const itemDetails = group.items.map(item => {
                const stockStatus = item.isOutOfStock ? ' (под заказ)' : '';
                return `${item.size ? item.size + 'мм' : ''} × ${item.quantity} шт.${stockStatus} (${(item.price * item.quantity).toFixed(2)} ₽)`;
            }).join(', ');
            
            const stockNotice = group.hasOutOfStock ? '<span class="stock-notice">(часть товаров под заказ)</span>' : '';
            
            return `
                <span class="order-item-name">
                    ${group.name} | Всего: ${group.totalQuantity} шт. | ${group.totalPrice.toFixed(2)} ₽ ${stockNotice}
                    <div class="item-details">${itemDetails}</div>
                </span>
            `;
        }).join('');
        
        html += `
        <div class="order-item" data-order-id="${order.id}">
        <div class="order-header">
            <span class="order-id">Заказ #${order.id}</span>
            <span class="order-date">${formattedDate}</span>
            <span class="order-total">${order.total.toFixed(2)} ₽</span>
            <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <div class="order-items">
            ${generateInvoiceHTML(order)}
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
            const orderComments = orderItem.querySelector('.order-comments');
            orderItems.classList.toggle('expanded');
            if (orderComments) {
                orderComments.classList.toggle('expanded');
            }
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
// Генерация HTML для отображения счета
function generateInvoiceHTML(order) {
  const orderDate = new Date(order.createdAt);
  const formattedDate = `${orderDate.getDate()}.${orderDate.getMonth() + 1}.${orderDate.getFullYear()}`;
  const invoiceNumber = order.id;

  let itemsHtml = '';
  let totalQuantity = 0;
  let totalAmount = 0;

  order.items.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    itemsHtml += `
      <tr>
        <td>${index + 1}</td>
        <td>${item.name}<br>${item.description || ''}</td>
        <td>шт.</td>
        <td>${item.quantity}</td>
        <td>${item.price.toFixed(2)}</td>
        <td>${itemTotal.toFixed(2)}</td>
      </tr>
    `;
    totalQuantity += item.quantity;
    totalAmount += itemTotal;
  });

  // Пример суммы прописью (можно заменить на реальную реализацию)
  const amountInWords = 'Четыреста семьдесят четыре рубля 00 копеек';

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
      <div style="display: flex; justify-content: space-between; margin-top: 30px;">
        <div>Руководитель _______________</div>
        <div>Бухгалтер _______________</div>
      </div>
    </div>
  `;
}
// Переключение вкладок в личном кабинете с сохранением позиции скролла
function switchTab(tabName) {
    // Сохраняем текущую позицию скролла для каждой вкладки
    const scrollPositions = {
        orders: ordersContent.scrollTop || 0,
        profile: profileContent.scrollTop || 0
    };
    // Обновляем активные кнопки вкладок
    ordersTabBtn.classList.toggle('active', tabName === 'orders');
    profileTabBtn.classList.toggle('active', tabName === 'profile');
    // Обновляем видимость контента
    ordersContent.classList.toggle('active', tabName === 'orders');
    profileContent.classList.toggle('active', tabName === 'profile');
    // Восстанавливаем позицию скролла для выбранной вкладки
    if (tabName === 'orders') {
        ordersContent.scrollTop = scrollPositions.orders;
    } else {
        profileContent.scrollTop = scrollPositions.profile;
    }
    // Если переключаемся на профиль и данные еще не загружены, загружаем их
    if (tabName === 'profile' && Object.keys(partnerProfile).length === 0) {
        loadPartnerProfile();
    }
    // Если переключаемся на заказы и они еще не загружены, загружаем их
    if (tabName === 'orders' && partnerOrders.length === 0) {
        loadPartnerOrders();
    }
}
// Показ личного кабинета партнера
function showPartnerCabinet() {
    if (!partner) return;
    partnerCabinetModal.classList.remove('hidden');
    loadPartnerProfile();
    
    // Загружаем временные данные при открытии кабинета
    loadTempProductsForProcessingOrders().then(() => {
        loadPartnerOrders();
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