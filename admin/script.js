// Глобальные переменные
let currentEditingId = null;
let allProducts = [];
let visibleCategories = [];
let visibleColumns = ['checkbox', 'image', 'name', 'price', 'stock', 'actions'];
const imageFiles = [];
let isColumnResizeMode = false;
let columnWidths = {};
let selectedCategory = 'all';
let isFormVisible = false;
let lastScrollPosition = 0;
let currentPage = 1;
let itemsPerPage = 10;

// Список всех возможных колонок
const allColumns = [
    { id: 'checkbox', name: '' },
    { id: 'image', name: 'Изображение' },
    { id: 'name', name: 'Название' },
    { id: 'size', name: 'Ширина (мм)' },
    { id: 'price', name: 'Цена' },
    { id: 'category', name: 'Категория' },
    { id: 'color', name: 'Цвет' },
    { id: 'glass', name: 'Стекло' },
    { id: 'item', name: 'Артикул' },
    { id: 'stock', name: 'Остаток' },
    { id: 'stockProgram', name: 'Склад. прогр.' },
    { id: 'actions', name: 'Действия' }
];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();
    loadProducts();
    loadVisibleCategories();
    loadVisibleColumns();
    setupLoginForm();
    setupCheckUpdate();
    setupLogout();
    setupProductSearch();
    setupBulkEdit();
    setupCategoryInputs();
    setupItemsPerPage();
    setupColumnResizeToggle();
    loadColumnWidths();
    setupSettings();
    setupCategoryFilter();
    setupToggleForm();
    setupCancelForm();
    setupOverlayClose();
    setupPagination();
    loadLastUpdateDate();
    
    // Обновляем индикатор новых заказов
    updateNewOrdersBadge();
    setInterval(updateNewOrdersBadge, 30000);
});

// === Пагинация ===
function setupPagination() {
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderProducts();
            updatePaginationControls();
        }
    });
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(getFilteredProducts().length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderProducts();
            updatePaginationControls();
        }
    });
}

function updatePaginationControls() {
    const filteredProducts = getFilteredProducts();
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    const paginationInfo = document.getElementById('paginationInfo');
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredProducts.length);
    paginationInfo.textContent = `Показано ${start}-${end} из ${filteredProducts.length} товаров`;
    
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages || totalPages === 0;
    
    const pageNumbersContainer = document.getElementById('pageNumbers');
    pageNumbersContainer.innerHTML = '';
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
            renderProducts();
            updatePaginationControls();
        });
        pageNumbersContainer.appendChild(pageBtn);
    }
}

function getFilteredProducts() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    let filtered = allProducts.filter(p => {
        if (categoryFilter !== 'all' && p.category !== categoryFilter) {
            return false;
        }
        return true;
    });
    
    if (searchTerm) {
        const searchTerms = searchTerm.split(/\s+/).filter(term => term.length > 0);
        filtered = filtered.filter(p => {
            if (searchTerms.length === 0) return true;
            
            const nameLower = (p.name || '').toLowerCase();
            const allTermsInName = searchTerms.every(term => nameLower.includes(term));
            if (allTermsInName) return true;
            
            return (p.price?.toString() || '').includes(searchTerm) ||
                   (p.stock?.toString() || '').includes(searchTerm) ||
                   (p.category?.toLowerCase() || '').includes(searchTerm) ||
                   (p.color?.toLowerCase() || '').includes(searchTerm) ||
                   (p.glass?.toLowerCase() || '').includes(searchTerm) ||
                   (p.item?.toLowerCase() || '').includes(searchTerm);
        });
    }
    return filtered;
}

// === Переключение формы ===
function setupToggleForm() {
    document.getElementById('toggleFormBtn').addEventListener('click', showAddForm);
}

function setupCancelForm() {
    document.getElementById('cancelFormBtn').addEventListener('click', hideForm);
}

function showAddForm() {
    resetForm();
    document.querySelector('.dashboard').classList.add('form-visible');
    document.getElementById('formCard').classList.remove('hidden');
    document.getElementById('formCard').classList.add('adding-form');
    document.getElementById('formCard').classList.remove('editing-form');
    lastScrollPosition = document.getElementById('tableContainer').scrollTop;
    isFormVisible = true;
}

