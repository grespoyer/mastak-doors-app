document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM полностью загружен. Инициализация скриптов партнеров...');
  
  // Проверка существования необходимых элементов
  const requiredElements = [
    'addPartnerBtn',
    'partnersTableBody',
    'noPartnersMessage',
    'partnerSearch',
    'partnerForm',
    'partnerModal',
    'deletePartnerModal',
    'notificationModal'
  ];
  
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  
  if (missingElements.length > 0) {
    console.error('❌ Отсутствуют обязательные элементы на странице:', missingElements);
    alert('Ошибка инициализации страницы. Отсутствуют следующие элементы: ' + missingElements.join(', '));
    return;
  }
  
  setupLogout();
  setupEventListeners();
  setupModalClose();
  loadPartners();
  updateNewOrdersBadge();
  setInterval(updateNewOrdersBadge, 30000);
  
  console.log('✅ Скрипты партнеров успешно инициализированы');
});

let currentPartnerId = null;

function setupEventListeners() {
  console.log('Настройка обработчиков событий...');
  
  // Кнопка "Добавить партнера"
  const addPartnerBtn = document.getElementById('addPartnerBtn');
  if (addPartnerBtn) {
    addPartnerBtn.addEventListener('click', () => {
      console.log('Нажата кнопка "Добавить партнера"');
      resetPartnerForm();
      document.getElementById('modalTitle').textContent = '➕ Добавить нового партнера';
      document.getElementById('savePartnerBtn').textContent = '➕ Добавить партнера';
      document.getElementById('partnerModal').classList.remove('hidden');
    });
  } else {
    console.error('❌ Не найдена кнопка #addPartnerBtn');
  }

  // Форма партнера
  const partnerForm = document.getElementById('partnerForm');
  if (partnerForm) {
    partnerForm.addEventListener('submit', savePartner);
  } else {
    console.error('❌ Не найдена форма #partnerForm');
  }

  // Поиск партнеров
  const partnerSearch = document.getElementById('partnerSearch');
  if (partnerSearch) {
    partnerSearch.addEventListener('input', () => {
      console.log('Выполняется поиск партнеров:', partnerSearch.value);
      loadPartners();
    });
  } else {
    console.error('❌ Не найдено поле поиска #partnerSearch');
  }

  // Кнопка подтверждения удаления
  const confirmDeletePartnerBtn = document.getElementById('confirmDeletePartnerBtn');
  if (confirmDeletePartnerBtn) {
    confirmDeletePartnerBtn.addEventListener('click', deletePartner);
  } else {
    console.error('❌ Не найдена кнопка #confirmDeletePartnerBtn');
  }

  // Кнопка отмены удаления
  const cancelDeletePartnerBtn = document.getElementById('cancelDeletePartnerBtn');
  if (cancelDeletePartnerBtn) {
    cancelDeletePartnerBtn.addEventListener('click', () => {
      document.getElementById('deletePartnerModal').classList.add('hidden');
    });
  }
}

function setupModalClose() {
  console.log('Настройка закрытия модальных окон...');
  
  // Закрытие модального окна партнера
  const partnerModalClose = document.querySelector('#partnerModal .close');
  if (partnerModalClose) {
    partnerModalClose.addEventListener('click', () => {
      document.getElementById('partnerModal').classList.add('hidden');
    });
  }

  // Закрытие модального окна удаления
  const deletePartnerModalClose = document.querySelector('#deletePartnerModal .close');
  if (deletePartnerModalClose) {
    deletePartnerModalClose.addEventListener('click', () => {
      document.getElementById('deletePartnerModal').classList.add('hidden');
    });
  }

  // Закрытие модального окна уведомления
  const notificationModalClose = document.querySelector('#notificationModal .close');
  if (notificationModalClose) {
    notificationModalClose.addEventListener('click', () => {
      document.getElementById('notificationModal').classList.add('hidden');
    });
  }

  // Кнопка закрытия уведомления
  const closeNotificationBtn = document.getElementById('closeNotificationBtn');
  if (closeNotificationBtn) {
    closeNotificationBtn.addEventListener('click', () => {
      document.getElementById('notificationModal').classList.add('hidden');
    });
  }
}

