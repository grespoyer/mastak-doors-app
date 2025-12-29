// Список цветов для отображения в палитре
const colorPalette = [
    "Винил белый",  // 1
    "Эмаль белая",  // 2
    "Глянец белый",  // 3
    "Кедр снежный",  // 4
    "Бетон светлый",  // 5
    "Дуб нордик",  // 6
    //
    "Винил платина",  // 7
    "Эмаль серая",     // 8
    "Эмаль слоновая кость",  // 9
    "softTouch Жемчужный",  // 10
    "Винил ваниль",  // 11
    "Эмаль латте",  // 12
    //
    "Белый кипарис",  // 13
    "softTouch Кремовый",  // 14
    "Дуб снежный",  // 15
    "Лиственница белая",  // 16
    "Винил сэнд",   // 17
    "Глянец мокко",  // 18
    //
    "Дуб золотистый",  // 19
    "Лиственница мокко",  // 20
    "Дуб натуральный",  // 21
    "Акация кремовая",  // 22
    "softTouch Графит",  // 23
    "Лиственница латте",   // 24
    //
    "Винил серый",  // 25
    "Ясень дымчатый",   // 26
    "Кедр серый",  // 27
    "Черное дерево",   // 28
    "Бетон темный",  // 29
    "Лиственница темная",  // 30
    //
    "Темный кипарис",  // 31
    "Винил черный"  // 32
];
// Функция заполнения опций фильтров
function populateFilterOptions() {
    // Сначала получаем видимые категории
    loadVisibleCategories().then(() => {
        // Фильтруем категории, оставляя только видимые
        const categories = [...new Set(allProducts
            .map(p => p.category)
            .filter(cat => cat && cat !== 'ignore' && (visibleCategories.length === 0 || visibleCategories.includes(cat)))
        )];
        // Сортируем цвета в алфавитном порядке
        const colors = [...new Set(allProducts.map(p => p.color))].filter(Boolean).sort();
        // Заполняем категории
        categoryFilter.innerHTML = '<option value="">Все</option>';
        categories.forEach(cat => {
            if (cat) {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categoryFilter.appendChild(option);
            }
        });
        // Заполняем цвета
        colorFilter.innerHTML = '<option value="">Все</option>';
        colors.forEach(color => {
            const option = document.createElement('option');
            option.value = color;
            option.textContent = color;
            colorFilter.appendChild(option);
        });

        // Заполняем палитру цветов
        populateColorPalette();
    });
}