function hideForm() {
    document.querySelector('.dashboard').classList.remove('form-visible');
    document.getElementById('formCard').classList.add('hidden');
    document.getElementById('formCard').classList.remove('editing-form');
    document.getElementById('formCard').classList.remove('adding-form');
    setTimeout(() => {
        document.getElementById('tableContainer').scrollTop = lastScrollPosition;
    }, 300);
    clearEditingHighlight();
    isFormVisible = false;
}

function setupOverlayClose() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay hidden';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', hideForm);
}

// === Настройки ===
function setupSettings() {
    document.getElementById('openSettingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('hidden');
        renderVisibleCategories();
        renderVisibleColumns();
    });
    document.querySelector('#settingsModal .close').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
    });
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
}

async function saveSettings() {
    const itemsPerPageSetting = document.getElementById('itemsPerPage').value;
    localStorage.setItem('itemsPerPage', itemsPerPageSetting);
    itemsPerPage = itemsPerPageSetting === 'all' ? Number.MAX_VALUE : parseInt(itemsPerPageSetting);
    
    const checkedColumns = Array.from(document.querySelectorAll('#columnsList input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    localStorage.setItem('visibleColumns', JSON.stringify(checkedColumns));
    visibleColumns = checkedColumns;
    
    const checkedCategories = Array.from(document.querySelectorAll('#categoriesList input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    try {
        const response = await fetch('/api/visible-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: checkedCategories })
        });
        if (!response.ok) throw new Error('Ошибка сохранения настроек');
        showMessage('categoriesMessage', '✅ Настройки сохранены', 'success');
        showMessage('columnsMessage', '✅ Настройки сохранены', 'success');
        document.getElementById('settingsModal').classList.add('hidden');
        loadVisibleCategories();
        renderProducts();
    } catch (error) {
        showMessage('categoriesMessage', '❌ ' + error.message, 'error');
    }
}

// === Управление видимыми колонками ===
function loadVisibleColumns() {
    const saved = localStorage.getItem('visibleColumns');
    if (saved) {
        try {
            visibleColumns = JSON.parse(saved);
        } catch (e) {
            console.error('Ошибка загрузки видимых колонок:', e);
            visibleColumns = ['checkbox', 'image', 'name', 'price', 'stock', 'actions'];
        }
    }
}

function renderVisibleColumns() {
    const columnsList = document.getElementById('columnsList');
    columnsList.innerHTML = allColumns.map(column => {
        const isChecked = visibleColumns.includes(column.id);
        return `
            <div class="column-item">
                <input type="checkbox" id="col-${column.id}" value="${column.id}" ${isChecked ? 'checked' : ''}>
                <label for="col-${column.id}">${column.name}</label>
            </div>
        `;
    }).join('');
}

// === Управление видимыми категориями ===
async function loadVisibleCategories() {
    try {
        const response = await fetch('/api/visible-categories');
        visibleCategories = await response.json();
        renderVisibleCategories();
    } catch (error) {
        console.error('Ошибка загрузки видимых категорий:', error);
    }
}

function renderVisibleCategories() {
    const categoriesList = document.getElementById('categoriesList');
    const allCategories = [...new Set(allProducts.map(p => p.category).filter(c => c && c !== 'ignore'))];
    if (allCategories.length === 0) {
        categoriesList.innerHTML = '<p>Нет категорий для настройки отображения</p>';
        return;
    }
    categoriesList.innerHTML = allCategories.map(category => {
        const isChecked = visibleCategories.includes(category) || visibleCategories.length === 0;
        return `
            <div class="category-item">
                <input type="checkbox" id="cat-${category}" value="${category}" ${isChecked ? 'checked' : ''}>
                <label for="cat-${category}">${category}</label>
            </div>
        `;
    }).join('');
}

// === Фильтрация по категориям ===
function setupCategoryFilter() {
    document.getElementById('categoryFilter').addEventListener('change', function() {
        selectedCategory = this.value;
        currentPage = 1;
        renderProducts();
    });
}

function renderCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    const currentValue = categoryFilter.value;
    const allCategories = [...new Set(allProducts.map(p => p.category).filter(c => c && c !== 'ignore'))];
    
    categoryFilter.innerHTML = '<option value="all">Все категории</option>';
    
    allCategories.sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
    
    if (allCategories.includes(currentValue)) {
        categoryFilter.value = currentValue;
        selectedCategory = currentValue;
    } else {
        categoryFilter.value = 'all';
        selectedCategory = 'all';
    }
}

// === Drag & Drop ===
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFiles, false);
}