async function loadPartners() {
  console.log('Загрузка списка партнеров...');
  const tableBody = document.getElementById('partnersTableBody');
  const noPartnersMessage = document.getElementById('noPartnersMessage');
  
  try {
    const response = await fetch('/api/partners');
    console.log('Статус ответа от /api/partners:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const partners = await response.json();
    console.log('Получено партнеров:', partners.length);
    console.log('Данные партнеров:', partners);
    
    renderPartners(partners);
  } catch (error) {
    console.error('❌ Критическая ошибка при загрузке партнеров:', error);
    
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;color:#dc3545;padding:20px;">
            <strong>Ошибка загрузки партнеров:</strong> ${error.message || 'Неизвестная ошибка'}
            <br><br>
            <button class="btn btn-primary" onclick="location.reload()">🔄 Попробовать снова</button>
          </td>
        </tr>
      `;
    }
    
    if (noPartnersMessage) {
      noPartnersMessage.style.display = 'none';
    }
    
    // Показываем уведомление об ошибке
    showNotification('❌ Ошибка', 'Не удалось загрузить список партнеров. Проверьте консоль для деталей.');
  }
}

function renderPartners(partners) {
  console.log('Отрисовка партнеров. Всего:', partners.length);
  const searchTerm = document.getElementById('partnerSearch').value.toLowerCase().trim();
  console.log('Текущий поисковый запрос:', searchTerm);
  const filteredPartners = partners.filter(partner => {
    const matchesSearch = (
      partner.name.toLowerCase().includes(searchTerm) ||
      partner.username.toLowerCase().includes(searchTerm) ||
      (partner.contactPerson && partner.contactPerson.toLowerCase().includes(searchTerm)) ||
      (partner.email && partner.email.toLowerCase().includes(searchTerm)) ||
      (partner.phone && partner.phone.includes(searchTerm))
    );
    return matchesSearch;
  });
  console.log('Отфильтровано партнеров:', filteredPartners.length);
  const tableBody = document.getElementById('partnersTableBody');
  const noPartnersMessage = document.getElementById('noPartnersMessage');
  
  if (filteredPartners.length === 0) {
    console.log('Партнеров не найдено');
    noPartnersMessage.style.display = 'block';
    if (tableBody) tableBody.innerHTML = '';
  } else {
    noPartnersMessage.style.display = 'none';
    if (tableBody) {
      tableBody.innerHTML = filteredPartners.map(partner => {
        const createdAt = partner.createdAt ? new Date(partner.createdAt).toLocaleDateString('ru-RU') : '—';
        return `
          <tr data-id="${partner.id}">
            <td>${partner.id}</td>
            <td><strong>${partner.name}</strong></td>
            <td>${partner.username}</td>
            <td>${partner.contactPerson || '—'}</td>
            <td>${partner.email || '—'}</td>
            <td>${partner.phone || '—'}</td>
            <td>${createdAt}</td>
            <td class="partner-actions">
              <button class="btn btn-sm btn-success action-btn edit-partner-btn" data-id="${partner.id}" title="Редактировать">✏️</button>
              <button class="btn btn-sm btn-warning action-btn reset-password-btn" data-id="${partner.id}" title="Сбросить пароль">🔑</button>
              <button class="btn btn-sm btn-danger action-btn delete-partner-btn" data-id="${partner.id}" title="Удалить">🗑️</button>
            </td>
          </tr>
        `;
      }).join('');
      
      // Удаляем старые обработчики, чтобы избежать дублирования
      document.querySelectorAll('.edit-partner-btn, .reset-password-btn, .delete-partner-btn').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
      });
      
      console.log('Добавление обработчиков для кнопок партнеров...');
      // Добавляем обработчики для кнопок редактирования
      document.querySelectorAll('.edit-partner-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partnerId = btn.dataset.id;
          console.log('Нажата кнопка редактирования партнера с ID:', partnerId);
          editPartner(partnerId);
        });
      });
      
      // Добавляем обработчики для кнопок удаления
      document.querySelectorAll('.delete-partner-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partnerId = btn.dataset.id;
          console.log('Нажата кнопка удаления партнера с ID:', partnerId);
          showDeleteConfirmation(partnerId);
        });
      });
      
      // Добавляем обработчики для кнопок сброса пароля
      document.querySelectorAll('.reset-password-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const partnerId = btn.dataset.id;
          console.log('Нажата кнопка сброса пароля партнера с ID:', partnerId);
          resetPartnerPassword(partnerId);
        });
      });
    }
  }
}

function resetPartnerForm() {
  console.log('Сброс формы партнера');
  const partnerForm = document.getElementById('partnerForm');
  if (partnerForm) {
    partnerForm.reset();
    document.getElementById('partnerId').value = '';
    document.getElementById('partnerPassword').placeholder = 'минимум 6 символов';
  }
}

async function editPartner(partnerId) {
  console.log('Редактирование партнера с ID:', partnerId);
  try {
    const response = await fetch(`/api/partners/${partnerId}`);
    if (!response.ok) {
      throw new Error(`Партнер не найден: ${response.status}`);
    }
    const partner = await response.json();
    console.log('Данные партнера для редактирования:', partner);
    
    // Проверяем существование всех элементов
    const elements = {
      partnerId: document.getElementById('partnerId'),
      partnerName: document.getElementById('partnerName'),
      partnerUsername: document.getElementById('partnerUsername'),
      partnerPassword: document.getElementById('partnerPassword'),
      partnerContactPerson: document.getElementById('partnerContactPerson'),
      partnerEmail: document.getElementById('partnerEmail'),
      partnerPhone: document.getElementById('partnerPhone'),
      modalTitle: document.getElementById('modalTitle'),
      savePartnerBtn: document.getElementById('savePartnerBtn'),
      partnerModal: document.getElementById('partnerModal')
    };
    
    // Если какой-то элемент не существует, выводим ошибку
    Object.entries(elements).forEach(([name, el]) => {
      if (!el) console.error(`❌ Элемент ${name} не найден`);
    });
    
    // Устанавливаем значения только если элементы существуют
    if (elements.partnerId) elements.partnerId.value = partner.id;
    if (elements.partnerName) elements.partnerName.value = partner.name;
    if (elements.partnerUsername) elements.partnerUsername.value = partner.username;
    if (elements.partnerPassword) {
      elements.partnerPassword.value = '';
      elements.partnerPassword.placeholder = 'Оставить без изменений или ввести новый';
    }
    if (elements.partnerContactPerson) elements.partnerContactPerson.value = partner.contactPerson || '';
    if (elements.partnerEmail) elements.partnerEmail.value = partner.email || '';
    if (elements.partnerPhone) elements.partnerPhone.value = partner.phone || '';
    if (elements.modalTitle) elements.modalTitle.textContent = '✏️ Редактировать партнера: ' + partner.name;
    if (elements.savePartnerBtn) elements.savePartnerBtn.textContent = '💾 Сохранить изменения';
    if (elements.partnerModal) elements.partnerModal.classList.remove('hidden');
  } catch (error) {
    console.error('❌ Ошибка загрузки партнера:', error);
    showNotification('❌ Ошибка', 'Не удалось загрузить данные партнера: ' + error.message);
  }
}

function showDeleteConfirmation(partnerId) {
  console.log('Показать подтверждение удаления партнера с ID:', partnerId);
  currentPartnerId = partnerId;
  document.getElementById('deletePartnerModal').classList.remove('hidden');
}

async function deletePartner() {
  console.log('Удаление партнера с ID:', currentPartnerId);
  
  if (!currentPartnerId) {
    console.error('❌ Нет ID партнера для удаления');
    return;
  }
  
  try {
    const response = await fetch(`/api/partners/${currentPartnerId}`, {
      method: 'DELETE'
    });
    
    console.log('Статус ответа при удалении:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Ошибка удаления партнера: ${response.status}`);
    }
    
    showNotification('✅ Успех', 'Партнер успешно удален');
    loadPartners();
    
  } catch (error) {
    console.error('❌ Ошибка удаления партнера:', error);
    showNotification('❌ Ошибка', error.message || 'Не удалось удалить партнера');
  } finally {
    document.getElementById('deletePartnerModal').classList.add('hidden');
    currentPartnerId = null;
  }
}

