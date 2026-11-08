// Ссылки на Яндекс Карты. Своей карты в приложении нет: навигатор лучше.

const hasPoint = (s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lng);

// Маршрут от места, где стоит телефон, через все точки с координатами
export function routeLink(shops) {
  const pts = shops.filter(hasPoint).slice(0, 9);
  if (!pts.length) return '';
  return 'https://yandex.ru/maps/?rtext=~' + pts.map((s) => s.lat.toFixed(6) + ',' + s.lng.toFixed(6)).join('~')
    + '&rtt=auto';
}

// Одна точка: маршрут по координатам или поиск по адресу
export function placeLink(shop) {
  if (hasPoint(shop)) return routeLink([shop]);
  const text = [shop?.address, shop?.locality].filter(Boolean).join(', ') || shop?.name || '';
  return text ? 'https://yandex.ru/maps/?text=' + encodeURIComponent(text) : '';
}

export { hasPoint };
