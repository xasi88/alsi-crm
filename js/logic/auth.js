// Вход по почте и паролю: проверка полей, понятные сообщения, текст приглашения.
// Без облака: под тестами (tests/auth.test.mjs).

export const APP_NAME = 'ALSI Sales CRM';
export const APP_URL = 'https://xasi88.github.io/alsi-crm/';
export const PASS_MIN = 8;

export const normEmail = (s) => String(s || '').trim().toLowerCase();
export const validEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail(s));

// Пустая строка: всё верно. Иначе текст ошибки для человека.
export function emailProblem(email) {
  if (!normEmail(email)) return 'Введите почту';
  return validEmail(email) ? '' : 'Почта выглядит неверно. Пример: name@mail.ru';
}

export function passProblem(pass, again) {
  const p = String(pass || '');
  if (!p) return 'Введите пароль';
  if (again === undefined) return '';
  if (p.length < PASS_MIN) return 'Пароль короткий: нужно не меньше ' + PASS_MIN + ' знаков';
  if (p !== String(again || '')) return 'Пароли не совпадают. Введите ещё раз';
  return '';
}

const WRONG = 'Почта или пароль не подходят. Первый раз? Нажмите «Первый вход»';
const TEXTS = {
  'auth/invalid-email': 'Почта выглядит неверно. Пример: name@mail.ru',
  'auth/missing-email': 'Введите почту',
  'auth/missing-password': 'Введите пароль',
  'auth/invalid-credential': WRONG,
  'auth/invalid-login-credentials': WRONG,
  'auth/wrong-password': WRONG,
  'auth/user-not-found': WRONG,
  'auth/email-already-in-use': 'Для этой почты пароль уже есть. Нажмите «Войти» или «Забыли пароль?»',
  'auth/weak-password': 'Пароль слишком простой: нужно не меньше ' + PASS_MIN + ' знаков',
  'auth/password-does-not-meet-requirements': 'Пароль слишком простой: нужно не меньше ' + PASS_MIN + ' знаков',
  'auth/too-many-requests': 'Слишком много попыток. Подождите несколько минут и повторите',
  'auth/network-request-failed': 'Нет связи. Проверьте интернет и повторите',
  'auth/user-disabled': 'Вход для этой почты закрыт. Спросите админа',
  'auth/account-exists-with-different-credential': 'Эта почта входит по паролю. Войдите почтой и паролем',
  'auth/operation-not-allowed': 'Вход по паролю пока не включён. Сообщите админу',
  'auth/unauthorized-continue-uri': 'Письмо не ушло: адрес приложения не разрешён. Сообщите админу',
};

export const authText = (e) => TEXTS[(e && e.code) || e] || 'Не получилось. Проверьте связь и повторите';

// Как человек входит: по паролю, через Google или обоими способами
export function signInWays(providerIds = []) {
  return { password: providerIds.includes('password'), google: providerIds.includes('google.com') };
}

// Текст, который админ отправит новому человеку (WhatsApp, Telegram)
export function inviteText({ name = '', email = '' } = {}) {
  const mail = normEmail(email);
  const gmail = /@(gmail|googlemail)\.com$/.test(mail);
  return [
    'Ассаляму алейкум' + (name ? ', ' + String(name).trim() : '') + '! Вас добавили в ' + APP_NAME + '.',
    '1. Откройте ссылку: ' + APP_URL,
    '2. Нажмите «Первый вход: придумать пароль».',
    '3. Введите почту ' + mail + ' и придумайте пароль не короче ' + PASS_MIN + ' знаков.',
    '4. Откройте письмо от ' + APP_NAME + ' и нажмите ссылку в нём. Письмо может лежать в «Спаме».',
    '5. Вернитесь в приложение и нажмите «Я подтвердил».',
    gmail ? 'У вас Gmail: можно не придумывать пароль, а просто нажать «Войти через Google».' : null,
  ].filter(Boolean).join('\n');
}
