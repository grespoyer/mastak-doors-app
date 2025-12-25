// Глобальные переменные
let allOrders = [];
let currentPage = 1;
let itemsPerPage = 10;
let customers = [];
let selectedOrders = [];
let orderToDelete = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    setupLogout();
    setupSettings();
    setupDeleteConfirmation();
    loadOrders();
    setupOrderSearch();
    setupStatusFilter();
    setupCustomerFilter();
    setupModalClose();
    setupPagination();
    setupEventListeners();
    setupSelectAllOrders();
    setupDeleteSelectedOrders();
    updateNewOrdersBadge();
    setInterval(updateNewOrdersBadge, 30000);
});

function setupEventListeners() {
    document.getElementById('ordersTableBody').addEventListener('click', function(e) {
        if (e.target.classList.contains('status-indicator')) {
            const orderId = e.target.closest('tr').dataset.id;
            const newStatus = e.target.dataset.status;
            updateOrderStatus(orderId, newStatus);
        }
        if (e.target.classList.contains('view-order-btn')) {
            const orderId = e.target.dataset.id;
            showOrderDetails(orderId);
        }
        if (e.target.classList.contains('delete-order-table-btn')) {
            const orderId = e.target.dataset.id;
            showDeleteConfirmation(orderId);
        }
        if (e.target.classList.contains('order-checkbox')) {
            updateSelectedOrders();
            updateDeleteSelectedButton();
        }
    });
    document.getElementById('closeOrderDetails').addEventListener('click', () => {
        document.getElementById('orderDetailsModal').classList.add('hidden');
    });
    document.getElementById('deleteOrderBtn').addEventListener('click', () => {
        const orderId = document.getElementById('orderId').textContent;
        showDeleteConfirmation(orderId);
    });
    document.getElementById('saveOrderNumberBtn').addEventListener('click', async () => {
    const orderId = document.getElementById('orderId').textContent;
    const newOrderNumber = document.getElementById('editOrderNumber').value.trim();
    
    if (!newOrderNumber) {
        alert('Номер заказа не может быть пустым');
        return;
    }
    
    if (newOrderNumber === orderId) {
        return; // Ничего не изменилось
    }
    
    if (!confirm(`Вы уверены, что хотите изменить номер заказа с ${orderId} на ${newOrderNumber}? Это действие нельзя отменить.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/orders/${orderId}/order-number`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newOrderNumber })
        });
        
        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления номера заказа');
        }
        
        const result = await response.json();
        
        // Обновляем данные в локальном массиве
        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
        // Обновляем ID заказа во всех связанных данных
        allOrders[orderIndex] = {
            ...allOrders[orderIndex],
            ...result.order
        };
        
        // Обновляем ID в выделенных заказах, если он там есть
        selectedOrders = selectedOrders.map(id => id === orderId ? newOrderNumber : id);
        
        // Обновляем отображение
        document.getElementById('orderId').textContent = newOrderNumber;
        document.getElementById('editOrderNumber').value = newOrderNumber;
        
        // Обновляем номер заказа в таблице и деталях
        document.querySelectorAll(`tr[data-id="${orderId}"]`).forEach(row => {
            row.dataset.id = newOrderNumber;
            row.querySelector('.order-id').textContent = `#${newOrderNumber}`;
            
            // Обновляем data-id в кнопках действий
            row.querySelectorAll('[data-id]').forEach(el => {
            if (el.dataset.id === orderId) {
                el.dataset.id = newOrderNumber;
            }
            });
        });
        }
        
        showMessage('Номер заказа успешно изменен!', 'success');
        renderOrders();
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('❌ Ошибка обновления номера заказа: ' + error.message, 'error');
    }
    });
}

function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function logout() {
    localStorage.removeItem('isAdminAuthenticated');
    window.location.href = '/admin/login';
}

function setupDeleteConfirmation() {
    document.querySelector('#deleteConfirmationModal .close').addEventListener('click', () => {
        document.getElementById('deleteConfirmationModal').classList.add('hidden');
    });
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        if (orderToDelete) {
            await deleteOrder(orderToDelete);
            orderToDelete = null;
        } else if (selectedOrders.length > 0) {
            await deleteSelectedOrders();
        }
        document.getElementById('deleteConfirmationModal').classList.add('hidden');
    });
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        document.getElementById('deleteConfirmationModal').classList.add('hidden');
        orderToDelete = null;
    });
}

function setupSettings() {
    document.getElementById('openSettingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('hidden');
        document.getElementById('itemsPerPage').value = itemsPerPage.toString();
    });
    document.querySelector('#settingsModal .close').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
    });
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        itemsPerPage = parseInt(document.getElementById('itemsPerPage').value);
        localStorage.setItem('ordersItemsPerPage', itemsPerPage);
        currentPage = 1;
        renderOrders();
        document.getElementById('settingsModal').classList.add('hidden');
    });
}

