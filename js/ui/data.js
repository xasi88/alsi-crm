// Данные: счётчики, связь, работа без связи, резервная копия, перенос из программы Атама.
import { S, pendingCount, all } from '../store.js?v=895b33d7';
import { writeMany } from '../save.js?v=895b33d7';
import { h, icon, fill, sheet, toast, ask, choices, download, fileButton, stat } from './kit.js?v=895b33d7';
import { head, sec } from './common.js?v=895b33d7';
import { isoDay } from '../logic/dates.js?v=895b33d7';
import { buildBackup, kindOf, restorePlan, fileName, COLS, LABELS } from '../logic/backup.js?v=895b33d7';
import { listDrafts } from './drafts.js?v=895b33d7';
import { startAtamImport } from './importer.js?v=895b33d7';

// Готово ли приложение к работе без связи: файлы приложения лежат в копии на телефоне
async function offlineCheck() {
  if (!('caches' in window)) return { ok: false, text: 'Этот браузер не хранит копию приложения' };
  const keys = (await caches.keys()).filter((k) => k.startsWith('alsi-crm-'));
  if (!keys.length) return { ok: false, text: 'Копии ещё нет. Откройте приложение со связью и подождите минуту' };
  const c = await caches.open(keys[keys.length - 1]);
  const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin) && /\.(js|css|svg|png|webmanifest)(\?|$)/.test(u));
  let have = 0;
  for (const u of urls) if (await c.match(u, { ignoreSearch: false })) have += 1;
  const sdk = (await c.keys()).some((r) => r.url.includes('firebasejs'));
  const ok = have === urls.length && sdk;
  return { ok, text: ok ? 'Готово: ' + have + ' файлов приложения и библиотека облака в копии' : 'В копии ' + have + ' из ' + urls.length + ' файлов' + (sdk ? '' : ', библиотеки облака нет') };
}

function warm() {
  navigator.serviceWorker?.ready.then((reg) => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name).concat(location.href.split('#')[0]);
    reg.active && reg.active.postMessage({ cache: urls });
  });
}

export function mountData(root) {
  let offline = null;
  const update = () => {
    const n = pendingCount();
    fill(root,
      head('Данные', S.owner ? 'Вся база команды' : 'Записи, которые видите вы'),
      h('div', { class: 'stats' }, COLS.filter((c) => !['config', 'plans'].includes(c)).map((c) => stat(String(all(c).length), LABELS[c].toLowerCase()))),
      sec('Связь'),
      h('div', { class: 'group' },
        h('div', { class: 'item' }, icon('cloud'), h('div', { class: 't' }, h('b', {}, S.online ? 'Связь есть' : 'Нет связи'),
          h('small', {}, n ? 'Ждут отправки: ' + n + '. Уйдут в облако сами, закрывать приложение можно' : 'Все записи в облаке'))),
        h('div', { class: 'item' }, icon('edit'), h('div', { class: 't' }, h('b', {}, 'Черновиков на телефоне: ' + listDrafts().length), h('small', {}, 'Черновики не уходят в облако'))),
        h('div', { class: 'item' }, icon('ok'), h('div', { class: 't' }, h('b', {}, 'Работа без связи'),
          h('small', {}, offline ? offline.text : 'Проверьте, что приложение откроется и без интернета')),
        h('button', { class: 'btn line small', onclick: async () => { warm(); offline = { text: 'Проверяю' }; update(); setTimeout(async () => { offline = await offlineCheck(); update(); }, 2500); } }, 'Проверить'))),
      sec('Резервная копия'),
      h('div', { class: 'pad' },
        h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'Файл со всеми точками, визитами, заказами, возвратами, оплатами, товарами и планами. В нём телефоны и цены: храните его в закрытом месте.'),
        h('button', { class: 'btn navy wide', onclick: () => {
          const b = buildBackup(S, S.email);
          for (const c of COLS) b[c] = b[c].map(({ _wait, ...x }) => x);
          download(fileName(isoDay()), JSON.stringify(b, null, 1));
          toast(n ? 'Копия скачана вместе с записями, которые ещё не ушли в облако' : 'Резервная копия скачана');
        } }, 'Скачать резервную копию'),
        S.owner ? fileButton('Загрузить копию или файл программы Атама', '.json,application/json', loadFile, { style: 'margin-top:8px', check: blocked }) : null),
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}

// Загрузка: наша копия или файл программы Атама. Только владелец, со связью, без неотправленных записей.
const blocked = () => (!S.online ? 'Нужна связь с облаком' : pendingCount() ? 'Сначала дождитесь отправки всех записей' : '');
async function loadFile(f) {
  const why = blocked();
  if (why) { toast(why, true); return; }
  let data;
  try { data = JSON.parse(f.text); } catch (e) { toast('Файл не читается как JSON', true); return; }
  const kind = kindOf(data);
  if (kind === 'atam') { startAtamImport(data, f.name); return; }
  if (kind !== 'ours') { toast('Это не резервная копия «ALSI Sales CRM» и не файл программы Атама', true); return; }
  const s = sheet({ title: 'Загрузить копию', sub: f.name + ', от ' + String(data.exportedAt || '').slice(0, 10), full: true });
  let hideMissing = 'no';
  s.body.append(
    h('div', { class: 'group', style: 'margin:0' }, COLS.map((c) => h('div', { class: 'kv' }, h('span', {}, LABELS[c]),
      h('b', { class: 'num' }, (Array.isArray(data[c]) ? data[c].length : 0) + ' в файле, ' + all(c).length + ' сейчас')))),
    h('p', { class: 'hint', style: 'margin:12px 0' }, 'Записи из файла запишутся поверх тех же записей в базе. Новые записи из базы не пропадут.'),
    h('div', { class: 'q' }, 'Записи, которых нет в файле'),
    choices([['no', 'Оставить как есть'], ['yes', 'Скрыть (их можно вернуть)']], hideMissing, (v) => { hideMissing = v; }, { col: true }));
  s.showFoot(h('button', { class: 'btn red wide', onclick: async (e) => {
    if (!(await ask('Загрузить копию?', 'Записи в базе заменятся записями из файла.', 'Загрузить', true))) return;
    const btn = e.target;
    btn.disabled = true;
    const plan = restorePlan(data, S, { hideMissing: hideMissing === 'yes' });
    const list = [];
    for (const c of COLS) {
      for (const [id, doc] of plan.write[c]) list.push({ col: c, id, data: doc });
      for (const id of plan.hide[c]) list.push({ col: c, id, data: { deleted: true, deletedAt: new Date().toISOString(), deletedBy: S.email }, merge: true });
    }
    try {
      await writeMany(list, (done, total) => { btn.textContent = 'Записано ' + done + ' из ' + total; });
      toast('Копия загружена: ' + list.length + ' записей');
      s.close();
    } catch (err) { toast('Загрузка прервалась: ' + (err.code || 'нет связи') + '. Повторите: записанное не задвоится', true); btn.disabled = false; }
  } }, 'Загрузить'));
}
