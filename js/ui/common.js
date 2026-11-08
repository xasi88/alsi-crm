// Общие куски экранов: связь, шапка, взгляд руководителя, план, фильтры, следующее действие.
import { S, pendingCount, planOf, people, setScope, memberName, all } from '../store.js?v=79063987';
import { savePlan, addContact } from '../save.js?v=79063987';
import { h, icon, toast, sheet, choices, field, inp, fill, pickOne } from './kit.js?v=79063987';
import { isoDay, addDays, monthKey, monthGen, monthTitle, monthStart, dayShort, daysWord, QUICK_DATES } from '../logic/dates.js?v=79063987';
import { monthFact, planBar } from '../logic/day.js?v=79063987';
import { NEXT } from '../logic/visit.js?v=79063987';
import { rub, parseCount } from '../logic/format.js?v=79063987';
import { PERIODS, districtsOf, localitiesOf } from '../logic/filters.js?v=79063987';

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

// Взгляд руководителя: вся команда или один человек
export function scopeChip() {
  const list = people();
  if (!S.lead || list.length < 2) return null;
  return h('button', { class: 'scope', onclick: () => pickOne({
    title: 'Чьи данные', value: S.scope,
    items: [['', S.owner ? 'Вся команда' : 'Я и мои торговые'], ...list.map((m) => [m.id, m.name || m.id, m.id === S.email ? 'это вы' : m.id])],
    onPick: (v) => setScope(v),
  }) }, icon('team'), S.scope ? memberName(S.scope) : S.owner ? 'Вся команда' : 'Я и мои торговые', icon('down'));
}

export function head(title, sub, right = syncChip()) {
  return h('header', { class: 'top' }, h('div', { class: 'bar' },
    h('div', {}, h('h1', { class: 'title' }, title), sub ? h('div', { class: 'date' }, sub) : null), right),
  scopeChip());
}

// Кто в плане: один человек или вся видимая команда
const planPeople = () => (S.scope ? [S.scope] : S.lead ? people().map((m) => m.id) : [S.email]);

// Карточка плана месяца: упаковки напитков, возвраты вычитаются
export function planCard() {
  const month = monthKey(isoDay());
  const who = planPeople();
  const plan = who.reduce((n, e) => n + planOf(month, e), 0);
  const bar = planBar(plan, monthFact(all('orders'), month, who, all('returns')));
  const team = who.length > 1 ? ' команды' : '';
  const kids = bar.plan
    ? [h('div', { class: 'row1' }, h('span', {}, 'План напитков' + team + ', ' + monthGen(month)),
      h('span', { class: 'num' }, String(bar.fact), ' ', h('em', {}, 'из ' + bar.plan + ' уп.'))),
    h('div', { class: 'track' }, h('i', { style: 'width:' + bar.pct + '%' })),
    h('small', { class: 'muted' }, bar.left ? 'Осталось ' + bar.left + ' уп., выполнено ' + bar.pct + '%' : 'План выполнен')]
    : [h('div', { class: 'row1' }, h('span', {}, 'План напитков' + team + ' не задан'),
      h('span', { class: 'num' }, String(bar.fact), ' ', h('em', {}, 'уп. продано')))];
  return h('a', { class: 'plan', href: '#/plan' }, kids);
}

// Экран плана: месяц назад и вперёд, цель каждому человеку
export function mountPlan(root) {
  let month = monthKey(isoDay());
  const update = () => {
    const list = S.lead ? people() : S.team.filter((m) => m.id === S.email);
    const inputs = new Map();
    const canSet = (m) => S.owner || m.id === S.email || (S.sup && m.lead === S.email);
    const total = list.reduce((n, m) => n + planOf(month, m.id), 0);
    const fact = monthFact(all('orders'), month, list.map((m) => m.id), all('returns'));
    fill(root,
      head('План', 'Упаковки напитков за месяц. Возвраты вычитаются, сладости и снеки не входят'),
      h('div', { class: 'month' },
        h('button', { class: 'ib white', 'aria-label': 'Прошлый месяц', onclick: () => { month = monthKey(addDays(monthStart(month), -1)); update(); } }, icon('back')),
        h('b', {}, monthTitle(month)),
        h('button', { class: 'ib white', 'aria-label': 'Следующий месяц', onclick: () => { month = monthKey(addDays(monthStart(month), 32)); update(); } }, icon('right'))),
      list.length > 1 ? h('div', { class: 'pad' }, h('div', { class: 'plan' }, h('div', { class: 'row1' }, h('span', {}, 'Команда'),
        h('span', { class: 'num' }, String(fact), ' ', h('em', {}, total ? 'из ' + total + ' уп.' : 'уп.'))),
      total ? h('div', { class: 'track' }, h('i', { style: 'width:' + planBar(total, fact).pct + '%' })) : null)) : null,
      h('div', { class: 'gap' }),
      h('div', { class: 'group' }, list.map((m) => {
        const f = monthFact(all('orders'), month, m.id, all('returns'));
        const goal = planOf(month, m.id);
        const i = canSet(m) ? inp({ type: 'text', inputmode: 'numeric', value: goal || '', placeholder: '0', 'aria-label': 'План ' + (m.name || m.id), style: 'max-width:110px;text-align:right' }) : null;
        if (i) inputs.set(m.id, i);
        return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', {}, m.name || m.id),
          h('small', {}, 'Продано ' + f + ' уп.' + (goal ? ', ' + planBar(goal, f).pct + '%' : ''))), i || h('span', { class: 'r num' }, goal ? goal + ' уп.' : 'не задан'));
      })),
      inputs.size ? h('div', { class: 'pad', style: 'margin-top:16px' }, h('button', { class: 'btn navy wide', onclick: () => {
        for (const [rep, i] of inputs) {
          const n = parseCount(i.value);
          if (Number.isNaN(n)) { toast('План: только целое число упаковок', true); i.focus(); return; }
          if (n !== planOf(month, rep)) savePlan(month, rep, n);
        }
        toast('План сохранён');
      } }, 'Сохранить план')) : null,
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}