function highlight() {
    document.getElementById('dropZone').classList.add('dragover');
}

function unhighlight() {
    document.getElementById('dropZone').classList.remove('dragover');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } });
}

function handleFiles(e) {
    const files = e.target.files;
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            addImagePreview(file);
            imageFiles.push(file);
        }
    });
}

function addImagePreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        const div = document.createElement('div');
        div.className = 'image-item';
        div.innerHTML = `
            <img src="${e.target.result}" alt="preview">
            <button class="remove-image" data-file="${file.name}">✕</button>
        `;
        preview.appendChild(div);
        div.querySelector('.remove-image').addEventListener('click', () => removeImage(file, div));
    };
    reader.readAsDataURL(file);
}

function removeImage(file, element) {
    const index = imageFiles.findIndex(f => f.name === file.name);
    if (index !== -1) {
        imageFiles.splice(index, 1);
    }
    element.remove();
}

// === Вспомогательные функции ===
function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function logout() {
    localStorage.removeItem('isAdminAuthenticated');
    window.location.href = '/admin/login';
}

function setupCheckUpdate() {
    document.getElementById('checkUpdateBtn').addEventListener('click', checkUpdate);
}

async function loadLastUpdateDate() {
    try {
        const response = await fetch('/api/last-update');
        if (!response.ok) throw new Error('Не удалось загрузить дату обновления');
        const data = await response.json();
        const lastUpdateDateEl = document.querySelector('#last-update-date');
        if (lastUpdateDateEl) {
            lastUpdateDateEl.textContent = `Актуально на: ${data.date || '5.12.2025'}`;
        }
    } catch (error) {
        console.error('Ошибка загрузки даты обновления:', error);
        const lastUpdateDateEl = document.querySelector('#last-update-date');
        if (lastUpdateDateEl) {
            lastUpdateDateEl.textContent = `Актуально на: 5.12.2025 (ошибка загрузки)`;
        }
    }
}

async function checkUpdate() {
    const button = document.getElementById('checkUpdateBtn');
    const originalText = button.textContent;
    try {
        button.disabled = true;
        button.textContent = '⏳ Выполняю...';
        showUpdateStatus('🔄 Начинаю проверку обновлений...', 'info');
        
        const response = await fetch('/api/check-update');
        const contentType = response.headers.get('content-type');
        if (!response.ok) {
            let errorMessage = 'Ошибка сервера при обновлении';
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        let result;
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            const text = await response.text();
            if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                throw new Error('Сервер вернул HTML вместо JSON. Проверьте токен доступа к админке.');
            }
            try {
                result = JSON.parse(text);
            } catch (e) {
                throw new Error(`Неверный формат ответа сервера: ${text.substring(0, 100)}...`);
            }
        }
        
        if (result.updated) {
            showUpdateStatus(`✅ Данные успешно обновлены! Дата: ${result.date}`, 'success');
        } else {
            showUpdateStatus(`ℹ️ Обновление не требуется. Данные актуальны на ${result.date}`, 'info');
        }
        
        await loadLastUpdateDate();
        await loadProducts();
        return result;
    } catch (error) {
        console.error('Ошибка при обновлении:', error);
        showUpdateStatus(`❌ Ошибка: ${error.message || error.toString()}`, 'error');
        throw error;
    } finally {
        button.disabled = false;
        button.textContent = originalText;
        setTimeout(hideUpdateStatus, 7000);
    }
}

function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = 'message ' + type;
    el.style.display = 'block';
    setTimeout(() => { if (el.textContent === text) el.style.display = 'none'; }, 5000);
}

function showUpdateStatus(message, type = 'info') {
    const el = document.getElementById('updateStatus');
    el.textContent = message;
    el.className = 'message ' + type;
    el.style.display = 'block';
}

function hideUpdateStatus() {
    document.getElementById('updateStatus').style.display = 'none';
}

// === Загрузка товаров ===
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        allProducts = await response.json();
        currentPage = 1;
        renderProducts();
        renderVisibleCategories();
        renderCategoryFilter();
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        document.getElementById('productsTableBody').innerHTML = `<tr><td colspan="${visibleColumns.length}" style="text-align:center;color:var(--danger);">Ошибка загрузки</td></tr>`;
    }
}

