// Общие куски экранов: связь, план, строки точек, следующее действие.
import { S, pendingCount, planOf, savePlan, addContact } from '../store.js?v=282e3437';
import { h, icon, toast, sheet, choices, field, inp, fill } from './kit.js?v=282e3437';
import { isoDay, addDays, monthKey, monthGen, dayShort, daysWord, QUICK_DATES } from '../logic/dates.js?v=282e3437';
import { monthFact, planBar } from '../logic/day.js?v=282e3437';
import { NEXT } from '../logic/visit.js?v=282e3437';
import { rub, parseCount } from '../logic/format.js?v=282e3437';

export function syncChip() {
  const n = pendingCount();
  if (n > 0) {
    return h('button', { class: 'sync wait', onclick: () => toast('Записи сохранены на телефоне. Уйдут в облако, когда будет связь') },
      icon('clock'), 'Ждёт отправки: ' + n);
  }
  if (!S.online) {
    return h('button', { class: 'sync off', onclick: () => toast('Нет связи. Работайте как обычно: записи сохранятся на телефоне') },
      icon('cloud'), 'Нет связи');
  }
  return h('button', { class: 'sync', onclick: () => toast('Все записи в облаке') }, icon('ok'), 'Отправлено');
}

export function head(title, sub, right = syncChip()) {
  return h('header', { class: 'top' }, h('div', { class: 'bar' },
    h('div', {}, h('h1', { class: 'title' }, title), sub ? h('div', { class: 'date' }, sub) : null), right));
}

// Карточка плана месяца. Владелец и супервайзер меняют план касанием.
export function planCard(rep = S.email) {
  const month = monthKey(isoDay());
  const bar = planBar(planOf(month, rep), monthFact(S.orders, month, rep));
  const kids = bar.plan
    ? [h('div', { class: 'row1' }, h('span', {}, 'План ' + monthGen(month)),
      h('span', { class: 'num' }, String(bar.fact), ' ', h('em', {}, 'из ' + bar.plan + ' уп.'))),
    h('div', { class: 'track' }, h('i', { style: 'width:' + bar.pct + '%' }))]
    : [h('div', { class: 'row1' }, h('span', {}, 'План ' + monthGen(month) + ' не задан'),
      h('span', { class: 'num' }, String(bar.fact), ' ', h('em', {}, 'уп. продано')))];
  return h(S.lead ? 'button' : 'div', { class: 'plan', onclick: S.lead ? () => openPlan() : null }, kids);
}

export function openPlan() {
  const month = monthKey(isoDay());
  const s = sheet({ title: 'План ' + monthGen(month), sub: 'Упаковки напитков за месяц' });
  const people = S.team.filter((m) => m.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  const inputs = new Map();
  fill(s.body, h('div', { class: 'group' }, people.map((m) => {
    const fact = monthFact(S.orders, month, m.id);
    const i = inp({ type: 'text', inputmode: 'numeric', value: planOf(month, m.id) || '', placeholder: '0', style: 'max-width:110px;text-align:right' });
    inputs.set(m.id, i);
    return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', {}, m.name || m.id), h('small', {}, 'Продано ' + fact + ' уп.')), i);
  })));
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    for (const [rep, i] of inputs) {
      const n = parseCount(i.value);
      if (Number.isNaN(n)) { toast('План: только целое число упаковок', true); i.focus(); return; }
      if (n !== planOf(month, rep)) savePlan(month, rep, n);
    }
    toast('План сохранён');
    s.close();
  } }, 'Сохранить план'));
}

// Выбор следующего действия: тип, быстрая дата или своя дата
export function nextPicker(next, onChange, shop) {
  const wrap = h('div');
  const today = isoDay();
  const draw = () => {
    const kinds = NEXT.filter((n) => n.id !== 'whatsapp' || (shop && shop.phone)).map((n) => [n.id, n.label]);
    const dateBox = h('div');
    if (next.type && next.type !== 'none') {
      const quick = QUICK_DATES.map((q) => [addDays(today, q.days), q.label]);
      const d = inp({ type: 'date', value: next.date || '', min: today, onchange: (e) => { next.date = e.target.value; onChange(next); draw(); } });
      dateBox.append(h('div', { class: 'q' }, 'Когда'),
        choices(quick, next.date, (v) => { next.date = v; onChange(next); draw(); }),
        h('div', { style: 'margin-top:12px' }, field('Другая дата', d)));
    }
    fill(wrap, choices(kinds, next.type, (v) => {
      next.type = v;
      if (v !== 'none' && !next.date) next.date = addDays(today, 7);
      onChange(next);
      draw();
    }, { col: true }), dateBox);
  };
  draw();
  return wrap;
}

// Запланировать действие без визита
export function planContact(shop) {
  const next = { type: 'call', date: addDays(isoDay(), 1) };
  const s = sheet({ title: 'Следующее действие', sub: shop.name });
  s.body.append(nextPicker(next, () => {}, shop));
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    if (next.type !== 'none' && !next.date) { toast('Выберите дату', true); return; }
    addContact(shop, next);
    toast('Записано');
    s.close();
  } }, 'Сохранить'));
}

export function nextText(n) {
  const kind = NEXT.find((x) => x.id === n.type);
  return (kind ? kind.label : '') + (n.date ? ', ' + dayShort(n.date, isoDay()).toLowerCase() : '');
}

// Возраст долга: 0 дней звучит странно
export const ageText = (age) => (age > 0 ? 'Не оплачено ' + daysWord(age) : 'Долг с сегодняшнего дня');

export const owedTag = (owed) => (owed > 0 ? h('span', { class: 'tag red num' }, 'Долг ' + rub(owed)) : null);
