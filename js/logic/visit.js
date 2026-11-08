// Визит: «Заказ есть?», отказ с вопросами к ЛПР, следующее действие.
// Варианты ответов те же, что в программе Атама: его ответы переносятся без потерь.
// Добавлены два варианта для ALSI: «Берут у другого поставщика» и «Холодильник или витрина».
import { PAYMENTS } from './money.js?v=e63f9436';
import { itemPacks, itemUnits } from './products.js?v=e63f9436';

export const NEXT = [
  { id: 'whatsapp', label: 'Написать в WhatsApp', short: 'WhatsApp' },
  { id: 'call', label: 'Позвонить', short: 'Позвонить' },
  { id: 'visit', label: 'Приехать', short: 'Визит' },
  { id: 'none', label: 'Ничего не нужно', short: '' },
];
export const nextById = (id) => NEXT.find((n) => n.id === id);

export const OTHER = 'Другое';

// ЛПР: тот, кто решает о закупке (хозяин или управляющий)
export const REFUSAL = [
  { id: 'reason', title: 'Главная причина отказа', multi: false, options: [
    'Высокая цена', 'Не уверен в спросе', 'Бренд пока мало известен', 'Нет бюджета на закупку сейчас',
    'Нет места под новый товар', 'Неинтересна категория', 'Хочет сначала посмотреть, как товар пойдёт у других',
    'Берут у другого поставщика', OTHER] },
  { id: 'change', title: 'Что может изменить решение', multi: true, options: [
    'Более выгодная цена', 'Акция или специальные условия на первый заказ', 'Больше рекламы и узнаваемости',
    'Доказанный спрос у покупателей', 'Отзывы и результаты других магазинов', 'Более широкий ассортимент',
    'Холодильник или витрина', 'Повторно предложить позже', 'Ничего, пока товар неинтересен'] },
  { id: 'product', title: 'Оценка товара', multi: false, options: [
    'Понравился', 'Скорее понравился', 'Нейтрально', 'Скорее не понравился', 'Не понравился', 'Не смог оценить'] },
  { id: 'demand', title: 'Оценка спроса', multi: false, options: [
    'Спрос точно будет', 'Скорее будет', 'Не уверен', 'Скорее не будет', 'Спроса не будет', 'Не может оценить'] },
  { id: 'again', title: 'Есть ли смысл вернуться', multi: false, options: [
    'Да, в течение недели', 'Да, через 2 недели', 'Да, примерно через месяц', 'Да, позже',
    'Только если изменятся условия', 'Нет'] },
];

// Ответы программы Атама, которые пишутся иначе: длинное тире и косую черту в наших текстах не используем.
// Знаки тире задаём кодами, чтобы их не было в самом файле.
const LONG = String.fromCharCode(8212, 8211);
export function sameAnswer(s) {
  const t = String(s || '').trim();
  if (t.startsWith('Ничего') && /[-]/.test(t.replace(new RegExp('[' + LONG + ']', 'g'), '-'))) return 'Ничего, пока товар неинтересен';
  return t.replace(/\s*\/\s*/, ' или ').replace('Отзывы или результаты', 'Отзывы и результаты');
}

export const optionPairs = (q) => q.options.map((o) => [o, o]);

export const itemsCount = (items) => (items || []).reduce((n, i) => n + itemPacks(i) + itemUnits(i), 0);

// Ошибки визита до сохранения. Пустой список: можно сохранять.
export function visitErrors(v, shop) {
  const e = [];
  if (!v.shopId) e.push('Выберите точку');
  if (v.result !== 'order' && v.result !== 'none') e.push('Ответьте, есть ли заказ');
  if (v.result === 'order') {
    if (!itemsCount(v.items)) e.push('Добавьте в заказ хотя бы одну упаковку или штуку');
    if (!PAYMENTS.some((p) => p.id === v.payment)) e.push('Выберите оплату');
  }
  if (v.result === 'none') {
    if (v.lpr !== true && v.lpr !== false) e.push('Ответьте, был ли ЛПР на месте');
    if (v.lpr === true) {
      for (const q of REFUSAL) {
        const a = v.refusal?.[q.id];
        if (q.multi ? !(Array.isArray(a) && a.length) : !a) e.push('Ответьте: ' + q.title.toLowerCase());
      }
      if (v.refusal?.reason === OTHER && !String(v.refusal.other || '').trim()) e.push('Напишите причину отказа');
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
  return visits.filter((v) => !v.deleted && v.kind !== 'contact' && v.shopId === shopId && v.date === date
    && v.result === 'none' && !v.orderId);
}

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

// Текст результата визита для списков
export function resultText(v) {
  if (v.kind === 'contact') return 'Запланировано';
  if (v.result === 'order') return 'Заказ есть';
  if (v.lpr === false) return 'Без заказа, ЛПР не было';
  const r = v.refusal?.reason;
  return 'Без заказа' + (r ? ': ' + (r === OTHER && v.refusal.other ? v.refusal.other : r).toLowerCase() : '');
}