// Функция для добавления слайдера цены в интерфейс
function addPriceRangeFilter() {
    const filtersContainer = document.getElementById('filters');
    if (!filtersContainer) return;
    
    // Проверяем, не добавлен ли уже слайдер
    if (document.querySelector('.price-range-container')) return;
    
    // Создаем элемент для фильтра цены
    const priceFilterHTML = `
        <label>
            Цена:
            <div class="price-range-container">
                <div class="price-range-slider">
                    <div class="slider-track"></div>
                    <div class="slider-range"></div>
                    <div class="slider-thumb min-thumb"></div>
                    <div class="slider-thumb max-thumb"></div>
                    <div class="slider-tooltip min-tooltip"></div>
                    <div class="slider-tooltip max-tooltip"></div>
                </div>
                <div class="price-range-values">
                    <span class="min-value">1</span> ₽ — <span class="max-value">10000</span> ₽
                </div>
            </div>
        </label>
    `;
    
    // Вставляем HTML перед кнопкой выбора цвета
    const colorPaletteToggle = filtersContainer.querySelector('.color-palette-toggle');
    if (colorPaletteToggle) {
        colorPaletteToggle.insertAdjacentHTML('beforebegin', priceFilterHTML);
    } else {
        filtersContainer.insertAdjacentHTML('beforeend', priceFilterHTML);
    }
}
// grespoyer
// Функция заполнения палитры цветов
function populateColorPalette() {
    const paletteGrid = document.querySelector('.palette-grid');
    if (!paletteGrid) return;
    paletteGrid.innerHTML = '';
    
    // Определяем, какие цвета доступны в текущем ценовом диапазоне
    const availableColorsInPriceRange = new Set();
    
    // Фильтруем товары по текущему ценовому диапазону и другим фильтрам
    let filteredProducts = [...allProducts];
    
    // Применяем все текущие фильтры кроме цвета
    if (filters.category) {
        filteredProducts = filteredProducts.filter(p => p.category === filters.category);
    }
    
    if (filters.search) {
        const normalizedSearch = normalizeForSearch(filters.search);
        filteredProducts = filteredProducts.filter(p => 
            normalizeForSearch(p.name).includes(normalizedSearch) || 
            (p.item && normalizeForSearch(p.item).includes(normalizedSearch))
        );
    }
    
    // Фильтруем по видимым категориям
    if (visibleCategories.length > 0) {
        filteredProducts = filteredProducts.filter(product => {
            if (!product.category || product.category === 'ignore') {
                return true;
            }
            return visibleCategories.includes(product.category);
        });
    }
    
    // Применяем фильтр по цене
    filteredProducts = filteredProducts.filter(p => 
        p.price >= priceRange.min && p.price <= priceRange.max
    );
    
    // Собираем доступные цвета
    filteredProducts.forEach(p => {
        if (p.color) {
            availableColorsInPriceRange.add(p.color);
        }
    });
    
    // Флаг для отслеживания наличия цветов
    let hasAvailableColors = false;
    
    // Проходим по всем цветам в заданном порядке
    colorPalette.forEach((colorName, index) => {
        // Проверяем, доступен ли цвет
        const isAvailable = availableColorsInPriceRange.has(colorName);
        
        // Пропускаем недоступные цвета
        if (!isAvailable) {
            return;
        }
        
        hasAvailableColors = true;
        
        // Создаем элемент только для доступных цветов
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        colorItem.dataset.color = colorName;
        colorItem.title = colorName;
        
        // Добавляем выделение для выбранного цвета
        if (filters.color === colorName) {
            colorItem.classList.add('selected');
        }
        
        // Номер изображения соответствует порядковому номеру цвета в массиве
        const imageNumber = index + 1;
        
        const img = document.createElement('img');
        img.src = `/uploads/palette/${imageNumber}.jpg`;
        img.alt = colorName;
        img.onerror = function() {
            this.style.display = 'none';
            this.parentElement.style.backgroundColor = '#f0f0f0';
            this.parentElement.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #888; font-weight: bold; text-align: center; padding: 5px;">${colorName.split(' ')[0]}</div>`;
        };
        
        const label = document.createElement('div');
        label.className = 'color-label';
        label.textContent = colorName;
        
        colorItem.appendChild(img);
        colorItem.appendChild(label);
        
        // Обработчик клика
        colorItem.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Если цвет уже выбран - сбрасываем его
            if (filters.color === colorName) {
                filters.color = '';
                
                // Снимаем выделение со всех элементов
                document.querySelectorAll('.color-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // Обновляем выбор в селекте цветов
                const colorFilter = document.getElementById('color-filter');
                if (colorFilter) {
                    colorFilter.value = '';
                }
                
                applyFilters();
                showNotification(`Фильтр по цвету "${colorName}" сброшен`, 'info', 2000);
                return;
            }
            
            // Выбираем цвет
            selectColorFromPalette(colorName);
        });
        
        paletteGrid.appendChild(colorItem);
    });
    
    // Если нет доступных цветов
    if (!hasAvailableColors) {
        const noColorsMessage = document.createElement('div');
        noColorsMessage.className = 'no-colors-message';
        noColorsMessage.style.padding = '20px';
        noColorsMessage.style.textAlign = 'center';
        noColorsMessage.style.color = '#6c757d';
        noColorsMessage.innerHTML = '<p>Нет доступных цветов при текущих фильтрах</p><p>Попробуйте расширить ценовой диапазон</p>';
        paletteGrid.appendChild(noColorsMessage);
    }
}

