// Связь с облаком Firebase (проект alsi-crm, база во Франкфурте).
// Настройки веб-приложения Firebase не секрет: доступ решают правила базы (firestore.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, reload,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, updateDoc, getDoc, onSnapshot, query, where, writeBatch,
  terminate, clearIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyDfd4G1IEFFf9UQu4HcKuQ-ssnePIYo1sQ',
  authDomain: 'alsi-crm.firebaseapp.com',
  projectId: 'alsi-crm',
  storageBucket: 'alsi-crm.firebasestorage.app',
  messagingSenderId: '820928024080',
  appId: '1:820928024080:web:f87bf9dbbc2236c763c495',
});

export const auth = getAuth(app);
auth.languageCode = 'ru';

// Запись сначала ложится в базу на телефоне, потом уходит в облако сама.
// Без связи запись не теряется и после перезапуска приложения.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = e && e.code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment'
      || code === 'auth/web-storage-unsupported') {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    throw e;
  }
}

// Вход по почте и паролю (как у Атама). Пароль придумывает сам человек при первом входе,
// почту подтверждает письмом. Без подтверждения правила базы ничего не покажут.
const back = () => ({ url: location.origin + location.pathname });

export const loginPass = (email, pass) => signInWithEmailAndPassword(auth, email, pass);

export async function signupPass(email, pass) {
  const c = await createUserWithEmailAndPassword(auth, email, pass);
  await sendEmailVerification(c.user, back());
  return c.user;
}

export const resendVerify = () => sendEmailVerification(auth.currentUser, back());
export const resetPass = (email) => sendPasswordResetEmail(auth, email, back());

// Человек нажал ссылку в письме: обновляем данные входа и пропуск для базы
export async function checkVerified() {
  const u = auth.currentUser;
  if (!u) return false;
  await reload(u);
  if (u.emailVerified) await u.getIdToken(true);
  return u.emailVerified;
}

export const providers = () => (auth.currentUser?.providerData || []).map((p) => p.providerId);

export function onUser(fn) {
  getRedirectResult(auth).catch(() => {});
  return onAuthStateChanged(auth, fn);
}

export const logout = () => signOut(auth);

// Выход без неотправленных записей: стираем копию базы на телефоне,
// чтобы следующий человек на этом телефоне не увидел чужих записей.
export async function logoutClean() {
  await signOut(auth);
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch (e) { /* копия занята другой вкладкой */ }
  location.reload();
}

export const newId = (col) => doc(collection(db, col)).id;

export { collection, doc, setDoc, updateDoc, getDoc, onSnapshot, query, where, writeBatch };