async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        allOrders = await response.json();
        
        // Сортировка заказов от новых к старым
        allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Получаем уникальных клиентов для фильтра
        customers = [...new Set(allOrders.map(order => order.customerName))];
        
        currentPage = 1;
        renderOrders();
        renderCustomerFilter();
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        document.getElementById('ordersTableBody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);">Ошибка загрузки</td></tr>`;
    }
}

function renderOrders() {
    const searchTerm = document.getElementById('orderSearch').value.toLowerCase().trim();
    const statusFilter = document.getElementById('statusFilter').value;
    const customerFilter = document.getElementById('customerFilter').value;
    const tableBody = document.getElementById('ordersTableBody');
    const noOrdersMessage = document.getElementById('noOrdersMessage');
    
    let filteredOrders = [...allOrders];
    
    if (statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }
    
    if (customerFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.customerName === customerFilter);
    }
    
    if (searchTerm) {
        filteredOrders = filteredOrders.filter(order => {
            return order.id.toString().includes(searchTerm) ||
                   order.customerName.toLowerCase().includes(searchTerm) ||
                   order.phone.includes(searchTerm) ||
                   (order.email && order.email.toLowerCase().includes(searchTerm)) ||
                   order.items.some(item => item.name.toLowerCase().includes(searchTerm));
        });
    }
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedOrders = filteredOrders.slice(start, end);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    
    if (filteredOrders.length === 0) {
        noOrdersMessage.style.display = 'block';
        tableBody.innerHTML = '';
        updatePaginationControls(totalPages);
        updateDeleteSelectedButton();
    } else {
        noOrdersMessage.style.display = 'none';
        tableBody.innerHTML = paginatedOrders.map(order => {
            const total = order.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
            return `
                <tr data-id="${order.id}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="order-checkbox" data-id="${order.id}">
                    </td>
                    <td class="order-id">#${order.id}</td>
                    <td class="order-date">${new Date(order.createdAt).toLocaleString('ru-RU')}</td>
                    <td class="order-customer">${order.customerName}</td>
                    <td class="order-contacts">
                        <div>${order.phone}</div>
                        <div class="order-email">${order.email || '—'}</div>
                    </td>
                    <td class="order-status">
                        <div class="status-indicators">
                            ${renderStatusIndicators(order.status)}
                        </div>
                    </td>
                    <td class="order-total">${total.toFixed(2)} ₽</td>
                    <td class="order-actions">
                        <button class="btn btn-info btn-sm action-btn view-order-btn" data-id="${order.id}">👁️</button>
                        <button class="btn btn-danger btn-sm action-btn delete-order-table-btn" data-id="${order.id}">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Восстанавливаем выделение после рендеринга
        selectedOrders.forEach(orderId => {
            const checkbox = document.querySelector(`.order-checkbox[data-id="${orderId}"]`);
            if (checkbox) checkbox.checked = true;
        });
        
        updatePaginationControls(totalPages);
        updateDeleteSelectedButton();
    }
}

function renderStatusIndicators(currentStatus) {
    const statuses = [
        { value: 'new', text: 'Новый' },
        { value: 'processing', text: 'В обработке' },
        { value: 'completed', text: 'Завершен' },
        { value: 'cancelled', text: 'Отменен' }
    ];
    return statuses.map((status, index) => {
        const isActive = currentStatus === status.value;
        const number = index + 1;
        return `
            <span class="status-indicator ${isActive ? 'active' : ''}" 
                  data-status="${status.value}"
                  title="${status.text}">
                ${number}
            </span>
        `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    if (!confirm('Вы уверены, что хотите изменить статус заказа?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Ошибка обновления статуса');
        
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        
        renderOrders();
        showMessage('Статус заказа успешно обновлен!', 'success');
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка обновления статуса: ' + error.message, 'error');
    }
}

async function showOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    document.getElementById('orderId').textContent = orderId;
    // Заполняем поле номера заказа
    document.getElementById('editOrderNumber').value = orderId;
    
    let itemsHtml = `
        <h3>Товары в заказе:</h3>
        <table class="order-items-table">
            <thead>
                <tr>
                    <th>Название</th>
                    <th>Артикул</th>
                    <th>Кол-во</th>
                    <th>Цена</th>
                    <th>Сумма</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    order.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td>${item.name || '—'}</td>
                <td>${item.item || '—'}</td>
                <td>${item.quantity || '1'}</td>
                <td>${(item.price || 0).toFixed(2)} ₽</td>
                <td>${((item.price || 0) * (item.quantity || 1)).toFixed(2)} ₽</td>
            </tr>
        `;
    });
    
    itemsHtml += `
            </tbody>
        </table>
    `;
    
    const total = order.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const detailsHtml = `
        <div class="customer-info">
            <h3>Информация о клиенте</h3>
            <p><strong>Имя:</strong> ${order.customerName || '—'}</p>
            <p><strong>Телефон:</strong> ${order.phone || '—'}</p>
            <p><strong>Email:</strong> ${(order.email || '—')}</p>
            <p><strong>Адрес доставки:</strong> ${(order.address || '—')}</p>
            <p><strong>Комментарий:</strong> ${(order.comments || '—')}</p>
        </div>
        ${itemsHtml}
        <div class="order-total">
            <h3>Итого: ${total.toFixed(2)} ₽</h3>
        </div>
    `;
    
    document.getElementById('orderDetailsContent').innerHTML = detailsHtml;
    document.getElementById('orderDetailsModal').classList.remove('hidden');
}

async function updateNewOrdersBadge() {
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        const newOrdersCount = orders.filter(order => order.status === 'new').length;
        const badge = document.getElementById('newOrdersBadge');
        if (badge) {
            badge.textContent = newOrdersCount;
            badge.style.display = newOrdersCount > 0 ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Ошибка обновления индикатора новых заказов:', error);
    }
}

async function deleteOrder(orderId) {
    try {
        const response = await fetch(`/api/orders/${orderId}`, {
            method: 'DELETE'
        });
        
        // Проверяем, есть ли тело ответа перед парсингом
        let responseData = {};
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        }
        
        if (!response.ok) {
            // Получаем детальное сообщение об ошибке, если оно есть
            let errorMessage = 'Сервер вернул статус ' + response.status;
            if (responseData.error) {
                errorMessage = responseData.error;
            } else if (responseData.message) {
                errorMessage = responseData.message;
            }
            throw new Error(errorMessage);
        }
        
        // Удаляем заказ из локального массива
        allOrders = allOrders.filter(order => order.id !== orderId);
        selectedOrders = selectedOrders.filter(id => id !== orderId);
        
        renderOrders();
        updateNewOrdersBadge();
        showMessage('Заказ успешно удален!', 'success');
        document.getElementById('orderDetailsModal').classList.add('hidden');
        
        // Если закрыто модальное окно с деталями, скрываем его
        if (!document.getElementById('orderDetailsModal').classList.contains('hidden')) {
            document.getElementById('orderDetailsModal').classList.add('hidden');
        }
    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        showMessage('❌ Ошибка удаления заказа: ' + error.message, 'error');
    }
}

function showDeleteConfirmation(orderId) {
    orderToDelete = orderId;
    document.getElementById('deleteConfirmationText').textContent = 
        `Вы уверены, что хотите удалить заказ #${orderId}? Это действие нельзя отменить.`;
    document.getElementById('deleteConfirmationModal').classList.remove('hidden');
}

function setupSelectAllOrders() {
    const selectAll = document.getElementById('selectAllOrders');
    if (!selectAll) return;
    
    selectAll.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('.order-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = selectAll.checked;
        });
        updateSelectedOrders();
        updateDeleteSelectedButton();
    });
}

