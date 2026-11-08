// Даты в местном времени телефона. Формат дня: 'ГГГГ-ММ-ДД', месяца: 'ГГГГ-ММ'.

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
  'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_1 = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль',
  'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const pad = (n) => String(n).padStart(2, '0');

export function isoDay(d = new Date()) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function parseDay(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export function addDays(iso, n) {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

// Сколько дней от a до b (b позже: число больше нуля)
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

export function monthKey(iso) {
  return String(iso).slice(0, 7);
}

export function monthStart(key) {
  return key + '-01';
}

export function monthEnd(key) {
  const [y, m] = key.split('-').map(Number);
  return isoDay(new Date(y, m, 0, 12));
}

// 'ноября' для «План ноября»
export function monthGen(key) {
  return MONTHS[Number(key.slice(5, 7)) - 1];
}

// 'ноябрь 2026'
export function monthTitle(key) {
  return MONTHS_1[Number(key.slice(5, 7)) - 1] + ' ' + key.slice(0, 4);
}

// 'Воскресенье, 8 ноября'
export function dayTitle(iso) {
  const d = parseDay(iso);
  return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
}

// 'Сегодня', 'Вчера', 'Завтра' или '8 ноября' (год, если не текущий)
export function dayShort(iso, today) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Сегодня';
  if (diff === -1) return 'Вчера';
  if (diff === 1) return 'Завтра';
  const d = parseDay(iso);
  const year = iso.slice(0, 4) !== today.slice(0, 4) ? ' ' + iso.slice(0, 4) : '';
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + year;
}

export function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function daysWord(n) {
  return n + ' ' + plural(n, ['день', 'дня', 'дней']);
}

// Быстрые даты для следующего действия
export const QUICK_DATES = [
  { id: 'today', label: 'Сегодня', days: 0 },
  { id: 'tomorrow', label: 'Завтра', days: 1 },
  { id: 'week', label: 'Через неделю', days: 7 },
  { id: '2weeks', label: 'Через 2 недели', days: 14 },
  { id: 'month', label: 'Через месяц', days: 30 },
];
