// Мелкие детали интерфейса: элементы, значки, листы, сообщения.

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
}

function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === undefined || k === null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function icon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'i');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + id);
  svg.append(use);
  return svg;
}

export function fill(el, ...kids) {
  el.replaceChildren();
  add(el, kids);
  return el;
}

// Кнопка-ссылка наружу (WhatsApp, звонок, карты)
export function ext(href, cls, ...kids) {
  return h('a', { class: cls, href, target: href.startsWith('tel:') ? null : '_blank', rel: 'noopener' }, ...kids);
}

let toastTimer = 0;
export function toast(text, bad = false) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, icon(bad ? 'clock' : 'ok'), text);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), bad ? 5000 : 2600);
}

// Листы поверх экрана. Кнопка «Назад» телефона закрывает верхний лист.
const stack = [];
addEventListener('popstate', () => {
  const depth = history.state?.sheet || 0;
  while (stack.length > depth) drop(stack.pop());
});

function drop(s) {
  s.el.classList.add('closing');
  setTimeout(() => s.el.remove(), 200);
  s.onClose?.();
}

export function sheet({ title, sub = '', full = false, onClose } = {}) {
  const head = h('div', { class: 'sh-head' });
  const body = h('div', { class: 'sh-body' });
  const foot = h('div', { class: 'sh-foot hide' });
  const el = h('div', { class: 'sheet' + (full ? ' full' : ''), role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'shade', onclick: () => s.close() }),
    h('div', { class: 'panel' }, head, body, foot));
  const s = {
    el, body, foot, head, onClose,
    close() { if (stack.includes(s)) history.back(); },
    setTitle(t, st = '') {
      fill(head,
        h('button', { class: 'ib white', 'aria-label': full ? 'Назад' : 'Свернуть', onclick: () => s.close() }, icon(full ? 'back' : 'down')),
        h('h2', {}, t, st ? h('span', { class: 'sub' }, st) : null));
    },
    showFoot(...kids) { foot.classList.remove('hide'); fill(foot, ...kids); },
    hideFoot() { foot.classList.add('hide'); },
  };
  s.setTitle(title, sub);
  stack.push(s);
  history.pushState({ ...(history.state || {}), sheet: stack.length }, '');
  document.body.append(el);
  return s;
}

// Вопрос «да или нет» своим листом (окна браузера не используем)
export function ask(title, text, okLabel, danger = false) {
  return new Promise((resolve) => {
    let answered = false;
    const s = sheet({ title, onClose: () => { if (!answered) resolve(false); } });
    s.body.append(h('p', { style: 'margin:4px 0 20px' }, text),
      h('div', { class: 'btns' },
        h('button', { class: 'btn line', onclick: () => s.close() }, 'Отмена'),
        h('button', { class: 'btn ' + (danger ? 'red' : 'navy'), onclick: () => { answered = true; resolve(true); s.close(); } }, okLabel)));
  });
}

export function choices(list, value, onPick, { multi = false, col = false, blue = false } = {}) {
  const wrap = h('div', { class: 'choices' + (col ? ' col' : '') });
  const draw = () => fill(wrap, list.map(([id, label]) => {
    const on = multi ? (value || []).includes(id) : value === id;
    return h('button', {
      class: 'choice' + (on ? (blue ? ' on-blue' : ' on') : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false',
      onclick: () => {
        if (multi) {
          const set = new Set(value || []);
          set.has(id) ? set.delete(id) : set.add(id);
          value = [...set];
        } else value = id;
        onPick(value);
        draw();
      },
    }, label);
  }));
  draw();
  return wrap;
}

export function field(label, input, note = '') {
  return h('label', { class: 'field' }, h('span', {}, label, note ? h('em', {}, ' ' + note) : null), input);
}

export const inp = (props = {}) => h('input', { class: 'inp', ...props });

// Выбор одного варианта из списка своим листом (вместо выпадающего списка: удобно пальцем)
export function pickOne({ title, sub = '', items, value, onPick, search = false }) {
  const s = sheet({ title, sub });
  let q = '';
  const list = h('div');
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = items.filter(([, label, note]) => words.every((w) => (label + ' ' + (note || '')).toLowerCase().includes(w)));
    fill(list, h('div', { class: 'group', style: 'margin:0' }, rows.slice(0, 200).map(([id, label, note]) => h('button', {
      class: 'item' + (id === value ? ' picked' : ''), onclick: () => { onPick(id); s.close(); },
    }, h('div', { class: 't' }, h('b', {}, label), note ? h('small', {}, note) : null), id === value ? icon('ok') : null))),
    rows.length ? null : h('div', { class: 'empty', style: 'margin:0' }, 'Ничего не нашлось'));
  };
  if (search) {
    s.body.append(h('div', { class: 'search', style: 'margin:0 0 12px' }, icon('search'),
      inp({ type: 'search', placeholder: 'Поиск', oninput: (e) => { q = e.target.value; draw(); } })));
  }
  s.body.append(list);
  draw();
  return s;
}

// Вкладки одного экрана
export function seg(list, value, onPick) {
  return h('div', { class: 'seg', role: 'tablist' }, list.map(([id, label]) => h('button', {
    class: id === value ? 'on' : '', role: 'tab', 'aria-selected': id === value ? 'true' : 'false', onclick: () => onPick(id),
  }, label)));
}

export const stat = (value, label, cls = '') => h('div', { class: 'stat ' + cls }, h('b', { class: 'num' }, value), h('span', {}, label));

// Скачать файл, созданный в приложении
export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Прочитать выбранный файл как текст
export function readFile(f) {
  return new Promise((resolve) => {
    if (!f) { resolve(null); return; }
    const r = new FileReader();
    r.onload = () => resolve({ name: f.name, size: f.size, text: String(r.result || '') });
    r.onerror = () => resolve(null);
    r.readAsText(f, 'utf-8');
  });
}

// Выбрать файл на устройстве и прочитать как текст
export function pickFile(accept) {
  return new Promise((resolve) => {
    const i = h('input', { type: 'file', accept, style: 'display:none' });
    i.onchange = () => {
      const f = i.files && i.files[0];
      i.remove();
      readFile(f).then(resolve);
    };
    document.body.append(i);
    i.click();
  });
}

// Кнопка выбора файла: поле файла стоит внутри кнопки постоянно. Файл можно выбрать касанием или подать в поле напрямую.
// check() перед окном выбора: вернёт текст ошибки, окно не откроется
export function fileButton(label, accept, onFile, { cls = 'btn line wide', style = '', check } = {}) {
  const i = h('input', { type: 'file', accept, 'aria-label': label, style: 'position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;overflow:hidden',
    onchange: async () => { const x = await readFile(i.files && i.files[0]); i.value = ''; if (x) onFile(x); } });
  return h('label', { class: cls, style: 'position:relative;cursor:pointer;' + style,
    onclick: (e) => { if (e.target === i || !check) return; const why = check(); if (why) { e.preventDefault(); toast(why, true); } } }, label, i);
}

// Память экрана на телефоне: фильтры, поиск, вкладка
export function remember(key, defaults) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { saved = {}; }
  const state = { ...defaults, ...saved };
  state.save = () => {
    const { save, ...rest } = state;
    try { localStorage.setItem(key, JSON.stringify(rest)); } catch (e) { /* без памяти */ }
  };
  return state;
}
