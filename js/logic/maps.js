// Карты: маршрут в Яндекс Картах, 2ГИС и Google Maps; место из ссылки карты.
// Пустые координаты не равны (0, 0): такой точки нет.

export const hasPoint = (s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lng) && !(s.lat === 0 && s.lng === 0);
const f6 = (n) => Number(n).toFixed(6);
const addr = (s) => [s?.address, s?.locality].filter(Boolean).join(', ') || s?.name || '';

// Маршрут от телефона через точки с координатами (Яндекс: до 9 точек)
export function routeLink(shops) {
  const pts = shops.filter(hasPoint).slice(0, 9);
  if (!pts.length) return '';
  return 'https://yandex.ru/maps/?rtext=~' + pts.map((s) => f6(s.lat) + ',' + f6(s.lng)).join('~') + '&rtt=auto';
}

export function placeLink(shop) {
  if (hasPoint(shop)) return routeLink([shop]);
  const t = addr(shop);
  return t ? 'https://yandex.ru/maps/?text=' + encodeURIComponent(t) : '';
}

export function dgisLink(shop) {
  if (hasPoint(shop)) return 'https://2gis.ru/routeSearch/rsType/car/to/' + f6(shop.lng) + ',' + f6(shop.lat);
  const t = addr(shop);
  return t ? 'https://2gis.ru/search/' + encodeURIComponent(t) : '';
}

export function googleLink(shop) {
  if (hasPoint(shop)) return 'https://www.google.com/maps/dir/?api=1&destination=' + f6(shop.lat) + ',' + f6(shop.lng);
  const t = addr(shop);
  return t ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t) : '';
}

const okPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  && !(lat === 0 && lng === 0);
const pair = (s) => String(s || '').split(/\s*,\s*|\s+/).map(Number);
const round = (n) => Math.round(n * 1e6) / 1e6;
const SHORT = [/maps\.app\.goo\.gl/i, /goo\.gl\/maps/i, /go\.2gis\.com/i, /yandex\.[a-z]+\/maps\/-\//i];

// Место из ссылки или текста координат. Ответ: { lat, lng, src } или { error }.
export function parseMapLink(text) {
  const t = String(text || '').trim();
  if (!t) return { error: 'Вставьте ссылку из карты' };
  const urlMatch = t.match(/https?:\/\/\S+/i);
  const raw = urlMatch ? urlMatch[0] : t;
  let s = raw;
  try { s = decodeURIComponent(raw); } catch (e) { /* ссылка с ошибкой кодировки: читаем как есть */ }
  const done = (lat, lng, src) => (okPoint(lat, lng) ? { lat: round(lat), lng: round(lng), src, link: urlMatch ? raw : '' } : null);
  if (!urlMatch) {
    const [a, b] = pair(t.replace(/[^\d.,\s-]/g, ' ').trim());
    return done(a, b, 'Координаты') || { error: 'Не похоже на координаты. Пример: 43.3178, 45.6986' };
  }
  if (SHORT.some((r) => r.test(s))) {
    return { error: 'Это короткая ссылка. Откройте её, дождитесь карты и скопируйте адрес из строки браузера целиком' };
  }
  if (/google\.|goo\.gl/i.test(s)) {
    let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (m) return done(+m[1], +m[2], 'Google Maps') || { error: 'В ссылке нет места' };
    m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (m) return done(+m[1], +m[2], 'Google Maps') || { error: 'В ссылке нет места' };
    return { error: 'В ссылке Google нет координат. Поставьте метку на месте и поделитесь ею' };
  }
  if (/2gis\./i.test(s)) {
    // В 2ГИС сначала долгота, потом широта
    let m = s.match(/[?&]m=(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/\/geo\/(-?\d+\.\d+),(-?\d+\.\d+)/)
      || s.match(/\/(-?\d+\.\d+),(-?\d+\.\d+)(?:\/|$|\?)/);
    if (m) return done(+m[2], +m[1], '2ГИС') || { error: 'В ссылке нет места' };
    return { error: 'В ссылке 2ГИС нет координат. Нажмите на место на карте и поделитесь им' };
  }
  if (/yandex\.|ya\.ru/i.test(s)) {
    // В Яндексе ll и pt: долгота, широта
    const m = s.match(/whatshere\[point\]=(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&]pt=(-?\d+\.\d+),(-?\d+\.\d+)/)
      || s.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return done(+m[2], +m[1], 'Яндекс Карты') || { error: 'В ссылке нет места' };
    return { error: 'В ссылке Яндекса нет координат. Нажмите на место и поделитесь им' };
  }
  return { error: 'Нужна ссылка Яндекс Карт, 2ГИС или Google Maps' };
}

// Несколько замеров GPS: берём самый точный за отведённое время
export function bestFix(fixes) {
  return fixes.filter((f) => okPoint(f.lat, f.lng)).sort((a, b) => a.acc - b.acc)[0] || null;
}
