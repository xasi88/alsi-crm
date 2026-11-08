// Визит и заказ по телефону: шаги за несколько касаний, одной рукой. Каждый шаг пишется в черновик.
import { S, all, shopById } from '../store.js?v=e63f9436';
import { saveVisit } from '../save.js?v=e63f9436';
import { h, icon, fill, sheet, toast, choices, field, inp } from './kit.js?v=e63f9436';
import { nextPicker } from './common.js?v=e63f9436';
import { isoDay, addDays, dayShort } from '../logic/dates.js?v=e63f9436';
import { rub, parseMoney } from '../logic/format.js?v=e63f9436';
import { REFUSAL, OTHER, optionPairs, visitErrors, lateVisits } from '../logic/visit.js?v=e63f9436';
import { itemsPacks, itemsUnits, qtyText } from '../logic/products.js?v=e63f9436';
import { hasPoint } from '../logic/maps.js?v=e63f9436';
import { gpsFix, askMapLink } from './shops.js?v=e63f9436';
import { debtWarn, shopStep, payBlock, payError } from './steps.js?v=e63f9436';
import { productPicker, pickItems, pickTotal } from './orderpick.js?v=e63f9436';
import { keepDraft, dropDraft, draftFor, draftById } from './drafts.js?v=e63f9436';

export const startVisit = (shopId) => flow('visit', shopId);
export const startOrder = (shopId) => flow('order', shopId);
export function resumeDraft(id) {
  const x = draftById(id);
  if (x) flow(x.mode, x.d.shopId, x);
}

