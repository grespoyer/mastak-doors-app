const fs = require('fs');
const path = require('path');

// --- КОНСТАНТЫ ---
const MODEL_NAMES = [
  "Вена", "Техас", "Т-1", "Бостон", "Эрмитаж-1", "Рим", "Графика-1", "Геометрия-1", "Лайн-1",
  "НеоКлассикаPRO-1", "ПГ Стиль-1", "Прага", "Сеул", "Монтана", "Т-2", "Гавана", "Эрмитаж-2",
  "Прадо", "Графика-2", "Геометрия-2", "Лайн-2", "НеоКлассикаPRO-2", "ПО Стиль-1",
  "Дрезден", "Дублин", "Невада", "Т-3", "Мальта", "Эрмитаж-3", "Прадо-2", "Графика-3",
  "Геометрия-3", "Лайн-3", "ПГ Классика-1", "ПГ-Стиль-2", "Каролина", "Т-4", "Мехико",
  "Эрмитаж-4", "Византия", "Гамбург", "Графика-4", "Геометрия-4", "Лайн-4", "ПГ Классика-2",
  "ПО-Стиль-2", "Валенсия", "Мюнхен", "Миссури", "Т-5", "Эрмитаж-5", "Спарта-2 бм", "Геометрия-5",
  "ПГ Классика-3", "ПГ Стиль Флэт", "Мадрид", "Эрмитаж-6", "Спарта-2 молдинг", "Геометрия-6",
  "ПО Классика-2", "ПГ Стиль Нео1", "Эрмитаж-7", "Киото", "Геометрия-7", "ПО Классика-3",
  "ПГ Стиль Нео2", "Эрмитаж-8", "Афина-1", "Геометрия-8", "ПО Классика-4", "ПГ Богема",
  "Рига", "Афина-2", "Олимпия", "Сингапур 5", "Барселона", "Севилья", "Пекин", "Франкфурт", "Порту",
  "СтильБогема", "Стиль-1", "Стиль-2", "СтильНео-1", "СтильФлэт", "СтильНео-2", "Классика-2",
  // Добавлены комбинированные названия для правила 03
  "СтильНео-1", "СтильНео-2", "СтильБогема", "СтильФлэт"
].map(name => name.trim().replace(/\*$/, '').trim()).filter(Boolean);

const BASE_COLORS = [
  "Лиственница мокко", "Белый кипарис", "Темный кипарис", "Дуб нордик", "Кедр Серый", "Кедр снежный",
  "Дуб натуральный", "Бетон Светлый", "Бетон Темный", "Ель Альпийская", "Графит", "Жемчужный",
  "Кремовый", "Soft Touch графит", "Soft Touch Жемчужный", "Soft Touch Кремовый",
  "Лиственница белая", "Лиственница темная", "Лиственница Латте", "Ясень Дымчатый", "Акация кремовая",
  "Дуб золотистый", "Дуб снежный", "Черное дерево"
];

const COATING_COLOR_MAP = {
  "эмаль": ["белая", "серая", "латтэ", "слоновая кость", "латте"],
  "vinyl": ["белый", "платина", "ваниль", "серый", "сэнд"],
  "винил": ["белый", "платина", "ваниль", "серый", "сэнд"],
  "ламинатин": ["белый", "латте", "слоновая кость", "серый"]
};

