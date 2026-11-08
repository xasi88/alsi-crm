// Фото товаров: своё фото владельца (поле photo в товаре) или фото упаковки производителя из img/products.
// Таблицу FILES собирает tools/foto.py из docs/foto-tovarov.json. Руками не править.
import { norm } from './format.js?v=895b33d7';
import { sameName } from './atam.js?v=895b33d7';

const FILES = {
  "Alsi Cola": "img/products/alsi-cola.webp",
  "Alsi Cola Zero": "img/products/alsi-cola-zero.webp",
  "BUCHERON FILLING шоколад с начинкой «Миланская карамель»": "img/products/bucheron-filling-milanskaya-karamel-85.webp",
  "BUCHERON FILLING шоколад с начинкой малина-молоко": "img/products/bucheron-filling-malina-moloko-85.webp",
  "BUCHERON VILLAGE горький шоколад с клюквой, клубникой и фисташками": "img/products/bucheron-village-gorkiy-klyukva-klubnika-fistashki-85.webp",
  "BUCHERON VILLAGE молочный шоколад с кусочками малины в картоне": "img/products/bucheron-village-moloko-malina-85.webp",
  "Code Red Coffee": "img/products/code-red-coffee.webp",
  "Code Red Mojito": "img/products/code-red-mojito.webp",
  "Code Red Zero": "img/products/code-red-zero.webp",
  "Code Red ж/б": "img/products/code-red-banka.webp",
  "Code Red стекло": "img/products/code-red-steklo.webp",
  "Crunchips X-Cut сметана и специи": "img/products/crunchips-xcut-smetana-130.webp",
  "Crunchips X-Cut сметана и специи": "img/products/crunchips-xcut-smetana-70.webp",
  "FIFA Apple": "img/products/fifa-apple.webp",
  "FIFA Citrus": "img/products/fifa-citrus.webp",
  "FIFA Fruity": "img/products/fifa-fruity.webp",
  "FIFA Orange": "img/products/fifa-orange.webp",
  "FIFA Pomegranate": "img/products/fifa-pomegranate.webp",
  "Leemo-1": "img/products/leemo-1.webp",
  "Naturals классические с солью": "img/products/naturals-klassika.webp",
  "Naturals с белыми грибами": "img/products/naturals-belye-grib.webp",
  "Naturals с морской солью и перцем": "img/products/naturals-morskaya-sol-perets.webp",
  "Naturals с паприкой": "img/products/naturals-paprika.webp",
  "Naturals с пармезаном": "img/products/naturals-parmezan.webp",
  "Naturals с розмарином": "img/products/naturals-rozmarin.webp",
  "Naturals с чесноком и зеленью": "img/products/naturals-chesnok-zelen.webp",
  "Naturals со вкусом соуса песто": "img/products/naturals-pesto.webp",
  "Nerv Cactus": "img/products/nerv-cactus.webp",
  "Pomsticks с паприкой": "img/products/pomsticks-paprika-100.webp",
  "Pomsticks с солью": "img/products/pomsticks-sol-100.webp",
  "Pomsticks с солью, большой формат": "img/products/pomsticks-sol-200.webp",
  "Pomsticks с солью, мини-формат": "img/products/pomsticks-sol-38.webp",
  "Pomsticks сметана и специи": "img/products/pomsticks-smetana-100.webp",
  "Pomsticks сметана и специи": "img/products/pomsticks-smetana-70.webp",
  "Pomsticks сметана и специи, большой формат": "img/products/pomsticks-smetana-200.webp",
  "Pomsticks сметана и специи, мини-формат": "img/products/pomsticks-smetana-38.webp",
  "Pomsticks сыр и лук": "img/products/pomsticks-syr-luk-100.webp",
  "Saltletts «Чипс-крендель» ЛЕНТА с розмарином": "img/products/saltletts-chips-krendel-rozmarin-70-lenta.webp",
  "Saltletts «Чипс-крендель» ЛЕНТА с чесноком и зеленью": "img/products/saltletts-chips-krendel-chesnok-70-lenta.webp",
  "Saltletts «Чипс-крендель» с розмарином": "img/products/saltletts-chips-krendel-rozmarin-70.webp",
  "Saltletts «Чипс-крендель» с чесноком и зеленью": "img/products/saltletts-chips-krendel-chesnok-70.webp",
  "Saltletts мини-крендели ЛЕНТА с солью": "img/products/saltletts-mini-krendeli-60-lenta.webp",
  "Saltletts мини-крендели с солью": "img/products/saltletts-mini-krendeli-250.webp",
  "Saltletts мини-крендели с солью": "img/products/saltletts-mini-krendeli-60.webp",
  "Saltletts мини-палочки солёные": "img/products/saltletts-mini-palochki-70.webp",
  "Saltletts палочки с кунжутом": "img/products/saltletts-palochki-sezam-60.webp",
  "Saltletts палочки с кунжутом, ЛЕНТА": "img/products/saltletts-palochki-sezam-60-lenta.webp",
  "Saltletts палочки солёные классические": "img/products/saltletts-palochki-250.webp",
  "Saltletts палочки солёные классические": "img/products/saltletts-palochki-75.webp",
  "Saltletts палочки солёные классические в коррексе": "img/products/saltletts-palochki-korreks-150.webp",
  "Saltletts палочки солёные классические, ЛЕНТА": "img/products/saltletts-palochki-75-lenta.webp",
};

const key = (n) => norm(sameName(n));
const MAP = new Map(Object.entries(FILES).map(([n, f]) => [key(n), f]));

export const picOf = (p) => p?.photo || MAP.get(key(p?.name)) || '';
