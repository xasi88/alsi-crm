// Данные приложения: подписка на облако, роль, взгляд руководителя.
// Запись не ждёт облака: она сразу видна на экране, а в облако уходит сама, когда есть связь (save.js).
import { db, collection, doc, setDoc, getDoc, onSnapshot, query, where } from './fb.js?v=69f8b533';

const WORK = ['shops', 'visits', 'orders', 'payments', 'returns'];
const SHARED = ['team', 'products', 'plans', 'config'];

export const S = {
  user: null, email: '', me: null, role: '', lead: false, owner: false, sup: false, denied: false, ready: false,
  shops: [], visits: [], orders: [], payments: [], returns: [], products: [], team: [], plans: [], config: [],
  pending: {}, loaded: {}, online: navigator.onLine, scope: '',
};

const subs = new Set();
let raf = 0;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function emit() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; subs.forEach((f) => f()); });
}
addEventListener('online', () => { S.online = true; emit(); });
addEventListener('offline', () => { S.online = false; emit(); });

export const pendingCount = () => Object.values(S.pending).reduce((a, b) => a + b, 0);

// Взгляд руководителя: вся команда ('') или один человек. Хранится на телефоне.
const scopeKey = () => 'alsi-scope-' + S.email;
export function setScope(email) {
  S.scope = email || '';
  try { localStorage.setItem(scopeKey(), S.scope); } catch (e) { /* без памяти */ }
  emit();
}
// Записи в текущем взгляде (без скрытых)
export function view(name) {
  const list = S[name] || [];
  return list.filter((x) => !x.deleted && (!S.scope || x.rep === S.scope));
}
export const all = (name) => (S[name] || []).filter((x) => !x.deleted);
// Править запись может владелец и сам торговый. Супервайзер записи своих людей только читает.
export const canEdit = (x) => !!x && (S.owner || x.rep === S.email);

const unsubs = [];
const parts = {};
function listen(name, q, part = 'all') {
  unsubs.push(onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    parts[name] = parts[name] || {};
    parts[name][part] = snap.docs.map((d) => ({ ...d.data(), id: d.id, _wait: d.metadata.hasPendingWrites }));
    const merged = new Map();
    for (const list of Object.values(parts[name])) for (const x of list) merged.set(x.id, x);
    S[name] = [...merged.values()];
    S.pending[name] = S[name].filter((x) => x._wait).length;
    S.loaded[name] = true;
    emit();
  }, (e) => { console.warn('ALSI', name, part, e.code); S.loaded[name] = true; emit(); }));
}

const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
const now = () => new Date().toISOString();

// Вход: роль из списка команды. Первый вход владельца сам записывает его в команду
// (правила базы разрешают это только почте владельца).
export async function start(user) {
  S.user = user;
  S.email = String(user.email || '').toLowerCase();
  let me = null;
  try {
    const snap = await getDoc(doc(db, 'team', S.email));
    if (snap.exists()) me = snap.data();
  } catch (e) { /* нет связи и нет копии: ниже попробуем записать */ }
  if (!me && navigator.onLine) {
    const data = { role: 'owner', name: user.displayName || S.email, active: true, lead: '', at: now() };
    try { await timeout(setDoc(doc(db, 'team', S.email), data), 15000); me = data; } catch (e) { /* не владелец */ }
  }
  if (!me || me.active === false) { S.denied = true; S.ready = true; emit(); return; }
  S.me = me;
  S.role = me.role;
  S.owner = me.role === 'owner';
  S.sup = me.role === 'supervisor';
  S.lead = S.owner || S.sup;
  try { S.scope = S.lead ? localStorage.getItem(scopeKey()) || '' : ''; } catch (e) { S.scope = ''; }
  for (const name of SHARED) listen(name, collection(db, name));
  for (const name of WORK) {
    const col = collection(db, name);
    if (S.owner) listen(name, col);
    else {
      listen(name, query(col, where('rep', '==', S.email)), 'mine');
      if (S.sup) listen(name, query(col, where('lead', '==', S.email)), 'team');
    }
  }
  S.ready = true;
  emit();
}

export function stop() {
  while (unsubs.length) unsubs.pop()();
  for (const k of Object.keys(parts)) delete parts[k];
  Object.assign(S, { user: null, email: '', me: null, role: '', lead: false, owner: false, sup: false, denied: false, ready: false,
    shops: [], visits: [], orders: [], payments: [], returns: [], products: [], team: [], plans: [], config: [],
    pending: {}, loaded: {}, scope: '' });
  emit();
}

export const shopById = (id) => S.shops.find((s) => s.id === id);
export const orderById = (id) => S.orders.find((o) => o.id === id);
export const memberName = (email) => S.team.find((m) => m.id === email)?.name || email || 'Без владельца';
export const member = (email) => S.team.find((m) => m.id === email);
export const planOf = (month, rep) => S.plans.find((p) => p.id === month + '__' + rep)?.packs || 0;
export const config = (id) => S.config.find((c) => c.id === id) || null;
// Люди, которых видит руководитель: владелец всех, супервайзер себя и своих торговых
export function people() {
  const list = S.team.filter((m) => m.active !== false);
  const mine = S.owner ? list : list.filter((m) => m.id === S.email || m.lead === S.email);
  return mine.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'ru'));
}
