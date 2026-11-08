// Визит: «Заказ есть?», отказ с вопросами к ЛПР, следующее действие.
import { round2 } from './format.js?v=282e3437';

export const NEXT = [
  { id: 'whatsapp', label: 'Написать в WhatsApp', short: 'WhatsApp' },
  { id: 'call', label: 'Позвонить', short: 'Позвонить' },
  { id: 'visit', label: 'Приехать', short: 'Визит' },
  { id: 'none', label: 'Ничего не нужно', short: '' },
];

export const nextById = (id) => NEXT.find((n) => n.id === id);

// Пять вопросов, когда заказа нет, а ЛПР на месте.
// ЛПР: лицо, которое решает о закупке (хозяин или управляющий).
export const REFUSAL = [
  {
    id: 'reason', title: 'Главная причина отказа', multi: false, options: [
      ['stock', 'Товар ещё есть'],
      ['price', 'Дорого'],
      ['brand', 'Не знают бренд'],
      ['space', 'Нет места или холодильника'],
      ['other_supplier', 'Берут у другого поставщика'],
      ['slow', 'Плохо продаётся'],
      ['other', 'Другое'],
    ],
  },
  {
    id: 'change', title: 'Что может изменить решение', multi: true, options: [
      ['promo', 'Скидка или акция'],
      ['fridge', 'Холодильник ALSI'],
      ['trial', 'Пробная партия'],
      ['tasting', 'Дегустация, реклама'],
      ['delay', 'Отсрочка оплаты'],
      ['taste', 'Другой вкус или объём'],
      ['nothing', 'Ничего'],
    ],
  },
  {
    id: 'product', title: 'Как оценили напитки', multi: false, options: [
      ['good', 'Нравятся'], ['ok', 'Нормально'], ['bad', 'Не нравятся'], ['none', 'Не пробовали'],
    ],
  },
  {
    id: 'demand', title: 'Какой спрос ждут', multi: false, options: [
      ['high', 'Высокий'], ['mid', 'Средний'], ['low', 'Низкий'], ['unknown', 'Не знают'],
    ],
  },
  {
    id: 'again', title: 'Есть ли смысл вернуться', multi: false, options: [
      ['soon', 'Да, скоро'], ['month', 'Через месяц'], ['no', 'Нет'],
    ],
  },
];

export function optionLabel(qid, value) {
  const q = REFUSAL.find((x) => x.id === qid);
  const o = q && q.options.find((x) => x[0] === value);
  return o ? o[1] : '';
}

// Позиции заказа: только упаковки больше нуля, цена на момент заказа
export function orderItems(counts, products) {
  const items = [];
  for (const p of products) {
    const packs = Number(counts[p.id]) || 0;
    if (packs <= 0) continue;
    items.push({
      productId: p.id, name: p.name, line: p.line || '', perPack: Number(p.perPack) || 0,
      packPrice: Number(p.packPrice) || 0, packs,
    });
  }
  return items;
}

export function orderTotal(items) {
  return round2(items.reduce((s, i) => s + i.packs * i.packPrice, 0));
}

export function orderPacks(items) {
  return (items || []).reduce((s, i) => s + (Number(i.packs) || 0), 0);
}

// Ошибки визита до сохранения. Пустой список: можно сохранять.
export function visitErrors(v, shop) {
  const e = [];
  if (!v.shopId) e.push('Выберите точку');
  if (v.result !== 'order' && v.result !== 'none') e.push('Ответьте, есть ли заказ');
  if (v.result === 'order') {
    if (!v.items || !v.items.some((i) => i.packs > 0)) e.push('Добавьте в заказ хотя бы одну упаковку');
    if (!['cash', 'debt', 'transfer'].includes(v.payment)) e.push('Выберите оплату');
  }
  if (v.result === 'none') {
    if (v.lpr !== true && v.lpr !== false) e.push('Ответьте, был ли ЛПР на месте');
    if (v.lpr === true) {
      for (const q of REFUSAL) {
        const a = v.refusal?.[q.id];
        if (q.multi ? !(Array.isArray(a) && a.length) : !a) e.push('Ответьте: ' + q.title.toLowerCase());
      }
    }
  }
  const t = v.next?.type;
  if (!nextById(t)) e.push('Выберите следующее действие');
  else if (t !== 'none' && !v.next.date) e.push('Выберите дату следующего действия');
  if (t === 'whatsapp' && !(shop && shop.phone)) e.push('Для WhatsApp у точки нужен телефон');
  return e;
}

// Поздний заказ: визиты той же точки за тот же день без заказа и без связи с заказом.
// Один: связать сам. Несколько: спросить торгового. Новый визит не создавать.
export function lateVisits(visits, shopId, date) {
  return visits.filter((v) => !v.deleted && v.shopId === shopId && v.date === date
    && v.result === 'none' && !v.orderId);
}

// Визит после позднего заказа: «Заказ есть», ответы об отказе убраны
export function linkLate(visit, orderId) {
  const out = { ...visit, result: 'order', orderId };
  delete out.lpr;
  delete out.refusal;
  return out;
}

// Действующее следующее действие точки: из её последнего визита, если не выполнено
export function activeNext(visits) {
  let last = null;
  for (const v of visits) {
    if (v.deleted) continue;
    if (!last || (v.at || '') > (last.at || '')) last = v;
  }
  if (!last || !last.next || last.next.type === 'none' || last.next.doneAt) return null;
  return { ...last.next, visitId: last.id };
}
