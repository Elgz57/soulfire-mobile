import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/mobile.ts";

/**
 * Keys that must survive the WebView's storage being cleared.
 *
 * A WebView's `localStorage` lives in the app's cache-adjacent web data, which
 * Android may evict and which some OEM "clear cache" flows wipe outright. That
 * would silently sign the user out and lose their server address. Capacitor's
 * Preferences plugin writes to SharedPreferences (Android) / UserDefaults
 * (iOS), which is durable and included in device backups.
 *
 * The values are mirrored rather than moved: the rest of the app keeps reading
 * `localStorage` synchronously, exactly like upstream, so no route loader has
 * to become async.
 */
const MIRRORED_KEYS = [
  "server-type",
  "server-address",
  "server-token",
  "server-webdav-token",
  "theme",
  "terminal-theme",
  "i18nextLng",
] as const;

const mirroredKeySet = new Set<string>(MIRRORED_KEYS);

/**
 * Copies mirrored values from native storage into `localStorage`.
 *
 * Must be awaited before anything reads auth state (`isAuthenticated()`) or
 * the app will render its logged-out state for a logged-in user.
 */
export async function hydrateNativeStorage(): Promise<void> {
  if (!isNativeApp()) {
    return;
  }

  await Promise.all(
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
