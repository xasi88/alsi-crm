// Визит и заказ по телефону: шаги за несколько касаний, одной рукой.
import { S, saveVisit, shopById } from '../store.js?v=36adbe7e';
import { h, icon, fill, sheet, toast, choices, field, inp } from './kit.js?v=36adbe7e';
import { nextPicker } from './common.js?v=36adbe7e';
import { isoDay, addDays } from '../logic/dates.js?v=36adbe7e';
import { rub, parseMoney, parseCount, shopMatches } from '../logic/format.js?v=36adbe7e';
import { balances, PAYMENTS } from '../logic/money.js?v=36adbe7e';
import { REFUSAL, orderItems, orderTotal, visitErrors, lateVisits } from '../logic/visit.js?v=36adbe7e';
import { editShop } from './shops.js?v=36adbe7e';

const LINES = ['Alsi Cola', 'Code Red', 'FIFA', 'Nerve'];
const draftKey = () => 'alsi-draft-' + S.email;
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) { return null; } };
const keepDraft = (x) => { try { localStorage.setItem(draftKey(), JSON.stringify(x)); } catch (e) { /* без черновика */ } };
const dropDraft = () => { try { localStorage.removeItem(draftKey()); } catch (e) { /* пусто */ } };

export const startVisit = (shopId) => flow('visit', shopId);
export const startOrder = (shopId) => flow('order', shopId);

function products() {
  return S.products.filter((p) => !p.deleted && p.active !== false)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name, 'ru'));
}