function updateSelectedOrders() {
    selectedOrders = Array.from(document.querySelectorAll('.order-checkbox:checked'))
        .map(cb => cb.dataset.id);
}

function setupDeleteSelectedOrders() {
    document.getElementById('deleteSelectedOrdersBtn').addEventListener('click', () => {
        if (selectedOrders.length === 0) {
            alert('Выберите заказы для удаления');
            return;
        }
        
        document.getElementById('deleteConfirmationText').textContent = 
            `Вы уверены, что хотите удалить ${selectedOrders.length} заказов? Это действие нельзя отменить.`;
        document.getElementById('deleteConfirmationModal').classList.remove('hidden');
    });
}

async function deleteSelectedOrders() {
    if (selectedOrders.length === 0) return;
    
    let deletedCount = 0;
    let errorMessages = [];
    
    try {
        for (const orderId of selectedOrders) {
            try {
                const response = await fetch(`/api/orders/${orderId}`, {
                    method: 'DELETE'
                });
                
                // Проверяем, есть ли тело ответа
                let responseData = {};
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    responseData = await response.json();
                }
                
                if (response.ok) {
                    deletedCount++;
                } else {
                    const errorMessage = responseData.error || responseData.message || `Ошибка ${response.status}`;
                    errorMessages.push(`Заказ #${orderId}: ${errorMessage}`);
                }
            } catch (error) {
                errorMessages.push(`Заказ #${orderId}: ${error.message || 'Неизвестная ошибка'}`);
            }
        }
        
        // Обновляем список заказов
        allOrders = allOrders.filter(order => !selectedOrders.includes(order.id));
        selectedOrders = [];
        
        renderOrders();
        updateNewOrdersBadge();
        
        if (deletedCount > 0) {
            let successMessage = `✅ Успешно удалено ${deletedCount} заказов!`;
            if (errorMessages.length > 0) {
                successMessage += ` Но ${errorMessages.length} заказов не удалось удалить.`;
                console.error('Ошибки при удалении:', errorMessages);
            }
            showMessage(successMessage, 'success');
        }
        
        if (errorMessages.length > 0 && deletedCount === 0) {
            showMessage('❌ Не удалось удалить ни одного заказа. Проверьте консоль для деталей.', 'error');
        }
    } catch (error) {
        console.error('Критическая ошибка при массовом удалении заказов:', error);
        showMessage('❌ Критическая ошибка: ' + (error.message || 'Не удалось выполнить операцию'), 'error');
    }
}