function flow(mode, shopId = '', draft = null) {
  const today = isoDay();
  let d = draft ? draft.d : null;
  if (!d && shopId) {
    const old = draftFor(mode, shopId);
    if (old) { d = old.d; draft = old; toast('Продолжаем незаконченный ' + (mode === 'order' ? 'заказ' : 'визит')); }
  }
  d = d || { shopId, date: today, result: mode === 'order' ? 'order' : '', pick: {}, payment: '', paidNow: '', lpr: null, refusal: {},
    next: { type: 'visit', date: addDays(today, 7) }, note: '', orderNote: '', lateVisitId: '', geo: null, shopPoint: '' };
  const draftId = draft?.id || 'd' + Date.now().toString(36);
  let late = [];
  const findLate = () => {
    late = mode === 'order' && d.shopId ? lateVisits(all('visits'), d.shopId, d.date).filter((v) => v.rep === S.email) : [];
    if (late.length === 1) d.lateVisitId = late[0].id;
    if (!late.length) d.lateVisitId = '';
  };
  findLate();
  let i = 0;
  let saving = false;
  let dirty = !!draft;
  const remember = () => {
    dirty = true;
    keepDraft({ id: draftId, mode, d, step: steps()[i], shopName: shopById(d.shopId)?.name || '' });
  };
  const s = sheet({ title: mode === 'order' ? 'Заказ' : 'Визит', full: true,
    onClose: () => { if (dirty && !saving) toast('Черновик сохранён: Ещё, Черновики'); } });

  const steps = () => {
    const list = [];
    if (!shopId && !draft) list.push('shop');
    if (mode === 'visit') {
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
  if (draft?.step) i = Math.max(0, steps().indexOf(draft.step));
  const go = (n) => { i = Math.max(0, Math.min(n, steps().length - 1)); if (d.shopId) remember(); draw(); s.body.scrollTop = 0; };
  const back = () => (i > 0 ? go(i - 1) : s.close());

  function draw() {
    const list = steps();
    const step = list[i];
    const shop = shopById(d.shopId);
    const title = { shop: 'Где вы?', ask: 'Заказ есть?', order: 'Что берут', pay: 'Оплата', lpr: 'Почему нет заказа', next: 'Что дальше', late: 'К какому визиту' }[step];
    fill(s.head, h('button', { class: 'ib white', 'aria-label': 'Назад', onclick: back }, icon('back')),
      h('h2', {}, title, h('span', { class: 'sub' }, shop ? shop.name + (d.date !== today ? ', ' + dayShort(d.date, today).toLowerCase() : '') : 'Выберите точку')));
    s.head.parentElement.querySelectorAll('.steps').forEach((x) => x.remove());
    s.head.after(h('div', { class: 'steps', 'aria-hidden': 'true' }, list.map((_, k) => h('i', { class: k <= i ? 'on' : '' }))));
    s.hideFoot();
    ({ shop: stepShop, ask: stepAsk, order: stepOrder, pay: stepPay, lpr: stepLpr, next: stepNext, late: stepLate })[step](shop);
  }

  function stepShop() {
    shopStep(s.body, (id) => { d.shopId = id; findLate(); go(i + 1); });
  }

  // Дата визита: сегодня или раньше (если забыли записать)
  function dateLine() {
    const di = inp({ type: 'date', value: d.date, max: today, 'aria-label': 'Дата', onchange: (e) => { d.date = e.target.value || today; findLate(); remember(); draw(); } });
    return h('details', { class: 'when' }, h('summary', {}, 'Дата: ' + dayShort(d.date, today)), field('Другая дата', di, 'не позже сегодня'));
  }

  function stepAsk() {
    const pick = (r) => () => {
      d.result = d.result === r ? '' : r; // повторное касание снимает выбор
      if (d.result !== 'order') d.pick = {};
      if (d.result) go(i + 1); else draw();
    };
    fill(s.body, debtWarn(d.shopId), h('div', { class: 'yesno', style: 'margin-top:8px' },
      h('button', { class: 'yes' + (d.result === 'order' ? ' on' : ''), onclick: pick('order') }, 'Да'),
      h('button', { class: d.result === 'none' ? 'on' : '', onclick: pick('none') }, 'Нет')),
    h('div', { style: 'margin-top:16px' }, dateLine()));
  }

  function stepOrder() {
    const sumEl = h('div', { class: 'sum num' });
    const nextBtn = h('button', { class: 'btn navy wide', onclick: () => go(i + 1) }, 'Дальше');
    const total = () => {
      const items = pickItems(d.pick);
      fill(sumEl, h('span', {}, qtyText(itemsPacks(items), itemsUnits(items))), h('span', {}, rub(pickTotal(d.pick))));
      nextBtn.disabled = !items.length;
      remember();
    };
    const box = h('div');
    fill(s.body, mode === 'order' ? debtWarn(d.shopId) : null, box);
    productPicker(box, d.pick, total);
    s.showFoot(sumEl, nextBtn);
    total();
  }

  function stepPay() {
    const items = pickItems(d.pick);
    const total = pickTotal(d.pick);
    fill(s.body,
      h('div', { class: 'group', style: 'margin:0 0 16px' },
        h('div', { class: 'kv' }, h('span', {}, 'Сумма заказа'), h('b', { class: 'num' }, rub(total))),
        h('div', { class: 'kv' }, h('span', {}, 'Количество'), h('b', { class: 'num' }, qtyText(itemsPacks(items), itemsUnits(items))))),
      debtWarn(d.shopId),
      d.lateVisitId ? h('div', { class: 'warnbox' }, 'Заказ привяжется к визиту без заказа за этот день. Новый визит не создаётся.') : null,
      h('div', { class: 'q' }, 'Как платят'),
      payBlock(d, total, () => remember()),
      h('div', { style: 'margin-top:16px' }, field('Комментарий к заказу', h('textarea', { class: 'inp', placeholder: 'Например: привезти до обеда', oninput: (e) => { d.orderNote = e.target.value; remember(); } }, d.orderNote || ''))),
      mode === 'order' ? dateLine() : null);
    const err = () => payError(d, total);
    if (mode === 'order') s.showFoot(h('button', { class: 'btn red wide', onclick: save }, 'Сохранить заказ'));
    else s.showFoot(h('button', { class: 'btn navy wide', onclick: () => { const e = err(); if (e) { toast(e, true); return; } go(i + 1); } }, 'Дальше'));
  }

  function stepLpr() {
    const qs = h('div');
    const drawQs = () => fill(qs, d.lpr === true ? REFUSAL.map((q) => [
      h('div', { class: 'q' }, q.title, q.multi ? h('span', { class: 'muted', style: 'font-weight:500;font-size:14px' }, ', можно несколько') : null),
      choices(optionPairs(q), d.refusal[q.id], (v) => { d.refusal[q.id] = v; remember(); if (q.id === 'reason') drawQs(); }, { multi: q.multi, col: !q.multi }),
      q.id === 'reason' && d.refusal.reason === OTHER ? h('div', { style: 'margin-top:12px' }, field('Какая причина', inp({ value: d.refusal.other || '', oninput: (e) => { d.refusal.other = e.target.value; remember(); } }))) : null]) : null);
    fill(s.body,
      h('div', { class: 'q' }, 'ЛПР на месте?'),
      h('p', { class: 'hint' }, 'ЛПР: тот, кто решает о закупке. Хозяин или управляющий.'),
      h('div', { class: 'yesno' },
        h('button', { class: d.lpr === true ? 'on' : '', onclick: () => { d.lpr = true; remember(); draw(); } }, 'Да'),
        h('button', { class: d.lpr === false ? 'on' : '', onclick: () => { d.lpr = false; d.refusal = {}; remember(); draw(); } }, 'Нет')),
      qs);
    drawQs();
    if (d.lpr !== null) s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
      const errs = visitErrors({ ...d, next: { type: 'none' } }, shopById(d.shopId));
      if (errs.length) { toast(errs[0], true); return; }
      go(i + 1);
    } }, 'Дальше'));
  }

  function stepNext(shop) {
    const geo = h('div');
    const drawGeo = () => fill(geo, h('div', { class: 'q' }, 'Место визита', h('span', { class: 'muted', style: 'font-weight:500;font-size:14px' }, ', можно пропустить')),
      d.geo ? h('p', {}, 'Отмечено: ' + d.geo.src + (d.geo.acc ? ', точность ' + d.geo.acc + ' м' : '')) : null,
      h('div', { class: 'btns' },
        h('button', { class: 'btn white small', type: 'button', onclick: (e) => { e.currentTarget.disabled = true; gpsFix((p) => { d.geo = p; remember(); drawGeo(); }, (m) => { toast(m, true); drawGeo(); }); } }, 'По GPS'),
        h('button', { class: 'btn white small', type: 'button', onclick: () => askMapLink((p) => { d.geo = { ...p, acc: null }; remember(); drawGeo(); }) }, 'Из ссылки карты')),
      d.geo && shop && !hasPoint(shop) ? [h('div', { class: 'q' }, 'Это место точки?'),
        choices([['yes', 'Да, сохранить для маршрута'], ['no', 'Нет']], d.shopPoint, (v) => { d.shopPoint = v; remember(); }, { col: true })] : null);
    drawGeo();
    fill(s.body, nextPicker(d.next, () => remember(), shop),
      h('div', { style: 'margin-top:20px' }, field('Заметка', h('textarea', { class: 'inp', placeholder: 'Например: просили Code Red Mojito', oninput: (e) => { d.note = e.target.value; remember(); } }, d.note))),
      geo);
    s.showFoot(h('button', { class: 'btn red wide', onclick: save }, 'Сохранить визит'));
  }

  function stepLate() {
    fill(s.body, h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'В этот день здесь было несколько визитов без заказа. Выберите, к какому относится заказ.'),
      choices(late.map((v) => [v.id, 'Визит в ' + (v.at || '').slice(11, 16) + (v.note ? ', ' + v.note : '')]), d.lateVisitId, (v) => { d.lateVisitId = v; go(i + 1); }, { col: true }));
  }

  function save() {
    if (saving) return;
    const shop = shopById(d.shopId);
    const items = d.result === 'order' ? pickItems(d.pick) : [];
    const total = pickTotal(d.pick);
    const v = { ...d, items, next: mode === 'order' ? { type: 'none' } : d.next };
    const errs = visitErrors(v, shop).filter((e) => mode === 'visit' || !e.includes('ЛПР'));
    if (errs.length) { toast(errs[0], true); return; }
    if (d.result === 'order') { const e = payError(d, total); if (e) { toast(e, true); return; } }
    saving = true;
    saveVisit({
      shopId: d.shopId, shopName: shop ? shop.name : '', date: d.date, result: d.result, items, total, payment: d.payment,
      shopSnap: shop ? { name: shop.name, contact: shop.contact || '', phone: shop.phone || '', address: shop.address || '', district: shop.district || '', locality: shop.locality || '' } : null,
      paidNow: parseMoney(d.paidNow) || 0, lpr: d.lpr, refusal: d.refusal, next: mode === 'visit' ? d.next : null,
      note: d.note, orderNote: d.orderNote, lateVisitId: d.lateVisitId || '', withVisit: mode === 'visit' || !!d.lateVisitId,
      geo: d.geo, shopPoint: d.geo && d.shopPoint === 'yes' ? d.geo : null,
    });
    dropDraft(draftId);
    toast((mode === 'order' ? 'Заказ' : 'Визит') + ' сохранён' + (S.online ? '' : ' на телефоне. Уйдёт в облако, когда будет связь'));
    s.close();
  }

  draw();
}
