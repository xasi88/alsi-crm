// Резервная копия «ATAM SALES CRM»: все записи, которые видит человек, одним файлом JSON.
// Загрузка копии: записи из файла пишутся поверх тех же записей. Записи, которых нет в файле,
// по выбору владельца скрываются (не стираются): их можно вернуть.

export const APP = 'alsi-prodazhi';
export const COLS = ['team', 'products', 'shops', 'visits', 'orders', 'returns', 'payments', 'plans', 'config'];
export const LABELS = { team: 'Люди', products: 'Товары', shops: 'Точки', visits: 'Визиты', orders: 'Заказы', returns: 'Возвраты',
  payments: 'Оплаты', plans: 'Планы', config: 'Настройки' };

export function buildBackup(S, by, now = new Date().toISOString()) {
  const out = { app: APP, version: 1, exportedAt: now, by };
  for (const c of COLS) out[c] = (S[c] || []).map((x) => ({ ...x }));
  out.counts = Object.fromEntries(COLS.map((c) => [c, out[c].length]));
  return out;
}

// Какой это файл: наша копия, копия программы Атама или чужой
export function kindOf(data) {
  if (!data || typeof data !== 'object') return '';
  if (data.app === APP) return 'ours';
  if (Array.isArray(data.shops) && Array.isArray(data.orders) && (data._workspaceBackup || data.profile || 'version' in data)) return 'atam';
  return '';
}

// План загрузки нашей копии: что записать и что скрыть
export function restorePlan(data, current, { hideMissing = false } = {}) {
  const write = {};
  const hide = {};
  for (const c of COLS) {
    const list = Array.isArray(data[c]) ? data[c].filter((x) => x && typeof x.id === 'string' && x.id) : [];
    write[c] = list.map((x) => {
      const { id, ...rest } = x;
      return [id, rest];
    });
    if (hideMissing && !['team', 'config', 'plans'].includes(c)) {
      const keep = new Set(list.map((x) => x.id));
      hide[c] = (current[c] || []).filter((x) => !x.deleted && !keep.has(x.id)).map((x) => x.id);
    } else hide[c] = [];
  }
  return { write, hide };
}

export const fileName = (today) => 'alsi-prodazhi-kopiya-' + today + '.json';