function renderProducts() {
    const tableHeaders = document.getElementById('tableHeaders');
    const tableBody = document.getElementById('productsTableBody');
    const noProductsMessage = document.getElementById('noProductsMessage');
    
    tableHeaders.innerHTML = visibleColumns.map(colId => {
        const column = allColumns.find(c => c.id === colId);
        const width = columnWidths[colId] || getDefaultColumnWidth(colId);
        if (colId === 'checkbox') {
            return `<th style="width: ${width}px">
                <div style="text-align: center; margin-bottom: 8px;">
                    <span style="font-weight: bold; color: #0d3b66; display: block;">Выделено: <span id="selectedCountHeader">0</span></span>
                </div>
                <input type="checkbox" id="selectAll">
            </th>`;
        } else if (colId === 'actions') {
            return `<th style="width: ${width}px">Действия</th>`;
        }
        return `<th style="width: ${width}px">${column ? column.name : colId}</th>`;
    }).join('');
    
    const filteredProducts = getFilteredProducts();
    const start = (currentPage - 1) * itemsPerPage;
    const currentProducts = itemsPerPage === Number.MAX_VALUE ? 
                           filteredProducts : 
                           filteredProducts.slice(start, start + itemsPerPage);
    
    if (currentProducts.length === 0) {
        noProductsMessage.style.display = 'block';
        tableBody.innerHTML = '';
        updatePaginationControls();
        updateSelectedCount();
    } else {
        noProductsMessage.style.display = 'none';
        tableBody.innerHTML = currentProducts.map(product => {
            let stockClass = 'stock-in';
            if (product.stock === 0) stockClass = 'stock-out';
            else if (product.stock < 5) stockClass = 'stock-low';
            
            const imageUrl = product.images && product.images[0] 
                ? product.images[0] 
                : 'https://via.placeholder.com/50?text=No+Image';
            
            const cells = visibleColumns.map(colId => {
                switch(colId) {
                    case 'checkbox':
                        return `<td style="text-align: center;"><input type="checkbox" class="product-checkbox" data-id="${product.id}"></td>`;
                    case 'image':
                        return `<td><img src="${imageUrl}" alt="" title="${product.name}" class="product-image"></td>`;
                    case 'name':
                        return `<td class="product-name" title="${product.name}">${product.name}</td>`;
                    case 'price':
                        return `<td>${(product.price !== undefined ? product.price.toFixed(2) : '—')} ₽</td>`;
                    case 'category':
                        return `<td>${product.category || '—'}</td>`;
                    case 'color':
                        return `<td>${product.color || '—'}</td>`;
                    case 'glass':
                        return `<td>${product.glass || '—'}</td>`;
                    case 'size':
                        return `<td>${product.size || '—'}</td>`;
                    case 'stock':
                        return `<td><span class="stock-badge ${stockClass}">${product.stock} шт</span></td>`;
                    case 'item':
                        return `<td>${product.item || '—'}</td>`;
                    case 'stockProgram':
                        return `<td>${product.stockProgram || '—'}</td>`;
                    case 'actions':
                        return `<td class="actions">
                            <button class="btn btn-success btn-sm action-btn" onclick="editProduct('${product.id}')">✏️</button>
                            <button class="btn btn-danger btn-sm action-btn" onclick="deleteProduct('${product.id}')">🗑️</button>
                        </td>`;
                    default:
                        return `<td>—</td>`;
                }
            }).join('');
            
            return `<tr data-id="${product.id}" data-name="${product.name}" data-price="${product.price || ''}" data-stock="${product.stock || ''}">
                ${cells}
            </tr>`;
        }).join('');
        
        setupSelectAll();
        if (isColumnResizeMode) {
            enableColumnResizing();
        } else {
            applyColumnWidths();
        }
        updatePaginationControls();
        updateSelectedCount();
    }
}

function getDefaultColumnWidth(colId) {
    const defaults = {
        'checkbox': 60,
        'image': 60,
        'name': 200,
        'price': 100,
        'category': 150,
        'color': 120,
        'glass': 120,
        'size': 80,
        'stock': 80,
        'item': 100,
        'stockProgram': 120,
        'actions': 80
    };
    return defaults[colId] || 100;
}

// === Поиск и пагинация ===
function setupProductSearch() {
    document.getElementById('productSearch').addEventListener('input', () => {
        currentPage = 1;
        renderProducts();
    });
}

function setupItemsPerPage() {
    document.getElementById('itemsPerPage').addEventListener('change', () => {
        const value = document.getElementById('itemsPerPage').value;
        itemsPerPage = value === 'all' ? Number.MAX_VALUE : parseInt(value);
        currentPage = 1;
        localStorage.setItem('itemsPerPage', value);
        renderProducts();
    });
}