// Полоса фильтров: период, свои даты, район, пункт, поиск. state хранит выбор (remember из kit.js).
export function filterBar(state, onChange, { periods = PERIODS, search = true, placeholder = 'Поиск по точке' } = {}) {
  const shops = all('shops');
  const changed = () => { state.save(); onChange(); };
  const box = h('div', { class: 'filters' });
  const draw = () => {
    const locs = localitiesOf(shops, state.district);
    fill(box,
      periods ? h('div', { class: 'chips' }, periods.map(([id, label]) => h('button', {
        class: 'choice' + (state.period === id ? ' on' : ''), 'aria-pressed': state.period === id ? 'true' : 'false',
        onclick: () => { state.period = id; draw(); changed(); },
      }, label))) : null,
      periods && state.period === 'custom' ? h('div', { class: 'dates' },
        field('С', inp({ type: 'date', value: state.from || '', onchange: (e) => { state.from = e.target.value; changed(); } })),
        field('По', inp({ type: 'date', value: state.to || '', onchange: (e) => { state.to = e.target.value; changed(); } }))) : null,
      h('div', { class: 'chips' },
        h('button', { class: 'choice' + (state.district ? ' on' : ''), onclick: () => pickOne({
          title: 'Район', value: state.district || '', search: true,
          items: [['', 'Все районы'], ...districtsOf(shops).map((d) => [d, d])],
          onPick: (v) => { state.district = v; if (v && state.locality && !localitiesOf(shops, v).includes(state.locality)) state.locality = ''; draw(); changed(); },
        }) }, state.district || 'Все районы', icon('down')),
        h('button', { class: 'choice' + (state.locality ? ' on' : ''), onclick: () => pickOne({
          title: 'Населённый пункт', sub: state.district || '', value: state.locality || '', search: true,
          items: [['', 'Все пункты'], ...locs.map((d) => [d, d])],
          onPick: (v) => { state.locality = v; draw(); changed(); },
        }) }, state.locality || 'Все пункты', icon('down')),
        state.district || state.locality || state.q || (periods && state.period !== periods[2]?.[0])
          ? h('button', { class: 'choice', onclick: () => { state.district = ''; state.locality = ''; state.q = ''; if (periods) state.period = 'month'; draw(); changed(); } }, 'Сбросить') : null),
      search ? h('div', { class: 'search' }, icon('search'),
        inp({ type: 'search', placeholder, value: state.q || '', 'aria-label': placeholder, oninput: (e) => { state.q = e.target.value; changed(); } })) : null);
  };
  draw();
  return box;
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

export const ageText = (age) => (age > 0 ? 'Не оплачено ' + daysWord(age) : 'Долг с сегодняшнего дня');
export const owedTag = (owed) => (owed > 0 ? h('span', { class: 'tag red num' }, 'Долг ' + rub(owed)) : null);
export const sec = (title, right = null) => h('div', { class: 'sec' }, h('h2', {}, title), right);
export const whoText = (rep) => (S.lead && rep && rep !== S.email ? memberName(rep) : '');

// Шапка, которая обновляется без пересборки экрана: поиск и поля ввода не теряют набранное
export function liveHead(title, right = null) {
  const subEl = h('div', { class: 'date' });
  const syncBox = h('div');
  const scopeBox = h('div');
  const el = h('header', { class: 'top' }, h('div', { class: 'bar' },
    h('div', {}, h('h1', { class: 'title' }, title), subEl), right || syncBox), scopeBox);
  return {
    el,
    refresh(sub = '') {
      fill(subEl, sub);
      if (!right) fill(syncBox, syncChip());
      fill(scopeBox, scopeChip());
    },
  };
}
