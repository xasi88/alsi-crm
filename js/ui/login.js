// Экраны входа: почта и пароль, первый вход, новый пароль, подтверждение почты, нет доступа.
// Войти может любой, но правила базы покажут данные только почте из «Команды» и только подтверждённой.
import { login, loginPass, signupPass, resetPass, resendVerify, checkVerified, logout } from '../fb.js?v=564a57de';
import { h, fill, field, inp } from './kit.js?v=564a57de';
import { emailProblem, passProblem, authText, normEmail, PASS_MIN } from '../logic/auth.js?v=564a57de';

let email = ''; // почта остаётся при переходе между экранами входа
let unwatch = () => {};

function shell(root, ...kids) {
  unwatch();
  unwatch = () => {};
  root.classList.remove('signed');
  fill(root, h('section', { class: 'login' }, h('div', { class: 'mark' }, 'ALSI'), ...kids));
  scrollTo(0, 0);
}

function note() {
  const el = h('p', { class: 'msg', role: 'alert' });
  el.say = (t, ok = false) => { el.textContent = t; el.classList.toggle('ok', ok); };
  return el;
}

// Кнопка ждёт облака: заблокирована, пока идёт запрос. Ошибка Firebase выходит понятным текстом
async function run(btn, msg, fn) {
  btn.disabled = true;
  msg.say('');
  try { await fn(); } catch (e) { msg.say(authText(e)); } finally { btn.disabled = false; }
}

const link = (text, onclick) => h('button', { class: 'link', type: 'button', onclick }, text);

function mailInput() {
  return inp({ type: 'email', name: 'email', inputmode: 'email', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false',
    placeholder: 'name@mail.ru', value: email, oninput: (e) => { email = e.target.value; } });
}

// Пароль с кнопкой «Показать»: на телефоне легко ошибиться буквой
function passField(label, auto) {
  const i = inp({ type: 'password', autocomplete: auto, autocapitalize: 'off', spellcheck: 'false' });
  const eye = h('button', { class: 'eye', type: 'button', 'aria-pressed': 'false', onclick: () => {
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    eye.textContent = show ? 'Скрыть' : 'Показать';
    eye.setAttribute('aria-pressed', String(show));
  } }, 'Показать');
  return { input: i, el: field(label, h('div', { class: 'pass' }, i, eye)) };
}

function form(onSubmit, ...kids) {
  return h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); onSubmit(); } }, ...kids);
}

export function loginScreen(root, mode = 'in') {
  if (mode === 'new') return firstScreen(root);
  if (mode === 'reset') return resetScreen(root);
  const msg = note();
  const pass = passField('Пароль', 'current-password');
  const go = h('button', { class: 'btn red wide', type: 'submit' }, 'Войти');
  const google = h('button', { class: 'btn white wide', type: 'button', onclick: () => run(google, msg, login) }, 'Войти через Google');
  shell(root, h('h1', {}, 'Sales CRM'),
    h('p', {}, 'День торгового: точки, визиты, заказы, возвраты и долги. Работает и без связи.'),
    form(() => {
      const bad = emailProblem(email) || passProblem(pass.input.value);
      if (bad) { msg.say(bad); return; }
      run(go, msg, () => loginPass(normEmail(email), pass.input.value));
    }, field('Почта', mailInput()), pass.el, msg, go),
    h('div', { class: 'links' },
      link('Первый вход: придумать пароль', () => loginScreen(root, 'new')),
      link('Забыли пароль?', () => loginScreen(root, 'reset'))),
    h('div', { class: 'or' }, 'или'),
    google,
    h('p', { class: 'note' }, 'Вход только для команды ALSI. Почту добавляет админ.'));
}

function firstScreen(root) {
  const msg = note();
  const p1 = passField('Придумайте пароль', 'new-password');
  const p2 = passField('Пароль ещё раз', 'new-password');
  const go = h('button', { class: 'btn red wide', type: 'submit' }, 'Создать пароль');
  shell(root, h('h1', {}, 'Первый вход'),
    h('p', {}, 'Введите почту, которую добавил админ, и придумайте пароль не короче ' + PASS_MIN + ' знаков. Потом на почту придёт письмо со ссылкой.'),
    form(() => {
      const bad = emailProblem(email) || passProblem(p1.input.value, p2.input.value);
      if (bad) { msg.say(bad); return; }
      run(go, msg, () => signupPass(normEmail(email), p1.input.value));
    }, field('Почта', mailInput()), p1.el, p2.el, msg, go),
    h('div', { class: 'links' }, link('Назад ко входу', () => loginScreen(root))));
}

function resetScreen(root) {
  const msg = note();
  const go = h('button', { class: 'btn red wide', type: 'submit' }, 'Прислать письмо');
  shell(root, h('h1', {}, 'Новый пароль'),
    h('p', {}, 'Введите почту. Придёт письмо со ссылкой, по ней вы зададите новый пароль.'),
    form(() => {
      const bad = emailProblem(email);
      if (bad) { msg.say(bad); return; }
      run(go, msg, async () => {
        await resetPass(normEmail(email));
        msg.say('Письмо отправлено на ' + normEmail(email) + '. Откройте его и задайте новый пароль. Письмо может лежать в «Спаме».', true);
      });
    }, field('Почта', mailInput()), msg, go),
    h('div', { class: 'links' }, link('Назад ко входу', () => loginScreen(root))));
}

// Пароль создан, почта не подтверждена. Человек вернулся из почты: проверяем сами
export function verifyScreen(root, user, onOk) {
  const msg = note();
  let done = false;
  const check = async (quiet) => {
    if (done) return;
    try {
      if (await checkVerified()) { done = true; unwatch(); onOk(); return; }
      if (!quiet) msg.say('Почта ещё не подтверждена. Откройте письмо и нажмите ссылку');
    } catch (e) { if (!quiet) msg.say(authText(e)); }
  };
  const ok = h('button', { class: 'btn red wide', type: 'button', onclick: () => run(ok, msg, () => check(false)) }, 'Я подтвердил');
  const again = h('button', { class: 'btn white wide', type: 'button', onclick: () => run(again, msg, async () => {
    await resendVerify();
    msg.say('Письмо отправлено ещё раз', true);
  }) }, 'Прислать письмо ещё раз');
  shell(root, h('h1', {}, 'Подтвердите почту'),
    h('p', {}, 'Мы отправили письмо на ', h('b', {}, user.email), '. Откройте его и нажмите ссылку. Письмо может лежать в «Спаме».'),
    h('p', {}, 'Потом вернитесь сюда и нажмите «Я подтвердил».'),
    msg, ok, again,
    h('div', { class: 'links' }, link('Выйти', () => logout())));
  const onVis = () => { if (document.visibilityState === 'visible') check(true); };
  document.addEventListener('visibilitychange', onVis);
  unwatch = () => document.removeEventListener('visibilitychange', onVis);
}

export function deniedScreen(root, mail) {
  shell(root, h('h1', {}, 'Нет доступа'),
    h('p', {}, 'Почты ', h('b', {}, mail), ' нет в команде. Попросите админа добавить её в разделе «Команда».'),
    h('button', { class: 'btn white wide', onclick: () => logout() }, 'Войти другой почтой'));
}

export function loadingScreen(root) {
  shell(root, h('h1', {}, 'Загрузка'));
}
