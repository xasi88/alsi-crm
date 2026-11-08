// Скрипт продаж: шаги первого контакта и ответы на возражения. Текст правит владелец.
import { S, config } from '../store.js?v=69f8b533';
import { saveConfig } from '../save.js?v=69f8b533';
import { h, fill, sheet, toast, field, inp } from './kit.js?v=69f8b533';
import { head, sec } from './common.js?v=69f8b533';

// Начальный текст: короткий рабочий ориентир. Владелец меняет его под себя.
const BASE = {
  steps: [
    ['Найти того, кто решает', '«Добрый день. Подскажите, кто у вас решает, какой товар брать?»'],
    ['Коротко представиться', '«Меня зовут {имя}, я от ALSI. Покажу напитки, это займёт пару минут.»'],
    ['Понять точку', 'Спросите только нужное: какие напитки берут, что быстро уходит, есть ли место в холодильнике.'],
    ['Показать выгоду', 'Говорите о продажах и прибыли точки: наценка, спрос, реклама бренда в Instagram @alsi_grozny.'],
    ['Договориться о действии', 'Готовы: оформите заказ. Нет: запишите, когда позвонить или приехать.'],
  ],
  objections: [
    ['«Дорого»', '«Дорого по закупке или по цене, за которую здесь получится продать? Давайте посчитаем наценку на одну банку.»'],
    ['«Уже есть другие напитки»', '«Понимаю. Наши напитки стоят рядом и не забирают место у ходовых. Начните с одной упаковки и посмотрите, как уйдёт.»'],
    ['«Надо подумать»', '«Конечно. Когда удобнее вернуться к разговору: позвонить или приехать?»'],
  ],
};

const text = (s) => String(s || '').replace('{имя}', S.me?.name?.split(' ')[0] || 'Имя');

function current() {
  const c = config('script');
  return { steps: c?.steps?.length ? c.steps : BASE.steps.map(([title, body]) => ({ title, body })).map((x) => x),
    objections: c?.objections?.length ? c.objections : BASE.objections.map(([title, body]) => ({ title, body })) };
}

export function mountScript(root) {
  const update = () => {
    const c = current();
    const norm = (x) => (Array.isArray(x) ? { title: x[0], body: x[1] } : x);
    fill(root,
      head('Скрипт продаж', 'Короткий ориентир для разговора в точке'),
      sec('Первый контакт'),
      h('div', { class: 'group' }, c.steps.map(norm).map((x, k) => h('div', { class: 'script-step' }, h('b', {}, (k + 1) + '. ' + x.title), h('p', {}, text(x.body))))),
      sec('Возражения'),
      h('div', { class: 'group' }, c.objections.map(norm).map((x) => h('div', { class: 'script-step' }, h('b', {}, x.title), h('p', { class: 'quote' }, text(x.body))))),
      S.owner ? h('div', { class: 'pad', style: 'margin-top:16px' }, h('button', { class: 'btn line wide', onclick: () => editScript(c) }, 'Изменить текст')) : null,
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}

function editScript(c) {
  const d = { steps: c.steps.map((x) => (Array.isArray(x) ? { title: x[0], body: x[1] } : { ...x })), objections: c.objections.map((x) => (Array.isArray(x) ? { title: x[0], body: x[1] } : { ...x })) };
  const s = sheet({ title: 'Скрипт продаж', sub: '{имя} заменяется именем торгового', full: true });
  const block = (list, label) => {
    const box = h('div');
    const draw = () => fill(box, list.map((x, k) => h('div', { class: 'group', style: 'margin:0 0 12px;padding:12px' },
      field(label + ' ' + (k + 1), inp({ value: x.title, oninput: (e) => { x.title = e.target.value; } })),
      field('Текст', h('textarea', { class: 'inp', oninput: (e) => { x.body = e.target.value; } }, x.body)),
      h('button', { class: 'btn white small', onclick: () => { list.splice(k, 1); draw(); } }, 'Убрать'))),
    h('button', { class: 'btn line wide', onclick: () => { list.push({ title: '', body: '' }); draw(); } }, 'Добавить'));
    draw();
    return box;
  };
  s.body.append(h('div', { class: 'q' }, 'Шаги первого контакта'), block(d.steps, 'Шаг'), h('div', { class: 'q' }, 'Возражения'), block(d.objections, 'Возражение'));
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    const ok = (x) => x.title.trim() && x.body.trim();
    saveConfig('script', { steps: d.steps.filter(ok), objections: d.objections.filter(ok) });
    toast('Скрипт сохранён');
    s.close();
  } }, 'Сохранить'));
}