// === Категории ===
function setupCategoryInputs() {
    const s1 = document.getElementById('formCategorySelect');
    const c1 = document.getElementById('formCategoryCustom');
    const s2 = document.getElementById('bulkCategorySelect');
    const c2 = document.getElementById('bulkCategoryCustom');
    c1.addEventListener('input', () => s1.value = '');
    s1.addEventListener('change', () => { if (s1.value) c1.value = ''; });
    c2.addEventListener('input', () => s2.value = '');
    s2.addEventListener('change', () => { if (s2.value) c2.value = ''; });
}

// === Редактирование ===
function clearEditingHighlight() {
    document.querySelectorAll('.editing-row').forEach(el => el.classList.remove('editing-row'));
}

async function editProduct(id) {
    clearEditingHighlight();
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
        row.classList.add('editing-row');
        row.classList.add('target-scroll');
        showEditForm(id);
        setTimeout(() => {
            positionTableToEditingRow(row);
        }, 300);
    }
}

function positionTableToEditingRow(row) {
    const tableContainer = document.getElementById('tableContainer');
    const rowRect = row.getBoundingClientRect();
    const containerRect = tableContainer.getBoundingClientRect();
    
    const rowTopInContainer = rowRect.top - containerRect.top + tableContainer.scrollTop;
    const scrollPosition = rowTopInContainer - (containerRect.height / 2) + (rowRect.height / 2);
    
    tableContainer.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
    });
    
    lastScrollPosition = scrollPosition;
}

function showEditForm(id) {
    document.querySelector('.dashboard').classList.add('form-visible');
    document.getElementById('formCard').classList.remove('hidden');
    document.getElementById('formCard').classList.add('editing-form');
    document.getElementById('formCard').classList.remove('adding-form');
    try {
        const product = allProducts.find(p => p.id === id);
        if (!product) throw new Error('Товар не найден');
        
        currentEditingId = id;
        document.getElementById('productId').value = id;
        document.getElementById('formTitle').textContent = '✏️ Редактировать: ' + product.name;
        document.getElementById('submitBtn').textContent = '💾 Сохранить изменения';
        document.querySelector('[name="name"]').value = product.name || '';
        document.querySelector('[name="price"]').value = product.price || '';
        document.querySelector('[name="color"]').value = product.color || '';
        document.querySelector('[name="glass"]').value = product.glass || '';
        document.querySelector('[name="size"]').value = product.size || '';
        document.querySelector('[name="stock"]').value = product.stock || 0;
        document.querySelector('[name="item"]').value = product.item || '';
        document.querySelector('[name="stockProgram"]').value = product.stockProgram || '';
        
        const s = document.getElementById('formCategorySelect');
        const c = document.getElementById('formCategoryCustom');
        const known = ['Межкомнатные двери', 'Двери со стеклом', 'Слайдеры', 'ignore'];
        if (known.includes(product.category)) {
            s.value = product.category;
            c.value = '';
        } else {
            s.value = '';
            c.value = product.category || '';
        }
        
        document.getElementById('imagePreview').innerHTML = '';
        imageFiles.length = 0;
        document.getElementById('imagesToDelete').value = '';
        
        if (product.images?.length) {
            product.images.forEach((url, index) => {
                const div = document.createElement('div');
                div.className = 'image-item';
                div.innerHTML = `
                    <img src="${url}" alt="existing">
                    <button class="remove-image" data-url="${url}" data-index="${index}">✕</button>
                `;
                document.getElementById('imagePreview').appendChild(div);
                div.querySelector('.remove-image').addEventListener('click', function() {
                    const urlToRemove = this.getAttribute('data-url');
                    const indexToRemove = this.getAttribute('data-index');
                    let imagesToDelete = document.getElementById('imagesToDelete').value.split(',').filter(Boolean);
                    if (!imagesToDelete.includes(urlToRemove)) {
                        imagesToDelete.push(urlToRemove);
                        document.getElementById('imagesToDelete').value = imagesToDelete.join(',');
                    }
                    div.remove();
                });
            });
        }
    } catch (error) {
        showMessage('formMessage', '❌ ' + error.message, 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('Удалить товар?')) return;
    try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Ошибка удаления');
        showMessage('formMessage', '✅ Удалено', 'success');
        clearEditingHighlight();
        loadProducts();
    } catch (error) {
        showMessage('formMessage', '❌ ' + error.message, 'error');
    }
}