async function resetPartnerPassword(partnerId) {
  if (!confirm('Вы уверены, что хотите сбросить пароль этого партнера? Новый пароль будет отправлен администратору.')) {
    console.log('Сброс пароля отменен пользователем');
    return;
  }
  
  console.log('Сброс пароля для партнера с ID:', partnerId);
  
  try {
    const response = await fetch(`/api/partners/${partnerId}/reset-password`, {
      method: 'POST'
    });
    
    console.log('Статус ответа при сбросе пароля:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Ошибка сброса пароля: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Результат сброса пароля:', result);
    showNotification('✅ Успех', result.message || 'Пароль успешно сброшен');
    
  } catch (error) {
    console.error('❌ Ошибка сброса пароля:', error);
    showNotification('❌ Ошибка', error.message || 'Не удалось сбросить пароль');
  }
}

async function savePartner(e) {
  e.preventDefault();
  console.log('Сохранение партнера...');
  
  const partnerId = document.getElementById('partnerId').value;
  const partnerData = {
    username: document.getElementById('partnerUsername').value.trim(),
    name: document.getElementById('partnerName').value.trim(),
    contactPerson: document.getElementById('partnerContactPerson').value.trim(),
    email: document.getElementById('partnerEmail').value.trim(),
    phone: document.getElementById('partnerPhone').value.trim()
  };
  
  // Добавляем пароль только при создании или если он был изменен
  const password = document.getElementById('partnerPassword').value.trim();
  if (!partnerId || password) {
    if (password.length < 6) {
      console.error('❌ Пароль слишком короткий');
      showNotification('❌ Ошибка', 'Пароль должен содержать минимум 6 символов');
      return;
    }
    partnerData.password = password;
  }
  
  console.log('Данные партнера для сохранения:', partnerData);
  
  try {
    let url, method;
    if (partnerId) {
      // Обновление существующего партнера
      url = `/api/partners/${partnerId}`;
      method = 'PUT';
      console.log('Обновление партнера с ID:', partnerId);
    } else {
      // Создание нового партнера
      url = '/api/partners';
      method = 'POST';
      console.log('Создание нового партнера');
    }
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(partnerData)
    });
    
    console.log('Статус ответа при сохранении:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || (partnerId ? 
        `Ошибка обновления партнера: ${response.status}` : 
        `Ошибка создания партнера: ${response.status}`);
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('Результат сохранения:', result);
    
    showNotification('✅ Успех', partnerId ? 'Партнер успешно обновлен' : 'Партнер успешно добавлен');
    document.getElementById('partnerModal').classList.add('hidden');
    loadPartners();
    
  } catch (error) {
    console.error('❌ Ошибка сохранения партнера:', error);
    showNotification('❌ Ошибка', error.message || 'Не удалось сохранить партнера');
  }
}

