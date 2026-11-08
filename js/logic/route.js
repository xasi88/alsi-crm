// Маршрут объезда точек: самый короткий порядок по прямой и ссылки в Яндекс Карты частями.
// Без облака и без сети: считает телефон. По дорогам ведут Яндекс Карты.
import { hasPoint } from './maps.js?v=2f681d03';

const f6 = (n) => Number(n).toFixed(6);
const rad = (x) => (x * Math.PI) / 180;

// Расстояние по прямой, км
export function km(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pathKm(stops, start = null) {
  const all = start ? [start, ...stops] : stops;
  let sum = 0;
  for (let i = 1; i < all.length; i++) sum += km(all[i - 1], all[i]);
  return sum;
}

// Ближайший сосед: каждый раз едем к ближайшей из оставшихся. firstD(j): путь до первой точки
function greedy(n, d, firstD) {
  const used = new Array(n).fill(false);
  const order = [];
  let cur = -1;
  for (let step = 0; step < n; step++) {
    let best = -1;
    let bd = Infinity;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const x = cur < 0 ? firstD(j) : d(cur, j);
      if (x < bd) { bd = x; best = j; }
    }
    used[best] = true;
    order.push(best);
    cur = best;
  }
  return order;
}

// 2-opt для открытого пути: разворачивает участок, если путь становится короче. startD(j): путь от старта до точки j
function twoOpt(order, d, startD) {
  const n = order.length;
  const edge = (i, j) => d(order[i], order[j]);
  const before = (i) => (i === 0 ? (startD ? startD(order[0]) : 0) : edge(i - 1, i));
  const beforeSwap = (i, k) => (i === 0 ? (startD ? startD(order[k]) : 0) : edge(i - 1, k));
  let better = true;
  let rounds = 0;
  while (better && rounds++ < 60) {
    better = false;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const after = k === n - 1 ? 0 : edge(k, k + 1);
        const afterSwap = k === n - 1 ? 0 : edge(i, k + 1);
        if (beforeSwap(i, k) + afterSwap < before(i) + after - 1e-9) {
          for (let a = i, b = k; a < b; a++, b--) [order[a], order[b]] = [order[b], order[a]];
          better = true;
        }
      }
    }
  }
  return order;
}

// Порядок объезда. start: { lat, lng } (место телефона) или null
export function planRoute(shops, start = null) {
  const pts = shops.filter(hasPoint);
  const n = pts.length;
  if (n < 2) return { stops: pts, km: n && start ? km(start, pts[0]) : 0 };
  const m = pts.map((a) => pts.map((b) => km(a, b)));
  const d = (i, j) => m[i][j];
  let order;
  if (start) {
    const sd = pts.map((p) => km(start, p));
    order = twoOpt(greedy(n, d, (j) => sd[j]), d, (j) => sd[j]);
  } else {
    // Начало не задано: пробуем начать с каждой точки, берём самый короткий путь
    let bestLen = Infinity;
    for (let s = 0; s < n; s++) {
      const o = greedy(n, d, (j) => d(s, j));
      let len = 0;
      for (let i = 1; i < n; i++) len += d(o[i - 1], o[i]);
      if (len < bestLen) { bestLen = len; order = o; }
    }
    order = twoOpt(order, d, null);
  }
  const stops = order.map((i) => pts[i]);
  return { stops, km: pathKm(stops, start) };
}

// Части маршрута для Яндекс Карт: в каждой до size точек. Первая часть от места телефона,
// следующая начинается с последней точки прошлой части
export function routeParts(stops, size = 10) {
  const parts = [];
  for (let i = 0; i < stops.length; i += size) {
    const pts = stops.slice(i, i + size);
    const from = i === 0 ? null : stops[i - 1];
    parts.push({ first: i + 1, last: i + pts.length, from, stops: pts, link: yandexLink(pts, from) });
  }
  return parts;
}

// Ссылка маршрута на машине. from: null значит «от места телефона»
export function yandexLink(stops, from = null) {
  const pts = stops.filter(hasPoint);
  if (!pts.length) return '';
  return 'https://yandex.ru/maps/?rtext=' + (from ? f6(from.lat) + ',' + f6(from.lng) : '') + '~' + pts.map((s) => f6(s.lat) + ',' + f6(s.lng)).join('~') + '&rtt=auto';
}
