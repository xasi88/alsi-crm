// Фигуры панелей: главное число с изменением, доли одной полосой, рейтинг с фото, воронка, шкала плана.
// Цвета данных только у меток (полосы, квадратики легенды); текст всегда тёмный. Брендбук, раздел «Графики».
import { h } from './kit.js?v=2f681d03';
import { s, play, countUp, rubInt } from './charts.js?v=2f681d03';

const arrow = (dir) => s('svg', { viewBox: '0 0 10 10', width: 10, height: 10, 'aria-hidden': 'true', class: 'arr' },
  s('path', { d: dir === 'up' ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z' }));

// Изменение к прошлому периоду: стрелка и знак, рост зелёный, падение красный, цвет не единственный признак
export function deltaChip(d, compare) {
  if (!d) return h('span', { class: 'delta flat' }, compare ? 'В прошлом периоде продаж не было' : '');
  const sign = d.pct > 0 ? '+' : d.pct < 0 ? '−' : '';
  return h('span', { class: 'delta ' + d.dir, title: compare },
    d.dir === 'flat' ? null : arrow(d.dir), sign + Math.abs(d.pct) + '%', compare ? h('small', {}, ' ' + compare) : null);
}

// Главное число экрана: одно на панель. Число досчитывается при первом показе.
export function hero({ key, label, value, fmt = rubInt, delta = null, compare = '', sub = null }) {
  const run = play(key);
  return h('div', { class: 'hero' },
    h('span', { class: 'hero-l' }, label),
    countUp(h('b', { class: 'hero-v' }), value, fmt, run),
    deltaChip(delta, compare),
    sub ? h('div', { class: 'hero-sub' }, sub) : null);
}

// Целое из частей: одна полоса и легенда (имя, значение, доля). parts: [{ label, value, color, text }]
export function segBar({ key, parts, title = '' }) {
  const run = play(key);
  const total = parts.reduce((n, p) => n + Math.max(0, p.value), 0);
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);
  const shown = parts.filter((p) => p.value > 0);
  return h('div', { class: 'seg-chart' + (run ? ' play' : '') },
    h('div', { class: 'segbar', role: 'img', 'aria-label': title + ': ' + parts.map((p) => p.label + ' ' + pct(p.value) + '%').join(', ') },
      shown.length ? shown.map((p, i) => h('i', { style: `flex-grow:${p.value};background:${p.color}` + (run ? `;animation-delay:${i * 90}ms` : '') }))
        : h('i', { class: 'empty', style: 'flex-grow:1' })),
    h('div', { class: 'legend' }, parts.map((p) => h('div', { class: 'lg' },
      h('span', { class: 'lg-sw', style: 'background:' + p.color }),
      h('span', { class: 'lg-n' }, p.label),
      h('b', { class: 'num' }, p.text ?? String(p.value)),
      h('span', { class: 'lg-p num' }, pct(p.value) + '%')))));
}

// Рейтинг: место, фото (если есть), имя, подпись, значение и тонкая полоса от наибольшего
export function rankBars({ key, rows, max = 0, onPick = null }) {
  const run = play(key);
  const top = max || Math.max(1, ...rows.map((r) => r.value));
  return h('div', { class: 'group rank' + (run ? ' play' : '') }, rows.map((r, i) => h(onPick ? 'button' : 'div', {
    class: 'rk', onclick: onPick ? () => onPick(r) : null },
  h('span', { class: 'rk-i num' }, String(i + 1)),
  r.pic !== undefined ? h('span', { class: 'rk-pic' }, r.pic ? h('img', { src: r.pic, alt: '', loading: 'lazy' }) : null) : null,
  h('div', { class: 'rk-t' },
    h('div', { class: 'rk-row' }, h('span', { class: 'rk-n' }, r.label), h('b', { class: 'num' }, r.text)),
    r.sub ? h('small', {}, r.sub) : null,
    h('div', { class: 'rk-bar' }, h('i', { style: `transform:scaleX(${Math.max(0.01, Math.min(1, r.value / top))})` + (run ? `;animation-delay:${Math.min(i * 50, 500)}ms` : '') }))))));
}

// Воронка: шаги одной полосой от первого, между шагами доля перехода
export function funnelBars({ key, steps }) {
  const run = play(key);
  const first = Math.max(1, steps[0]?.value || 0);
  const out = [];
  steps.forEach((st, i) => {
    if (i > 0) {
      const prev = steps[i - 1].value;
      out.push(h('div', { class: 'fn-step' }, arrowDown(), prev ? Math.round((st.value / prev) * 100) + '% из них' : 'нет данных'));
    }
    out.push(h('div', { class: 'fn-row' + (i === steps.length - 1 ? ' last' : '') },
      h('div', { class: 'fn-l' }, h('span', {}, st.label), h('b', { class: 'num' }, String(st.value))),
      h('div', { class: 'fn-bar' }, h('i', { style: `transform:scaleX(${Math.max(0.01, st.value / first)})` + (run ? `;animation-delay:${i * 140}ms` : '') }))));
  });
  return h('div', { class: 'funnel' + (run ? ' play' : '') }, out);
}
const arrowDown = () => s('svg', { viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true', class: 'arr' }, s('path', { d: 'M6 10 2 5h8z' }));

// Шкала плана: заполнение, засечка «где надо быть к сегодня»
export function meter({ key, pct, mark = null, label = '' }) {
  const run = play(key);
  const p = Math.max(0, Math.min(100, pct));
  return h('div', { class: 'meter' + (run ? ' play' : ''), role: 'img', 'aria-label': label },
    h('i', { style: `transform:scaleX(${Math.max(0.001, p / 100)})` }),
    mark !== null && mark > 0 && mark < 100 ? h('b', { style: `left:${mark}%` }) : null);
}
