// Деньги, телефоны, поиск по тексту.

const NB = ' '; // неразрывный пробел: «12 400 ₽» не рвётся на две строки

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// 12400 -> '12 400 ₽', 72.875 -> '72,88 ₽'
export function rub(n) {
  const v = round2(n);
  const whole = Number.isInteger(v);
  const [i, f] = Math.abs(v).toFixed(whole ? 0 : 2).split('.');
  const s = i.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  return (v < 0 ? '-' : '') + s + (f ? ',' + f : '') + NB + '₽';
}

// '12 400', '12400,50', '1 749 ₽' -> число; пусто или мусор -> NaN
export function parseMoney(s) {
  const t = String(s ?? '').replace(/[\s ₽р.]+$/i, '').replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Number(t);
}

// Целое число упаковок: '6' -> 6; пусто -> 0; мусор -> NaN
export function parseCount(s) {
  const t = String(s ?? '').trim();
  if (t === '') return 0;
  if (!/^\d{1,5}$/.test(t)) return NaN;
  return Number(t);
}

// Телефон к виду +7XXXXXXXXXX. Не похоже на российский номер: ''.
export function normPhone(s) {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = d.slice(1);
  if (d.length !== 10 || d[0] !== '9' && d[0] !== '8' && d[0] !== '4' && d[0] !== '3') return '';
  return '+7' + d;
}

// '+79380009040' -> '+7 938 000-90-40'
export function prettyPhone(p) {
  const n = normPhone(p);
  if (!n) return String(p ?? '');
  const d = n.slice(2);
  return '+7' + NB + d.slice(0, 3) + NB + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
}

export function telLink(p) {
  const n = normPhone(p);
  return n ? 'tel:' + n : '';
}

export function waLink(p, text = '') {
  const n = normPhone(p);
  if (!n) return '';
  return 'https://wa.me/' + n.slice(1) + (text ? '?text=' + encodeURIComponent(text) : '');
}

// Текст для поиска: строчные, ё как е, без кавычек и лишних пробелов
export function norm(s) {
  return String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`]/g, '')
    .replace(/[^a-zа-я0-9]+/g, ' ').trim();
}

export function shopMatches(shop, q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = norm([shop.name, shop.address, shop.locality, shop.district, shop.contact].join(' '))
    + ' ' + String(shop.phone ?? '').replace(/\D/g, '');
  return words.every((w) => hay.includes(w));
}

// Похожие точки до создания новой: то же имя или одно внутри другого (от 4 букв)
export function similarShops(shops, draft) {
  const n = norm(draft.name);
  if (n.length < 2) return [];
  const phone = normPhone(draft.phone);
  return shops.filter((s) => {
    if (s.id === draft.id) return false;
    if (phone && normPhone(s.phone) === phone) return true;
    const m = norm(s.name);
    if (m === n) return true;
    const short = m.length < n.length ? m : n;
    const long = m.length < n.length ? n : m;
    return short.length >= 4 && long.includes(short)
      && (!draft.locality || !s.locality || norm(draft.locality) === norm(s.locality));
  });
}