// Специальное отображение для комбинированных моделей (правило 03)
const SPECIAL_MODELS_MAP = {
  "СтильНео-1": "СТИЛЬ НЕО-1",
  "СтильНео-2": "СТИЛЬ НЕО-2",
  "СтильБогема": "СТИЛЬ БОГЕМА",
  "СтильФлэт": "СТИЛЬ ФЛЭТ"
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function toTitleCase(str) {
  return str.replace(/\b\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function normalize(str) {
  return str
    .replace(/СХЕМА\s*/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^а-яёa-z0-9\s\-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// --- ИЗВЛЕЧЕНИЕ МОДЕЛИ ---
function extractModelFromName(name) {
  let clean = name.replace(/СХЕМА\s*/gi, '').trim();
  const sortedModels = [...MODEL_NAMES].sort((a, b) => b.length - a.length);

  for (const model of sortedModels) {
    const index = clean.indexOf(model);
    if (index === -1) continue;

    const before = index > 0 ? clean[index - 1] : '';
    const after = index + model.length < clean.length ? clean[index + model.length] : '';
    const validBefore = !/[а-яёa-z0-9]/i.test(before) || index === 0;
    const validAfter = !/[а-яёa-z0-9]/i.test(after) || index + model.length === clean.length;

    if (validBefore && validAfter) {
      // Применяем специальное отображение для комбинированных моделей (правило 03)
      return SPECIAL_MODELS_MAP[model] || model;
    }
  }
  return "";
}

function extractPogonazhSize(name) {
  const match = name.match(/\b(\d{1,3})\s*[хx]\s*(\d{1,3})\s*[хx]\s*(\d{4})\b/i);
  if (match) {
    return {
      full: `${match[1]}х${match[2]}х${match[3]}`,
      width: parseInt(match[2], 10)
    };
  }
  return { full: "", width: 0 };
}

function extractDoorSize(name) {
  const match = name.match(/\b(400|450|600|700|800|900)\b/);
  return match ? parseInt(match[1], 10) : 0;
}

function detectStockProgram(name) {
  if (/\b[46-9]00\b/.test(name)) return 1;
  if (/\b\d{1,3}\s*[хx]\s*\d{1,3}\s*[хx]\s*\d{4}\b/.test(name)) return 1;
  return 0;
}

// --- ИЗВЛЕЧЕНИЕ ЦВЕТА (с правилом 01) ---
function extractColorFromName(name) {
  const lower = name.toLowerCase();
  const norm = normalize(name);

  // Правило 01: Бетон светлый/темный
  if (norm.includes("бетон")) {
    if (norm.includes("светлый")) return "Бетон светлый";
    if (norm.includes("темный")) return "Бетон темный";
  }

  // Поиск по покрытиям
  for (const [coating, colorList] of Object.entries(COATING_COLOR_MAP)) {
    if (lower.includes(coating)) {
      for (const color of colorList) {
        if (lower.includes(color)) {
          return toTitleCase(`${coating} ${color}`);
        }
      }
    }
  }

  // Специальные случаи для эмали
  if (/эмаль|vinyl|винил|ламинатин/i.test(lower)) {
    if (lower.includes("бел")) return "Эмаль белая";
    if (lower.includes("сер")) return "Эмаль серая";
    if (lower.includes("латт") || lower.includes("лате")) return "Эмаль латте";
    if (lower.includes("слоновая кость")) return "Эмаль слоновая кость";
  }

  // Сортируем цвета по длине для точного совпадения
  const sortedColors = [...BASE_COLORS].sort((a, b) => b.length - a.length);
  for (const color of sortedColors) {
    const colorLower = color.toLowerCase();
    if (norm.includes(colorLower)) {
      return toTitleCase(color);
    }
  }

  // Простые цвета
  const simpleColors = ["белый", "серый", "латте", "латтэ", "слоновая кость"];
  for (const c of simpleColors) {
    if (lower.includes(c) && !/\b(эмаль|vinyl|винил|ламинатин)\b/.test(lower)) {
      return toTitleCase(c);
    }
  }

  return "";
}

function extractKromka(name) {
  const lower = name.toLowerCase();
  if (lower.includes("кромка")) {
    if (lower.includes("черн")) return "кромка черная";
    if (lower.includes("бел")) return "кромка белая";
    return "кромка";
  }
  return "";
}

function extractGlassFromName(name, isPO) {
  const lower = name.toLowerCase();

  // Стекло ... → оставляем как есть
  const glassMatch = lower.match(/стекло\s+([а-яёa-z0-9\s]+)/i);
  if (glassMatch) {
    const rawPhrase = glassMatch[1].trim();
    return toTitleCase(`стекло ${rawPhrase}`);
  }

  // Зеркало ...
  const mirrorMatch = lower.match(/(зеркало\s+[а-яёa-z0-9]+)/i);
  if (mirrorMatch) {
    return toTitleCase(mirrorMatch[1].trim());
  }
  if (lower.includes("зеркало")) {
    return "Зеркало";
  }

  // Другие типы стекла
  const norm = normalize(name);
  const knownTypes = ["мателюкс", "бронза", "черное", "графитовое", "гранд", "галерея", "ромб", "рубин", "оникс"];
  for (const type of knownTypes) {
    if (norm.includes(type)) {
      const re = new RegExp(`\\b${type}\\b`);
      if (re.test(norm)) {
        return toTitleCase(type);
      }
    }
  }

  return isPO ? "" : "Глухое";
}

// Новое: извлечение молдинга (правило 04)
function extractMolding(name) {
  const lower = name.toLowerCase();
  if (!lower.includes("молдинг")) return "";

  if (lower.includes("серебро")) return "молдинг серебро";
  if (lower.includes("золото")) return "молдинг золото";
  
  return "молдинг";
}

function extractLatch(name) {
  const lower = name.toLowerCase();
  const parts = [];

  if (lower.includes("защелка") || lower.includes("защёлка") || lower.includes("мех.")) {
    if (lower.includes("маг") || lower.includes("магнит")) {
      parts.push("защелка магнит");
    } else if (lower.includes("пласт") || lower.includes("мех.") || lower.includes("мех ")) {
      parts.push("защёлка пластик");
    } else {
      parts.push("защелка");
    }
  }

  if (lower.includes("замок")) {
    if (lower.includes("маг") || lower.includes("магнит")) {
      parts.push("замок магнитный");
    }
  }

  return parts;
}

// --- ОБРАБОТЧИКИ ---
function processDoor(name) {
  const isPG = /пг/i.test(name);
  const isPO = /по/i.test(name);
  const modelName = extractModelFromName(name);
  const color = extractColorFromName(name);
  const kromka = extractKromka(name);
  const glass = extractGlassFromName(name, isPO);
  const molding = extractMolding(name); // Правило 04
  const latchParts = extractLatch(name);

  const parts = [];
  if (modelName) parts.push(modelName);
  if (color) parts.push(color.toLowerCase());
  if (molding) parts.push(molding); // Добавляем молдинг после цвета
  if (kromka) parts.push(kromka);
  if (glass) parts.push(glass.toLowerCase());
  latchParts.forEach(p => parts.push(p));

  const finalName = parts.map(p =>
    p === p.toUpperCase() ? p : toTitleCase(p)
  ).join(' ');

  return {
    name: finalName,
    color: color,
    glass: glass ? toTitleCase(glass.toLowerCase()) : "",
    size: extractDoorSize(name)
  };
}

function processPogonazh(name) {
  const lower = name.toLowerCase();
  const sizeInfo = extractPogonazhSize(name);
  const color = extractColorFromName(name);
  const isTelescopic = /телескоп/i.test(lower);
  const hasUplotnitel = lower.includes("с уплотнителем");
  
  let baseName = "";
  let type = "";

  // Определяем тип погонажа
  if (/деталь короба/i.test(lower)) {
    type = "деталь короба";
    const widthMatch = name.match(/деталь короба\s*(?:\d+\s*)?(\d+)/i);
    const width = widthMatch ? widthMatch[1] : "80";
    baseName = `Деталь короба (${width})`;
  } 
  else if (/наличник/i.test(lower)) {
    type = "наличник";
    baseName = "Наличник";
  } 
  else if (/доборный элемент/i.test(lower)) {
    type = "доборный элемент";
    const numMatch = name.match(/доборный элемент\s*(\d+)/i);
    const num = numMatch ? numMatch[1] : "";
    baseName = num ? `Доборный элемент ${num}` : "Доборный элемент";
  }
  else if (/планка прямая/i.test(lower)) {
    type = "планка";
    baseName = "Планка прямая";
  }
  else if (/притворная планка/i.test(lower)) { // Правило 05
    return {
      name: "Притворная планка",
      color: "",
      glass: "",
      size: sizeInfo.full
    };
  }

  // Добавляем модификаторы в зависимости от типа и телескопичности
  if (type && !/притворная планка/i.test(lower)) {
    if (isTelescopic) {
      baseName += " (Т)";
    } else if (["деталь короба", "наличник", "доборный элемент"].includes(type)) {
      baseName += " простой"; // Правило 02
    }
  }

  const parts = [baseName];
  if (color) parts.push(color.toLowerCase());
  if (kromka) parts.push(kromka);
  if (hasUplotnitel) parts.push("с уплотнителем");

  return {
    name: parts.join(' '),
    color: color,
    glass: "",
    size: sizeInfo.full
  };
}

// --- ОПРЕДЕЛЕНИЕ КАТЕГОРИИ (с исправлениями) ---
function detectCategory(name) {
  const lower = name.toLowerCase();
  
  // Правило 05: Притворная планка -> Декор
  if (/притворная планка/i.test(lower)) {
    return "Декор";
  }
  
  // Сначала проверяем погонаж (чтобы избежать ложных срабатываний на "по" в "шпон")
  if (/наличник|доборный элемент|деталь короба|планка/i.test(lower)) {
    if (/телескоп/i.test(lower)) {
      return "Погонаж телескопический";
    }
    if (/прям|плоск/i.test(lower)) {
      return "Погонаж простой";
    }
    // Правило 02: если нет телескопа -> простой
    return "Погонаж простой";
  }
  
  // Двери только при явном указании ПГ/ПО как отдельных слов
  if (/\b(пг|по)\b/i.test(lower)) {
    return "Межкомнатные двери";
  }
  
  return "НЕИЗВЕСТНО";
}

// --- ОСНОВНОЙ КОД ---
const inputPath = path.join(__dirname, 'mapping.json');
const outputPath = path.join(__dirname, 'mapping_transformed.json');

const rawData = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(rawData);

const result = {};

for (const [key, item] of Object.entries(data)) {
  const originalName = item.name;
  const category = detectCategory(originalName);
  const isPogonazh = category.includes("Погонаж");
  const isDoor = category === "Межкомнатные двери";
  const isDecor = category === "Декор";

  let processed;
  if (isDoor) {
    processed = processDoor(originalName);
  } else if (isPogonazh) {
    processed = processPogonazh(originalName);
  } else if (isDecor) {
    // Специальная обработка для декора
    processed = {
      name: "Притворная планка",
      color: "",
      glass: "",
      size: 0
    };
  } else {
    processed = {
      name: originalName,
      color: "",
      glass: "",
      size: 0
    };
  }

  const ignore = category === "НЕИЗВЕСТНО" ? 1 : 0;
  const stockProgram = detectStockProgram(originalName);

  result[key] = {
    ...item,
    name: processed.name,
    category: category,
    color: processed.color,
    glass: processed.glass,
    size: processed.size,
    ignore: ignore,
    stockProgram: stockProgram
  };
}

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`✅ Файл успешно преобразован: ${outputPath}`);