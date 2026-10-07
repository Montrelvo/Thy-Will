export const FIREBASE_WEB_SDK_VERSION = '12.19.0';

export interface FirebaseBrowserConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export type FirebaseEnvironment = Readonly<Record<string, string | boolean | undefined>>;

export type FirebaseIdentityState =
  | { status: 'unconfigured'; uid: null }
  | { status: 'signed-in'; uid: string }
  | { status: 'error'; uid: null; message: string };

interface FirebaseUser { uid: string }
interface FirebaseAuth {}
interface FirebaseApp {}

interface FirebaseAppModule {
  initializeApp(config: FirebaseBrowserConfig): FirebaseApp;
}
interface FirebaseAuthModule {
  browserLocalPersistence: unknown;
  getAuth(app: FirebaseApp): FirebaseAuth;
  setPersistence(auth: FirebaseAuth, persistence: unknown): Promise<void>;
  signInAnonymously(auth: FirebaseAuth): Promise<{ user: FirebaseUser }>;
  onAuthStateChanged(
    auth: FirebaseAuth,
    next: (user: FirebaseUser | null) => void,
    error: (error: unknown) => void,
  ): () => void;
  connectAuthEmulator(auth: FirebaseAuth, url: string, options?: { disableWarnings: boolean }): void;
}

const required = (env: FirebaseEnvironment, key: string): string | null => {
  const value = env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export function readFirebaseConfiguration(env: FirebaseEnvironment): FirebaseBrowserConfig | null {
  const apiKey = required(env, 'VITE_FIREBASE_API_KEY');
  const authDomain = required(env, 'VITE_FIREBASE_AUTH_DOMAIN');
  const projectId = required(env, 'VITE_FIREBASE_PROJECT_ID');
  const appId = required(env, 'VITE_FIREBASE_APP_ID');
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}

const moduleUrl = (service: 'app' | 'auth') =>
  `https://www.gstatic.com/firebasejs/${FIREBASE_WEB_SDK_VERSION}/firebase-${service}.js`;

async function loadModule<T>(url: string): Promise<T> {
  return await import(/* @vite-ignore */ url) as T;
}

async function initialUser(auth: FirebaseAuth, module: FirebaseAuthModule): Promise<FirebaseUser | null> {
  return await new Promise<FirebaseUser | null>((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = module.onAuthStateChanged(auth, user => {
      unsubscribe();
      resolve(user);
    }, error => {
      unsubscribe();
      reject(error);
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Firebase authentication failed';
}

export async function establishFirebaseIdentity(
  env: FirebaseEnvironment = import.meta.env as FirebaseEnvironment,
): Promise<FirebaseIdentityState> {
  const config = readFirebaseConfiguration(env);
  if (!config) return { status: 'unconfigured', uid: null };

  try {
    const [appModule, authModule] = await Promise.all([
      loadModule<FirebaseAppModule>(moduleUrl('app')),
      loadModule<FirebaseAuthModule>(moduleUrl('auth')),
    ]);
    const app = appModule.initializeApp(config);
    const auth = authModule.getAuth(app);
    if (env['VITE_FIREBASE_USE_EMULATORS'] === 'true') {
      const host = required(env, 'VITE_FIREBASE_AUTH_EMULATOR_URL') ?? 'http://127.0.0.1:9099';
      authModule.connectAuthEmulator(auth, host, { disableWarnings: true });
    }
    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    const restored = await initialUser(auth, authModule);
    if (restored) return { status: 'signed-in', uid: restored.uid };
    const credential = await authModule.signInAnonymously(auth);
    return { status: 'signed-in', uid: credential.user.uid };
  } catch (error) {
    return { status: 'error', uid: null, message: errorMessage(error) };
  }
}