function flow(mode, shopId = '') {
  const today = isoDay();
  let d = {
    mode, shopId, result: mode === 'order' ? 'order' : '', counts: {}, payment: '', paidNow: '', lpr: null,
    refusal: {}, next: { type: 'visit', date: addDays(today, 7) }, note: '', lateVisitId: '',
  };
  let i = 0;
  let restoreStep = '';
  const old = loadDraft();
  if (old && old.d && old.d.mode === mode && Date.now() - old.savedAt < 3 * 3600e3 && (!shopId || old.d.shopId === shopId)
    && old.d.shopId && shopById(old.d.shopId)) {
    d = old.d;
    restoreStep = old.step || '';
    shopId = d.shopId;
    toast('Продолжаем незаконченный ' + (mode === 'order' ? 'заказ' : 'визит'));
  }
  const late = mode === 'order' && d.shopId ? lateVisits(S.visits, d.shopId, today) : [];
  if (mode === 'order' && late.length === 1) d.lateVisitId = late[0].id;
  let saving = false;
  const remember = () => keepDraft({ d, step: steps()[i], savedAt: Date.now() });
  const s = sheet({ title: mode === 'order' ? 'Заказ' : 'Визит', full: true });

  const steps = () => {
    const list = [];
    if (mode === 'visit') {
      if (!shopId) list.push('shop');
      list.push('ask');
      if (d.result === 'order') list.push('order', 'pay');
      if (d.result === 'none') list.push('lpr');
      if (d.result) list.push('next');
    } else {
      if (late.length > 1) list.push('late');
      list.push('order', 'pay');
    }
    return list;
  };
  if (restoreStep) i = Math.max(0, steps().indexOf(restoreStep));
  const go = (n) => { i = Math.max(0, Math.min(n, steps().length - 1)); remember(); draw(); s.body.scrollTop = 0; };
  const back = () => (i > 0 ? go(i - 1) : s.close());

  function draw() {
    const list = steps();
    const step = list[i];
    const shop = shopById(d.shopId);
    const title = { shop: 'Где вы?', ask: 'Заказ есть?', order: 'Что берут', pay: 'Оплата', lpr: 'Почему нет заказа', next: 'Что дальше', late: 'К какому визиту' }[step];
    fill(s.head, h('button', { class: 'ib white', 'aria-label': 'Назад', onclick: back }, icon('back')),
      h('h2', {}, title, h('span', { class: 'sub' }, shop ? shop.name : 'Выберите точку')));
    const bar = h('div', { class: 'steps', 'aria-hidden': 'true' }, list.map((_, k) => h('i', { class: k <= i ? 'on' : '' })));
    s.head.parentElement.querySelectorAll('.steps').forEach((x) => x.remove());
    s.head.after(bar);
    s.hideFoot();
    ({ shop: stepShop, ask: stepAsk, order: stepOrder, pay: stepPay, lpr: stepLpr, next: stepNext, late: stepLate })[step](shop);
  }

  function stepShop() {
    let q = '';
    const list = h('div');
    const drawList = () => {
      const mine = S.shops.filter((x) => !x.deleted && shopMatches(x, q))
        .sort((a, b) => (b.rep === S.email) - (a.rep === S.email) || a.name.localeCompare(b.name, 'ru')).slice(0, 40);
      fill(list, mine.length ? h('div', { class: 'group', style: 'margin:0' }, mine.map((x) => h('button', {
        class: 'item', onclick: () => { d.shopId = x.id; go(i + 1); },
      }, h('div', { class: 't' }, h('b', {}, x.name), h('small', {}, [x.address, x.locality].filter(Boolean).join(', '))), h('span', { class: 'chev' }, icon('right')))))
        : h('div', { class: 'empty', style: 'margin:0' }, q ? 'Такой точки нет' : 'Точек пока нет'));
    };
    fill(s.body,
      h('div', { class: 'search', style: 'margin:0 0 12px' }, icon('search'),
        inp({ type: 'search', placeholder: 'Название или адрес', oninput: (e) => { q = e.target.value; drawList(); } })),
      h('button', { class: 'btn line wide', style: 'margin-bottom:12px', onclick: () => editShop({ name: q }, (id) => { d.shopId = id; go(i + 1); }) }, 'Новая точка'),
      list);
    drawList();
  }

  function stepAsk() {
    const pick = (r) => () => {
      d.result = r;
      if (r === 'none') d.counts = {};
      go(i + 1);
    };
    fill(s.body, h('div', { class: 'yesno', style: 'margin-top:8px' },
      h('button', { class: 'yes' + (d.result === 'order' ? ' on' : ''), onclick: pick('order') }, 'Да'),
      h('button', { class: d.result === 'none' ? 'on' : '', onclick: pick('none') }, 'Нет')));
  }

  function stepOrder() {
    const ps = products();
    if (!ps.length) {
      fill(s.body, h('div', { class: 'empty', style: 'margin:0' }, h('b', {}, 'Каталог пуст'), 'Владелец добавляет напитки: Ещё, Каталог.'));
      return;
    }
    const sumEl = h('div', { class: 'sum num' });
    const nextBtn = h('button', { class: 'btn navy wide', onclick: () => go(i + 1) }, 'Дальше');
    const total = () => {
      const items = orderItems(d.counts, ps);
      const packs = items.reduce((n, x) => n + x.packs, 0);
      fill(sumEl, h('span', {}, packs + ' уп.'), h('span', {}, rub(orderTotal(items))));
      nextBtn.disabled = packs === 0;
      remember();
    };
    const row = (p) => {
      const cnt = h('button', { class: 'cnt num', 'aria-label': 'Ввести число упаковок' });
      const el = h('div', { class: 'prod' });
      const set = (n) => {
        d.counts[p.id] = Math.max(0, n);
        cnt.textContent = String(d.counts[p.id] || 0);
        el.classList.toggle('on', d.counts[p.id] > 0);
        cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop');
        total();
      };
      cnt.onclick = () => askCount(p, d.counts[p.id] || 0, set);
      fill(el,
        h('button', { class: 'add', onclick: () => set((d.counts[p.id] || 0) + 1), 'aria-label': 'Добавить упаковку ' + p.name },
          h('b', {}, p.name),
          h('small', { class: 'num' }, [p.volumeMl ? p.volumeMl + ' мл' : '', p.perPack ? p.perPack + ' шт. в уп.' : '', p.packPrice ? rub(p.packPrice) : 'цена не задана'].filter(Boolean).join(', '))),
        h('button', { class: 'minus', 'aria-label': 'Убрать упаковку', onclick: () => set((d.counts[p.id] || 0) - 1) }, icon('minus')),
        cnt);
      cnt.textContent = String(d.counts[p.id] || 0);
      el.classList.toggle('on', (d.counts[p.id] || 0) > 0);
      return el;
    };
    const groups = new Map();
    for (const p of ps) {
      const line = LINES.includes(p.line) ? p.line : 'Другое';
      if (!groups.has(line)) groups.set(line, []);
      groups.get(line).push(p);
    }
    fill(s.body, h('p', { class: 'hint', style: 'margin:0 0 4px' }, 'Касание названия добавляет упаковку. Число можно ввести.'),
      [...groups].map(([line, list]) => [h('div', { class: 'line-h' }, line), h('div', { class: 'prods' }, list.map(row))]));
    s.showFoot(sumEl, nextBtn);
    total();
  }

  function stepPay(shop) {
    const items = orderItems(d.counts, products());
    const total = orderTotal(items);
    const owed = balances(S.orders, S.payments, today).get(d.shopId)?.owed || 0;
    const paid = h('div');
    const drawPaid = () => fill(paid, d.payment === 'debt'
      ? field('Оплатили сейчас', inp({ inputmode: 'decimal', placeholder: '0', value: d.paidNow, oninput: (e) => { d.paidNow = e.target.value; } }), 'если часть суммы отдали сразу')
      : null);
    const lateNote = d.lateVisitId ? h('div', { class: 'warnbox' }, 'Заказ привяжется к визиту сегодня без заказа. Новый визит не создаётся.') : null;
    fill(s.body,
      h('div', { class: 'group', style: 'margin:0 0 16px' },
        h('div', { class: 'kv' }, h('span', {}, 'Сумма заказа'), h('b', { class: 'num' }, rub(total))),
        h('div', { class: 'kv' }, h('span', {}, 'Упаковок'), h('b', { class: 'num' }, String(items.reduce((n, x) => n + x.packs, 0)))),
        owed > 0 ? h('div', { class: 'kv' }, h('span', {}, 'Старый долг точки'), h('b', { class: 'num red' }, rub(owed))) : null),
      lateNote,
      h('div', { class: 'q' }, 'Как платят'),
      choices(PAYMENTS.map((p) => [p.id, p.label]), d.payment, (v) => { d.payment = v; drawPaid(); }, { col: true }),
      h('div', { style: 'margin-top:16px' }, paid));
    drawPaid();
    if (mode === 'order') s.showFoot(h('button', { class: 'btn red wide', onclick: save }, 'Сохранить заказ'));
    else s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
      if (!d.payment) { toast('Выберите оплату', true); return; }
      if (!checkPaid(total)) return;
      go(i + 1);
    } }, 'Дальше'));
  }

  function checkPaid(total) {
    if (d.payment !== 'debt' || !String(d.paidNow).trim()) return true;
    const v = parseMoney(d.paidNow);
    if (Number.isNaN(v)) { toast('Сумма: только цифры', true); return false; }
    if (v > total) { toast('Оплата больше суммы заказа', true); return false; }
    return true;
  }

  function stepLpr() {
    const qs = h('div');
    const drawQs = () => fill(qs, d.lpr === true ? REFUSAL.map((q) => [
      h('div', { class: 'q' }, q.title, q.multi ? h('span', { class: 'muted', style: 'font-weight:500;font-size:14px' }, ', можно несколько') : null),
      choices(q.options, d.refusal[q.id], (v) => { d.refusal[q.id] = v; remember(); }, { multi: q.multi })]) : null);
    fill(s.body,
      h('div', { class: 'q' }, 'ЛПР на месте?'),
      h('p', { class: 'hint' }, 'ЛПР: тот, кто решает о закупке. Хозяин или управляющий.'),
      h('div', { class: 'yesno' },
        h('button', { class: d.lpr === true ? 'on' : '', onclick: () => { d.lpr = true; draw(); } }, 'Да'),
        h('button', { class: d.lpr === false ? 'on' : '', onclick: () => { d.lpr = false; d.refusal = {}; draw(); } }, 'Нет')),
      qs);
    drawQs();
    if (d.lpr !== null) s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
      const errs = visitErrors({ ...d, next: { type: 'none' } }, shopById(d.shopId));
      if (errs.length) { toast(errs[0], true); return; }
      go(i + 1);
    } }, 'Дальше'));
  }

  function stepNext(shop) {
    fill(s.body, nextPicker(d.next, () => remember(), shop),
      h('div', { style: 'margin-top:20px' }, field('Заметка', h('textarea', { class: 'inp', placeholder: 'Например: просили Code Red Mojito', oninput: (e) => { d.note = e.target.value; } }, d.note))));
    s.showFoot(h('button', { class: 'btn red wide', onclick: save }, 'Сохранить визит'));
  }

  function stepLate() {
    fill(s.body, h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'Сегодня здесь было несколько визитов без заказа. Выберите, к какому относится заказ.'),
      choices(late.map((v) => [v.id, 'Визит в ' + (v.at || '').slice(11, 16)]), d.lateVisitId, (v) => { d.lateVisitId = v; go(i + 1); }, { col: true }));
  }

  function save() {
    if (saving) return;
    const shop = shopById(d.shopId);
    const items = d.result === 'order' ? orderItems(d.counts, products()) : [];
    const total = orderTotal(items);
    const v = { ...d, items, next: mode === 'order' ? { type: 'none' } : d.next };
    const errs = visitErrors(v, shop).filter((e) => mode === 'visit' || !e.includes('ЛПР'));
    if (errs.length) { toast(errs[0], true); return; }
    if (!checkPaid(total)) return;
    saving = true;
    saveVisit({
      shopId: d.shopId, shopName: shop ? shop.name : '', result: d.result, items, total, payment: d.payment,
      paidNow: parseMoney(d.paidNow) || 0, lpr: d.lpr, refusal: d.refusal, next: mode === 'visit' ? d.next : null,
      note: d.note, lateVisitId: d.lateVisitId || '', withVisit: mode === 'visit' || !!d.lateVisitId,
    });
    dropDraft();
    toast((mode === 'order' ? 'Заказ' : 'Визит') + ' сохранён' + (S.online ? '' : ' на телефоне. Уйдёт в облако, когда будет связь'));
    s.close();
  }

  draw();
}

function askCount(p, value, set) {
  const s = sheet({ title: p.name, sub: 'Сколько упаковок' });
  const i = inp({ type: 'text', inputmode: 'numeric', value: value || '', placeholder: '0', style: 'font-size:28px;text-align:center' });
  const ok = () => {
    const n = parseCount(i.value);
    if (Number.isNaN(n)) { toast('Только целое число', true); return; }
    set(n);
    s.close();
  };
  i.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  s.body.append(i);
  s.showFoot(h('button', { class: 'btn navy wide', onclick: ok }, 'Готово'));
  setTimeout(() => i.focus(), 250);
}