// === Сохранение формы ===
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cat = document.getElementById('formCategoryCustom').value || document.getElementById('formCategorySelect').value || '';
    if (!cat) {
        alert('Укажите категорию');
        return;
    }
    const formData = new FormData();
    formData.append('id', document.getElementById('productId').value);
    formData.append('name', e.target.name.value.trim());
    formData.append('price', e.target.price.value || 0);
    formData.append('category', cat.trim());
    formData.append('color', (e.target.color.value || '').trim());
    formData.append('glass', (e.target.glass.value || '').trim());
    formData.append('size', e.target.size.value || '');
    formData.append('stock', e.target.stock.value || 0);
    formData.append('item', (e.target.item.value || '').trim());
    formData.append('stockProgram', e.target.stockProgram.value || 0);
    
    const imagesToDelete = document.getElementById('imagesToDelete').value;
    if (imagesToDelete) {
        formData.append('imagesToDelete', imagesToDelete);
    }
    
    imageFiles.forEach(f => formData.append('images', f));
    
    try {
        const res = await fetch('/api/products', { method: 'POST', body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Ошибка сохранения');
        clearEditingHighlight();
        showMessage('formMessage', `✅ ${currentEditingId ? 'Обновлено' : 'Добавлено'}!`, 'success');
        setTimeout(() => {
            hideForm();
            loadProducts();
        }, 1000);
    } catch (error) {
        showMessage('formMessage', '❌ ' + error.message, 'error');
    }
});

function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagesToDelete').value = '';
    imageFiles.length = 0;
    currentEditingId = null;
    document.getElementById('formTitle').textContent = '➕ Добавить новую дверь';
    document.getElementById('submitBtn').textContent = '➕ Добавить дверь';
    clearEditingHighlight();
}

