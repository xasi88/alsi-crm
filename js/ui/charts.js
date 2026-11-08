// Графики на SVG: столбцы по дням или месяцам, кольцо плана. Правила вида: брендбук, раздел «Графики».
// Движение один раз при первом показе экрана; обновление данных его не повторяет. «Меньше движения» выключает всё.
import { h, fill } from './kit.js?v=2f681d03';
import { rub } from '../logic/format.js?v=2f681d03';
import { dayShort, monthTitle } from '../logic/dates.js?v=2f681d03';
import { niceTicks, shortNum } from '../logic/dash.js?v=2f681d03';

const NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) el.append(k);
  return el;
}

// Движение: какие графики уже показаны на этом экране
const played = new Set();
export const resetMotion = () => played.clear();
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export function play(key) {
  if (!key || played.has(key) || still()) return false;
  played.add(key);
  return true;
}

// Число досчитывается от нуля (только при первом показе)
export function countUp(el, to, fmt, run) {
  if (!run || !(Math.abs(to) > 0)) { el.textContent = fmt(to); return el; }
  const t0 = performance.now();
  const dur = 900;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(k < 1 ? to * (1 - (1 - k) ** 3) : to);
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = fmt(0);
  requestAnimationFrame(step);
  return el;
}
export const rubInt = (n) => rub(Math.round(n));

