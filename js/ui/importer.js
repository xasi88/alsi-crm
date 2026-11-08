// Перенос базы из программы Атама: что в файле, люди, товары, запись, сверка счётчиков.
// Только владелец. Повторный перенос перезаписывает те же записи: двойников нет.
import { S, all, pendingCount, member } from '../store.js?v=79063987';
import { writeMany } from '../save.js?v=79063987';
import { h, fill, sheet, toast, ask, choices, field, inp } from './kit.js?v=79063987';
import { readAtam, convertAtam, reconcile, SRC } from '../logic/atam.js?v=79063987';
import { LABELS } from '../logic/backup.js?v=79063987';
import { rub } from '../logic/format.js?v=79063987';

const ROLE_ATAM = { owner: 'владелец', supervisor: 'супервайзер', sales: 'торговый' };
const LIMIT = 18000; // бесплатный тариф Firebase: 20 000 записей в сутки

export function startAtamImport(data, name) {
  const info = readAtam(data);
  if (info.error) { toast(info.error, true); return; }
  const s = sheet({ title: 'Перенос из программы Атама', sub: name + (info.exportedAt ? ', файл от ' + info.exportedAt.slice(0, 10) : ''), full: true });
  // Кого куда: почта в нашей команде, роль, добавить ли в команду
  const plan = new Map(info.people.map((p) => [p.userId, {
    email: p.email, name: p.name, add: p.email ? 'add' : 'me',
    role: p.role === 'supervisor' || p.role === 'owner' ? 'supervisor' : 'sales', supUserId: p.supervisorUserId,
  }]));
  const total = Object.values(info.counts).reduce((a, b) => a + b, 0);
  let step = 'people';

  const draw = () => {
    s.hideFoot();
    if (step === 'people') drawPeople();
    else if (step === 'check') drawCheck();
  };

  function drawPeople() {
    fill(s.body,
      h('div', { class: 'group', style: 'margin:0' }, Object.entries(info.counts).map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, LABELS[k] || k), h('b', { class: 'num' }, String(v))))),
      total > LIMIT ? h('div', { class: 'warnbox' }, h('b', {}, 'Записей больше ' + LIMIT + '.'), ' Бесплатный тариф Firebase пишет до 20 000 записей в сутки. Перенос пойдёт частями: повторите на следующий день, записанное не задвоится.') : null,
      h('div', { class: 'q' }, 'Люди из файла'),
      h('p', { class: 'hint' }, 'Их визиты и заказы запишутся на почту, которую вы укажете. Чтобы человек вошёл в «ALSI Продажи», нужна его почта Google.'),
      info.people.map((p) => {
        const x = plan.get(p.userId);
        const box = h('div');
        const drawOne = () => fill(box,
          choices([['add', 'Добавить в команду'], ['me', 'Записать всё на меня']], x.add, (v) => { x.add = v; drawOne(); }, { col: true }),
          x.add === 'add' ? [field('Почта Google', inp({ type: 'email', value: x.email, oninput: (e) => { x.email = e.target.value.trim().toLowerCase(); } })),
            field('Имя', inp({ value: x.name, oninput: (e) => { x.name = e.target.value; } })),
            h('div', { class: 'q', style: 'font-size:16px' }, 'Роль у нас'),
            choices([['sales', 'Торговый'], ['supervisor', 'Супервайзер']], x.role, (v) => { x.role = v; }, { col: true })] : null);
        drawOne();
        return h('div', { class: 'group', style: 'margin:12px 0 0;padding:12px 16px' },
          h('b', {}, (p.name || p.email || 'Без владельца') + ', у Атама ' + (ROLE_ATAM[p.role] || p.role)), h('small', { class: 'muted', style: 'display:block;margin-bottom:8px' }, 'Записей: ' + p.records + (p.email ? ', ' + p.email : '')), box);
      }));
    s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
      for (const [, x] of plan) if (x.add === 'add' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) { toast('Проверьте почту: ' + (x.email || 'пусто'), true); return; }
      step = 'check';
      draw();
    } }, 'Дальше'));
  }

  // Люди для перевода записей: почта и супервайзер (lead)
  const people = () => {
    const map = new Map();
    for (const [uid, x] of plan) map.set(uid, { email: x.add === 'add' ? x.email : S.email, lead: '' });
    for (const [uid, x] of plan) {
      if (x.add !== 'add' || x.role === 'supervisor') continue;
      const sup = plan.get(x.supUserId);
      map.get(uid).lead = sup && sup.add === 'add' && sup.role === 'supervisor' ? sup.email : member(x.email)?.lead || '';
    }
    map.get('') || map.set('', { email: S.email, lead: '' });
    return map;
  };

  function drawCheck() {
    const ppl = people();
    const conv = convertAtam(data, { people: ppl, ours: all('products') });
    // План пишем только людям из файла: план владельца не трогаем
    const added = new Set([...plan.values()].filter((x) => x.add === 'add').map((x) => x.email));
    conv.plans = conv.plans.filter(([, p]) => added.has(p.rep) && p.rep !== S.email);
    // В команду: новые люди. Карточки тех, кто уже в команде, не меняем.
    const team = [...plan].filter(([, x]) => x.add === 'add' && x.email !== S.email && !member(x.email))
      .map(([uid, x]) => ({ ...x, lead: x.role === 'supervisor' ? '' : ppl.get(uid).lead }));
    const n = ['shops', 'visits', 'orders', 'returns', 'payments', 'products', 'plans'].reduce((a, k) => a + conv[k].length, 0) + team.length;
    fill(s.body,
      h('div', { class: 'group', style: 'margin:0' },
        h('div', { class: 'kv' }, h('span', {}, 'Людей в команду'), h('b', {}, String(team.length))),
        h('div', { class: 'kv' }, h('span', {}, 'Новых товаров'), h('b', {}, String(conv.products.length))),
        h('div', { class: 'kv' }, h('span', {}, 'Товары, которые уже есть'), h('b', {}, String(info.counts.products - conv.products.length))),
        h('div', { class: 'kv' }, h('span', {}, 'Всего записей'), h('b', { class: 'num' }, String(n)))),
      conv.matched.length ? [h('div', { class: 'q' }, 'Цены у нас и у Атама разные'),
        h('p', { class: 'hint' }, 'Каталог не меняется. Старые заказы Атама сохраняют свои цены.'),
        h('div', { class: 'group', style: 'margin:0' }, conv.matched.map((m) => h('div', { class: 'kv' }, h('span', {}, m.name), h('b', { class: 'num' }, rub(m.ours) + ' у нас, ' + rub(m.atam) + ' у Атама'))))] : null,
      conv.problems.length ? [h('div', { class: 'q' }, 'Замечания по файлу'), h('div', { class: 'warnbox' }, conv.problems.slice(0, 12).map((p) => h('div', {}, p)),
        conv.problems.length > 12 ? h('div', {}, 'и ещё ' + (conv.problems.length - 12)) : null)] : null,
      h('p', { class: 'hint', style: 'margin-top:12px' }, 'Повторный перенос того же файла перезапишет перенесённые записи данными из файла. Двойников не будет.'));
    s.showFoot(h('button', { class: 'btn white', onclick: () => { step = 'people'; draw(); } }, 'Назад'),
      h('button', { class: 'btn red', style: 'flex:1', onclick: (e) => run(e.currentTarget, conv, team) }, 'Перенести'));
    s.foot.style.display = 'flex';
    s.foot.style.gap = '8px';
  }

  async function run(btn, conv, team) {
    if (!S.owner) { toast('Перенос делает только владелец', true); return; }
    if (!S.online) { toast('Нужна связь с облаком', true); return; }
    if (pendingCount()) { toast('Сначала дождитесь отправки всех записей', true); return; }
    if (!(await ask('Перенести базу?', 'Записи из файла Атама появятся у вас и у людей, которых вы добавили.', 'Перенести'))) return;
    btn.disabled = true;
    const now = new Date().toISOString();
    const list = [];
    for (const x of team) list.push({ col: 'team', id: x.email, merge: true, data: { name: x.name || x.email, role: x.role, active: true, lead: x.lead, src: SRC, by: S.email, at: now } });
    for (const col of ['products', 'shops', 'visits', 'orders', 'returns', 'payments', 'plans']) for (const [id, data] of conv[col]) list.push({ col, id, data });
    try {
      await writeMany(list, (done, all2) => { btn.textContent = 'Записано ' + done + ' из ' + all2; });
    } catch (err) {
      toast('Перенос прервался: ' + (err.code || 'нет связи') + '. Повторите: записанное не задвоится', true);
      btn.disabled = false;
      btn.textContent = 'Перенести';
      return;
    }
    toast('Записано. Сверяю счётчики');
    expectPlans = conv.plans.length;
    setTimeout(() => verify(), 2500);
  }

  let expectPlans = 0;
  function verify() {
    const have = {};
    for (const col of ['shops', 'visits', 'orders', 'returns', 'payments', 'plans']) have[col] = (S[col] || []).filter((x) => x.src === SRC).length;
    const rows = reconcile({ ...info.counts, plans: expectPlans }, have);
    const ok = rows.every((r) => r.ok);
    s.hideFoot();
    fill(s.body, h('div', { class: ok ? 'okbox' : 'warnbox' }, h('b', {}, ok ? 'Счётчики сходятся с файлом' : 'Счётчики пока не сходятся')),
      h('div', { class: 'group', style: 'margin:12px 0 0' }, rows.map((r) => h('div', { class: 'kv' }, h('span', {}, LABELS[r.key] || r.key),
        h('b', { class: 'num ' + (r.ok ? 'ok' : 'red') }, r.file + ' в файле, ' + r.ours + ' у нас')))),
      ok ? null : h('p', { class: 'hint', style: 'margin-top:12px' }, 'Облако могло ещё не прислать все записи. Нажмите «Сверить снова» через минуту.'),
      h('div', { class: 'gap' }),
      h('button', { class: 'btn navy wide', onclick: verify }, 'Сверить снова'),
      h('button', { class: 'btn white wide', style: 'margin-top:8px', onclick: () => s.close() }, 'Готово'));
  }

  draw();
}
