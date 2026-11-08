// Фото товаров: своё фото владельца (поле photo в товаре) или фото упаковки производителя из img/products.
// Таблицу FILES собирает tools/foto.py из docs/foto-tovarov.json. Руками не править.
import { norm } from './format.js?v=d38d063e';
import { sameName } from './atam.js?v=d38d063e';

const FILES = {
};

const key = (n) => norm(sameName(n));
const MAP = new Map(Object.entries(FILES).map(([n, f]) => [key(n), f]));

export const picOf = (p) => p?.photo || MAP.get(key(p?.name)) || '';