// Ширина графика: меряем после вставки, перерисовываем при смене ширины окна
const boxes = new Set();
addEventListener('resize', () => {
  for (const c of boxes) {
    if (!c.box.isConnected) { boxes.delete(c); continue; }
    const w = c.box.clientWidth;
    if (w && Math.abs(w - c.w) > 2) { c.w = w; c.draw(w, false); }
  }
});
function sized(box, draw, run) {
  for (const c of boxes) if (!c.box.isConnected && c.w) boxes.delete(c);
  const c = { box, draw, w: 0 };
  boxes.add(c);
  // Сразу после вставки в страницу (не ждём кадра: скрытая вкладка кадров не даёт)
  const go = () => {
    if (!box.isConnected) { requestAnimationFrame(go); return; }
    c.w = box.clientWidth || 320;
    draw(c.w, run);
  };
  queueMicrotask(go);
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const xLabel = (key, unit) => (unit === 'month' ? MONTHS[Number(key.slice(5, 7)) - 1] : String(Number(key.slice(8, 10))));

// Столбик со скруглённым верхом 4, прямой у основания
function barPath(x, y, w, hh, r = 4) {
  if (!(hh > 0.5)) return '';
  const rr = Math.min(r, w / 2, hh);
  return `M${x},${y + hh}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + hh}Z`;
}

// Столбцы: выручка по дням или месяцам. Нажатие (или стрелки) показывает день: сумма, заказы, упаковки.
export function columns({ key, points, unit = 'day', today = '', height = 176, title = 'Выручка', note = (p) => '' }) {
  const run = play(key);
  const box = h('div', { class: 'chart' });
  const hint = () => h('span', { class: 'muted' }, 'Нажмите на столбец, чтобы увидеть ' + (unit === 'month' ? 'месяц' : 'день'));
  const tip = h('div', { class: 'tip', role: 'status' }, hint());
  let sel = -1;
  const total = points.reduce((n, p) => n + p.sum, 0);
  const best = points.reduce((b, p, i) => (p.sum > (points[b]?.sum ?? -Infinity) ? i : b), -1);
  const when = (p) => (unit === 'month' ? monthTitle(p.key) : dayShort(p.key, today));
  const table = h('table', { class: 'sr' }, h('caption', {}, title), points.map((p) => h('tr', {}, h('th', {}, when(p)), h('td', {}, rub(p.sum)))));
  const wrap = h('div', { class: 'chart-wrap' }, tip, box, table);
  sized(box, draw, run);
  return wrap;

  function draw(W, anim) {
    const H = height;
    const top = 14;
    const bottom = 24;
    const max = Math.max(1, ...points.map((p) => p.sum));
    const ticks = niceTicks(max, 3);
    const left = 12 + Math.max(...ticks.map((t) => (t ? shortNum(t) : '0').length)) * 7; // место под самую длинную подпись шкалы
    const ymax = ticks[ticks.length - 1] || max;
    const plotH = H - top - bottom;
    const y = (v) => top + plotH * (1 - Math.max(0, v) / ymax);
    const n = Math.max(1, points.length);
    const slot = (W - left) / n;
    const bw = Math.max(2, Math.min(24, slot * 0.64));
    const every = Math.max(1, Math.ceil((unit === 'month' ? 30 : 22) / slot));
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: anim ? 'play' : '', role: 'img', tabindex: '0',
      'aria-label': title + ': всего ' + rub(total) + (best >= 0 && points[best].sum > 0 ? ', лучший ' + when(points[best]) + ' ' + rub(points[best].sum) : '') });
    for (const t of ticks) {
      svg.append(s('line', { class: 'grid', x1: left, x2: W, y1: y(t), y2: y(t) }),
        s('text', { class: 'ax', x: left - 8, y: y(t) + 4, 'text-anchor': 'end' }, t ? shortNum(t) : '0'));
    }
    const bars = s('g');
    const els = [];
    points.forEach((p, i) => {
      const x = left + slot * i + (slot - bw) / 2;
      const d = barPath(x, y(p.sum), bw, y(0) - y(p.sum));
      els[i] = d ? s('path', { d, class: 'bar' + (p.key === today ? ' now' : ''), style: anim ? `animation-delay:${Math.min(i * 16, 480)}ms` : null }) : null;
      if (els[i]) bars.append(els[i]);
      if (i % every === 0 || i === n - 1) {
        const lastClash = i !== n - 1 && n - 1 - i < every;
        if (!lastClash) svg.append(s('text', { class: 'ax', x: left + slot * i + slot / 2, y: H - 6, 'text-anchor': 'middle' }, xLabel(p.key, unit)));
      }
    });
    svg.append(bars);
    // Подпись только у лучшего дня: значение на верхушке
    if (best >= 0 && points[best].sum > 0) {
      const cx = left + slot * best + slot / 2;
      svg.append(s('text', { class: 'cap', x: Math.min(W - 24, Math.max(left + 24, cx)), y: y(points[best].sum) - 5, 'text-anchor': 'middle' }, shortNum(points[best].sum)));
    }
    const pick = (i) => {
      sel = Math.max(0, Math.min(n - 1, i));
      const p = points[sel];
      fill(tip, h('b', {}, when(p)), h('span', { class: 'num' }, p.sum ? rub(p.sum) : 'Нет продаж'),
        p.orders ? h('small', {}, p.orders + ' ' + (p.orders === 1 ? 'заказ' : p.orders < 5 ? 'заказа' : 'заказов') + (p.packs ? ', ' + p.packs + ' уп. напитков' : '') + note(p)) : null);
      els.forEach((b) => b && b.classList.remove('on'));
      els[sel]?.classList.add('on');
    };
    const at = (e) => {
      const r = svg.getBoundingClientRect();
      return Math.floor(((e.clientX - r.left) * (W / r.width) - left) / slot);
    };
    svg.addEventListener('pointerdown', (e) => pick(at(e)));
    svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) pick(at(e)); });
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick((sel < 0 ? n : sel) + (e.key === 'ArrowRight' ? 1 : -1)); }
    });
    fill(box, svg);
    if (sel >= 0) pick(sel);
  }
}

// Кольцо: доля выполнения. mark: где надо быть к сегодня (тонкая засечка). В центре свой текст.
export function ring({ key, pct, mark = null, size = 140, stroke = 12, label = '' }, ...center) {
  const run = play(key);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'ring' + (run ? ' play' : ''), role: 'img', 'aria-label': label },
    s('circle', { class: 'ring-track', cx: c, cy: c, r, 'stroke-width': stroke }),
    p > 0 ? s('circle', { class: 'ring-fill', cx: c, cy: c, r, 'stroke-width': stroke, 'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - p / 100),
      transform: `rotate(-90 ${c} ${c})`, style: `--c:${C}` }) : null);
  if (mark !== null && mark > 0 && mark < 100) {
    const a = (mark / 100) * 2 * Math.PI - Math.PI / 2;
    const r1 = r - stroke / 2 - 3;
    const r2 = r + stroke / 2 + 3;
    svg.append(s('line', { class: 'ring-mark', x1: c + r1 * Math.cos(a), y1: c + r1 * Math.sin(a), x2: c + r2 * Math.cos(a), y2: c + r2 * Math.sin(a) }));
  }
  return h('div', { class: 'ring-box', style: `width:${size}px;height:${size}px` }, svg, h('div', { class: 'ring-in' }, center));
}