// === Массовое редактирование ===
function setupBulkEdit() {
    document.getElementById('bulkEditBtn').addEventListener('click', () => {
        const checked = document.querySelectorAll('.product-checkbox:checked');
        if (checked.length === 0) {
            alert('Выберите товары для редактирования');
            return;
        }
        document.getElementById('bulkEditModal').classList.remove('hidden');
    });
    document.querySelector('#bulkEditModal .close').addEventListener('click', () => {
        document.getElementById('bulkEditModal').classList.add('hidden');
    });
    
    document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
        const checked = document.querySelectorAll('.product-checkbox:checked');
        if (checked.length === 0) {
            alert('Выберите товары для удаления');
            return;
        }
        if (!confirm(`Вы уверены, что хотите удалить ${checked.length} товаров?`)) {
            return;
        }
        const ids = Array.from(checked).map(cb => cb.dataset.id);
        let deletedCount = 0;
        try {
            for (const id of ids) {
                const response = await fetch(`/api/products/${id}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    deletedCount++;
                } else {
                    const errorData = await response.json().catch(() => null);
                    console.error(`Ошибка удаления товара ${id}:`, errorData?.error || 'Неизвестная ошибка');
                }
            }
            clearEditingHighlight();
            showMessage('formMessage', `✅ Успешно удалено ${deletedCount} товаров`, 'success');
            document.getElementById('bulkEditModal').classList.add('hidden');
            loadProducts();
        } catch (error) {
            console.error('Ошибка при массовом удалении:', error);
            showMessage('formMessage', '❌ ' + error.message, 'error');
        }
    });
    
    document.getElementById('applyBulkEdit').addEventListener('click', async () => {
        const checkedRows = Array.from(document.querySelectorAll('.product-checkbox:checked'))
            .map(cb => cb.dataset.id);
        if (checkedRows.length === 0) {
            alert('Выберите товары для редактирования');
            return;
        }
        const cat = document.getElementById('bulkCategoryCustom').value || 
                   (document.getElementById('bulkCategorySelect').value !== '' ? document.getElementById('bulkCategorySelect').value : null);
        const updates = {};
        if (cat !== null) updates.category = cat;
        if (document.getElementById('bulkColor').value) updates.color = document.getElementById('bulkColor').value;
        if (document.getElementById('bulkStockProgram').value !== '') updates.stockProgram = parseInt(document.getElementById('bulkStockProgram').value, 10);
        if (document.getElementById('bulkItem').value) updates.item = document.getElementById('bulkItem').value;
        if (document.getElementById('bulkPrice').value !== '') updates.price = parseFloat(document.getElementById('bulkPrice').value);
        if (Object.keys(updates).length === 0) {
            alert('Выберите поле для изменения');
            return;
        }
        try {
            const res = await fetch('/api/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: checkedRows, updates })
            });
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || 'Ошибка обновления');
            }
            showMessage('formMessage', '✅ Массовое обновление завершено', 'success');
            clearEditingHighlight();
            loadProducts();
            document.getElementById('bulkEditModal').classList.add('hidden');
            document.getElementById('bulkCategoryCustom').value = '';
            document.getElementById('bulkCategorySelect').value = '';
            document.getElementById('bulkColor').value = '';
            document.getElementById('bulkStockProgram').value = '';
            document.getElementById('bulkItem').value = '';
            document.getElementById('bulkPrice').value = '';
        } catch (error) {
            console.error('Ошибка при массовом обновлении:', error);
            showMessage('formMessage', '❌ ' + error.message, 'error');
        }
    });
}

function setupSelectAll() {
    const selectAll = document.getElementById('selectAll');
    if (!selectAll) return;
    const checkboxes = document.querySelectorAll('.product-checkbox');
    selectAll.addEventListener('change', () => {
        checkboxes.forEach(cb => {
            if (!cb.disabled) {
                cb.checked = selectAll.checked;
            }
        });
        updateSelectedCount();
    });
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const allChecked = Array.from(checkboxes)
                .filter(cb => !cb.disabled)
                .every(cb => cb.checked);
            selectAll.checked = allChecked;
            updateSelectedCount();
        });
    });
}

function updateSelectedCount() {
    const selectedCount = document.querySelectorAll('.product-checkbox:checked').length;
    const headerCount = document.getElementById('selectedCountHeader');
    if (headerCount) {
        headerCount.textContent = selectedCount;
    }
}

// === Изменение ширины колонок ===
function setupColumnResizeToggle() {
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'column-resize-toggle';
    toggleContainer.innerHTML = `
        <label class="switch">
            <input type="checkbox" id="resizeToggle">
            <span class="slider round"></span>
        </label>
        <span>Настроить ширину колонок</span>
    `;
    const cardHeader = document.querySelector('.products-card .card-header');
    cardHeader.insertBefore(toggleContainer, cardHeader.firstChild);
    document.getElementById('resizeToggle').addEventListener('change', function() {
        isColumnResizeMode = this.checked;
        if (isColumnResizeMode) enableColumnResizing(); else disableColumnResizing();
    });
}

function enableColumnResizing() {
    const headers = document.querySelectorAll('.product-table th');
    headers.forEach((header, index) => {
        if (header.querySelector('.resize-handle')) return;
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.innerHTML = '↔';
        header.appendChild(resizeHandle);
        let startX, startWidth;
        resizeHandle.addEventListener('mousedown', e => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = header.offsetWidth;
            const move = e => {
                const newWidth = Math.max(40, startWidth + (e.clientX - startX));
                const colId = visibleColumns[index] || `col-${index}`;
                columnWidths[colId] = newWidth;
                applyColumnWidths();
                saveColumnWidths();
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    });
    document.body.classList.add('resize-mode');
}

function disableColumnResizing() {
    document.querySelectorAll('.resize-handle').forEach(el => el.remove());
    document.body.classList.remove('resize-mode');
}

function applyColumnWidths() {
    const headers = document.querySelectorAll('.product-table th');
    headers.forEach((h, i) => {
        if (i < visibleColumns.length) {
            const colId = visibleColumns[i];
            const width = columnWidths[colId] || getDefaultColumnWidth(colId);
            h.style.width = width + 'px';
        }
    });
}

function saveColumnWidths() {
    localStorage.setItem('columnWidths', JSON.stringify(columnWidths));
}

function loadColumnWidths() {
    const saved = localStorage.getItem('columnWidths');
    if (saved) {
        try {
            columnWidths = JSON.parse(saved);
            applyColumnWidths();
        } catch (e) {
            console.error('Ошибка загрузки ширины:', e);
        }
    }
}

// === Форма входа (заглушка) ===
function setupLoginForm() {
    if (!localStorage.getItem('isAdminAuthenticated')) {
        localStorage.setItem('isAdminAuthenticated', 'true');
    }
}

// === Индикатор новых заказов ===
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