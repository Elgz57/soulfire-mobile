import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/mobile.ts";

/**
 * Preferences mirrored into durable native storage.
 *
 * Deliberately excludes the auth keys (`server-type`, `server-address`,
 * `server-token`, `server-webdav-token`).
 *
 * They used to be here, as insurance against Android evicting the WebView's
 * `localStorage`. That was speculative — the eviction was never observed — and
 * it created a worse bug than the one it guarded against: `logOut()` removes
 * the keys synchronously from `localStorage` but the matching
 * `Preferences.remove` is async, so an app killed straight after signing out
 * left the credentials in native storage, and the next launch copied them back.
 * The user was signed in again with a dead token, redirected past the connect
 * screen, and left staring at a loading dashboard with no way back.
 *
 * Login already survives restarts without this: WebView `localStorage` is
 * persistent storage, not cache. Only cosmetic preferences are mirrored now,
 * where a stale value is harmless.
 */
const MIRRORED_KEYS = ["theme", "terminal-theme", "i18nextLng"] as const;

const mirroredKeySet = new Set<string>(MIRRORED_KEYS);

/**
 * Copies mirrored values from native storage into `localStorage`.
 *
 * Must be awaited before anything reads auth state (`isAuthenticated()`) or
 * the app will render its logged-out state for a logged-in user.
 */
/**
 * Upper bound on how long boot may wait for native storage.
 *
 * This runs behind a top-level await, so anything that leaves it pending
 * leaves the user staring at a blank screen with no error and no way forward.
 * Reading a handful of preferences is sub-millisecond work; if the bridge is
 * not answering in a second it is not going to, and rendering signed-out is a
 * far better outcome than never rendering at all.
 */
const HYDRATE_TIMEOUT_MS = 1000;

export async function hydrateNativeStorage(): Promise<void> {
  if (!isNativeApp()) {
    return;
  }

  const read = Promise.all(
    MIRRORED_KEYS.map(async (key) => {
      try {
        const { value } = await Preferences.get({ key });
        // localStorage wins when both exist: it is the copy the running app
        // has been mutating, and a mirror write may still be in flight.
        if (value !== null && localStorage.getItem(key) === null) {
          localStorage.setItem(key, value);
        }
      } catch {
        // A single unreadable key must not prevent the app from starting.
      }
    }),
  );

  await Promise.race([
    read,
    new Promise<void>((resolve) => {
      setTimeout(resolve, HYDRATE_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Wraps `localStorage.setItem`/`removeItem`/`clear` so writes to mirrored keys
 * are also persisted natively.
 *
 * Patching the global is deliberate: it keeps every upstream call site
 * (`web-rpc.ts`, the theme provider, i18next's language detector) byte-identical
 * to the desktop client, which is the whole point of this fork. The patch is
 * installed only in the native shell and only acts on `MIRRORED_KEYS`.
 */
export function installNativeStorageMirror(): void {
  if (!isNativeApp()) {
    return;
  }

  const proto = Object.getPrototypeOf(localStorage) as Storage;
  const originalSetItem = proto.setItem.bind(localStorage);
  const originalRemoveItem = proto.removeItem.bind(localStorage);
  const originalClear = proto.clear.bind(localStorage);

  localStorage.setItem = (key: string, value: string) => {
    originalSetItem(key, value);
    if (mirroredKeySet.has(key)) {
      void Preferences.set({ key, value }).catch(() => {
        // Mirror is best-effort; localStorage already holds the value.
      });
    }
  };

  localStorage.removeItem = (key: string) => {
    originalRemoveItem(key);
    if (mirroredKeySet.has(key)) {
      void Preferences.remove({ key }).catch(() => {});
    }
  };

  localStorage.clear = () => {
    originalClear();
    void Preferences.clear().catch(() => {});
  };
}