function updateDeleteSelectedButton() {
    const deleteBtn = document.getElementById('deleteSelectedOrdersBtn');
    if (!deleteBtn) return;
    
    deleteBtn.style.display = selectedOrders.length > 0 ? 'block' : 'none';
}

function setupOrderSearch() {
    document.getElementById('orderSearch').addEventListener('input', () => {
        currentPage = 1;
        renderOrders();
    });
}

function setupStatusFilter() {
    document.getElementById('statusFilter').addEventListener('change', () => {
        currentPage = 1;
        renderOrders();
    });
}

function setupCustomerFilter() {
    document.getElementById('customerFilter').addEventListener('change', () => {
        currentPage = 1;
        renderOrders();
    });
}

function renderCustomerFilter() {
    const customerFilter = document.getElementById('customerFilter');
    customerFilter.innerHTML = '<option value="all">Все клиенты</option>';
    
    customers.sort().forEach(customer => {
        const option = document.createElement('option');
        option.value = customer;
        option.textContent = customer;
        customerFilter.appendChild(option);
    });
}

function setupPagination() {
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderOrders();
        }
    });
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(getFilteredOrders().length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderOrders();
        }
    });
}

function updatePaginationControls(totalPages) {
    const paginationControls = document.getElementById('paginationControls');
    if (!paginationControls) return;
    
    const paginationInfo = paginationControls.querySelector('.pagination-info');
    const prevBtn = paginationControls.querySelector('#prevPageBtn');
    const nextBtn = paginationControls.querySelector('#nextPageBtn');
    const pageNumbers = paginationControls.querySelector('#pageNumbers');
    
    const filteredOrders = getFilteredOrders();
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredOrders.length);
    paginationInfo.textContent = `Показано ${start}-${end} из ${filteredOrders.length} заказов`;
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    pageNumbers.innerHTML = '';
    if (totalPages <= 1) return;
    
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'page-number';
        pageBtn.textContent = i;
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderOrders();
        });
        pageNumbers.appendChild(pageBtn);
    }
}

function getFilteredOrders() {
    const searchTerm = document.getElementById('orderSearch').value.toLowerCase().trim();
    const statusFilter = document.getElementById('statusFilter').value;
    const customerFilter = document.getElementById('customerFilter').value;
    
    let filtered = [...allOrders];
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    if (customerFilter !== 'all') {
        filtered = filtered.filter(order => order.customerName === customerFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(order => {
            return order.id.toString().includes(searchTerm) ||
                   order.customerName.toLowerCase().includes(searchTerm) ||
                   order.phone.includes(searchTerm) ||
                   (order.email && order.email.toLowerCase().includes(searchTerm)) ||
                   order.items.some(item => item.name.toLowerCase().includes(searchTerm));
        });
    }
    
    return filtered;
}

function setupModalClose() {
    document.querySelector('#orderDetailsModal .close').addEventListener('click', () => {
        document.getElementById('orderDetailsModal').classList.add('hidden');
    });
    document.querySelector('#deleteConfirmationModal .close').addEventListener('click', () => {
        document.getElementById('deleteConfirmationModal').classList.add('hidden');
        orderToDelete = null;
    });
    document.querySelector('#settingsModal .close').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
    });
}

function showMessage(text, type) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = text;
    messageEl.style.position = 'fixed';
    messageEl.style.top = '20px';
    messageEl.style.right = '20px';
    messageEl.style.zIndex = '10000';
    messageEl.style.padding = '10px 20px';
    messageEl.style.borderRadius = '4px';
    messageEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    messageEl.style.color = 'white';
    messageEl.style.fontWeight = 'bold';
    
    if (type === 'success') {
        messageEl.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        messageEl.style.backgroundColor = '#dc3545';
    }
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            document.body.removeChild(messageEl);
        }, 500);
    }, 3000);
}

const savedItemsPerPage = localStorage.getItem('ordersItemsPerPage');
if (savedItemsPerPage) {
    itemsPerPage = parseInt(savedItemsPerPage);
}