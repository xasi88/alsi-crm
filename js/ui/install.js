// Значок на экран телефона. Android и компьютер: окно установки браузера. iPhone: подсказка «Поделиться».
// Приложение со значка открывается на весь экран и без интернета. После установки карточка пропадает.
import { h, toast } from './kit.js?v=2f681d03';

let ev = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ev = e; });

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function installCard(redraw) {
  if (standalone()) return null;
  const box = (...kids) => h('div', { class: 'pad' }, h('div', { class: 'group', style: 'margin:0;padding:12px 16px' },
    h('b', {}, 'Значок на экран телефона'), h('p', { class: 'hint', style: 'margin:4px 0 0' }, 'Приложение откроется со значка, как обычное, и без интернета.'), ...kids));
  if (ev) {
    return box(h('button', { class: 'btn navy wide', style: 'margin-top:10px', onclick: async () => {
      const e = ev;
      ev = null;
      e.prompt();
      const r = await e.userChoice.catch(() => ({ outcome: '' }));
      toast(r.outcome === 'accepted' ? 'Значок поставлен' : 'Значок можно поставить позже');
      redraw();
    } }, 'Поставить значок'));
  }
  if (iphone()) return box(h('p', { class: 'hint', style: 'margin:8px 0 0' }, 'Откройте приложение в Safari, нажмите «Поделиться», потом «На экран «Домой»».'));
  return box(h('p', { class: 'hint', style: 'margin:8px 0 0' }, 'В меню браузера (три точки) выберите «Установить приложение» или «Добавить на главный экран».'));
}