function showNotification(title, text) {
  console.log('Показать уведомление:', title, text);
  const notificationTitle = document.getElementById('notificationTitle');
  const notificationText = document.getElementById('notificationText');
  const notificationModal = document.getElementById('notificationModal');
  
  if (notificationTitle) notificationTitle.textContent = title;
  if (notificationText) notificationText.textContent = text;
  if (notificationModal) {
    notificationModal.classList.remove('hidden');
    // Автоматическое закрытие через 3 секунды для успешных операций
    if (title.includes('✅')) {
      setTimeout(() => {
        notificationModal.classList.add('hidden');
      }, 3000);
    }
  }
}

function setupLogout() {
  console.log('Настройка функции выхода из системы...');
  window.logout = function() {
    console.log('Выход из системы...');
    fetch('/admin/logout', { method: 'POST' })
      .then(() => {
        console.log('✅ Успешный выход, перенаправление на страницу входа');
        window.location.href = '/admin/login';
      })
      .catch(error => {
        console.error('❌ Ошибка при выходе:', error);
        alert('Ошибка при выходе из системы. Попробуйте снова.');
      });
  };
}

// Функция обновления индикатора новых заказов
async function updateNewOrdersBadge() {
  console.log('Обновление индикатора новых заказов...');
  
  try {
    const response = await fetch('/api/orders');
    if (!response.ok) {
      console.warn('⚠️ Не удалось обновить индикатор заказов. Статус:', response.status);
      return;
    }
    
    const orders = await response.json();
    const newOrdersCount = orders.filter(order => order.status === 'new').length;
    const badge = document.getElementById('newOrdersBadge');
    
    if (badge) {
      badge.textContent = newOrdersCount;
      badge.style.display = newOrdersCount > 0 ? 'inline-block' : 'none';
      console.log(`✅ Обновлено количество новых заказов: ${newOrdersCount}`);
    }
  } catch (error) {
    console.error('❌ Ошибка обновления индикатора новых заказов:', error);
  }
}

// Экспортируем функции для глобального доступа
window.editPartner = editPartner;
window.deletePartner = deletePartner;
window.resetPartnerPassword = resetPartnerPassword;
window.showDeleteConfirmation = showDeleteConfirmation;
window.savePartner = savePartner;
window.loadPartners = loadPartners;
window.resetPartnerForm = resetPartnerForm;