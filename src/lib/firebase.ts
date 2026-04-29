import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// Puxa as chaves de segurança do arquivo .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicia o Firebase garantindo que não vai duplicar a conexão no Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Serviços
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

/**
 * analytics — inicializado APENAS no browser.
 * - `typeof window !== "undefined"` → impede execução no servidor (SSR/build).
 * - `isSupported()` → garante que o browser não seja bloqueado por ad-blockers
 *   ou ambientes que não suportem o SDK (ex: iframe sandboxed).
 * Use sempre como: `const a = await analytics; if (a) logEvent(a, ...)`
 */
let analytics: Promise<Analytics | null>;
if (typeof window !== "undefined") {
  analytics = isSupported().then((ok) => (ok ? getAnalytics(app) : null));
} else {
  analytics = Promise.resolve(null);
}

export { app, db, storage, auth, analytics };