// Функция выбора цвета из палитры
function selectColorFromPalette(colorName) {
    // Закрываем панель палитры
    document.getElementById('color-palette-panel').classList.add('hidden');
    
    // Устанавливаем выбранный цвет в фильтр
    filters.color = colorName;
    // Устанавливаем категорию "Межкомнатные двери"
    filters.category = 'Межкомнатные двери';
    
    // Обновляем выбор в селектах
    const colorFilter = document.getElementById('color-filter');
    const categoryFilter = document.getElementById('category-filter');
    
    // Снимаем выделение со всех элементов
    document.querySelectorAll('.color-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Находим и выделяем выбранный элемент
    const selectedItem = document.querySelector(`.color-item[data-color="${colorName}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    // Обновляем селект цвета
    for (let i = 0; i < colorFilter.options.length; i++) {
        if (colorFilter.options[i].value === colorName) {
            colorFilter.selectedIndex = i;
            break;
        }
    }
    
    // Обновляем селект категории
    for (let i = 0; i < categoryFilter.options.length; i++) {
        if (categoryFilter.options[i].value === 'Межкомнатные двери') {
            categoryFilter.selectedIndex = i;
            break;
        }
    }
    
    // Применяем фильтры
    applyFilters();
    
    // Показываем уведомление о выбранном цвете
    showNotification(`Выбран цвет: ${colorName} в категории "Межкомнатные двери"`, 'info', 2000);
}

// Переключение отображения панели палитры цветов
function toggleColorPalette() {
    const palettePanel = document.getElementById('color-palette-panel');
    const toggleIcon = document.querySelector('.toggle-icon');
    if (palettePanel.classList.contains('hidden')) {
        palettePanel.classList.remove('hidden');
        toggleIcon.classList.add('open');
        
        // Обновляем палитру при открытии, чтобы отобразить текущий выбранный цвет
        populateColorPalette();
        
        // Закрываем панель при клике вне ее
        document.addEventListener('click', closePaletteOnClickOutside);
    } else {
        palettePanel.classList.add('hidden');
        toggleIcon.classList.remove('open');
        document.removeEventListener('click', closePaletteOnClickOutside);
    }
}

// Закрытие панели при клике вне ее
function closePaletteOnClickOutside(e) {
    const palettePanel = document.getElementById('color-palette-panel');
    const paletteToggle = document.querySelector('.color-palette-toggle');
    const closeBtn = document.querySelector('.close-palette');
    
    if (!palettePanel.contains(e.target) && 
        !paletteToggle.contains(e.target) && 
        !closeBtn.contains(e.target)) {
        palettePanel.classList.add('hidden');
        document.querySelector('.toggle-icon').classList.remove('open');
        document.removeEventListener('click', closePaletteOnClickOutside);
    }
}

// Инициализация обработчиков событий для фильтров
function initFilterEventListeners() {
    // Фильтры
    categoryFilter.addEventListener('change', (e) => {
        filters.category = e.target.value;
        applyFilters();
    });
    colorFilter.addEventListener('change', (e) => {
        filters.color = e.target.value;
        applyFilters();
    });
    // Поиск
    searchInput.addEventListener('input', (e) => {
        filters.search = e.target.value.trim();
        applyFilters();
    });
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        filters.search = '';
        
        // Сбрасываем фильтр цены до изначальных значений
        if (initialPriceRange.min !== undefined && initialPriceRange.max !== undefined) {
            priceRange = { ...initialPriceRange };
            updateSliderPosition();
        }
        
        applyFilters();
    });
    
    // Обработчики для палитры цветов
    document.querySelector('.color-palette-toggle').addEventListener('click', toggleColorPalette);
    document.querySelector('.close-palette').addEventListener('click', () => {
        document.getElementById('color-palette-panel').classList.add('hidden');
        document.querySelector('.toggle-icon').classList.remove('open');
        document.removeEventListener('click', closePaletteOnClickOutside);
    });
}