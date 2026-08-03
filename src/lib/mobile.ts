import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";

/**
 * True when running inside the Capacitor native shell (Android/iOS) rather
 * than a plain browser. Distinct from `useIsMobile()`, which only reports the
 * viewport width and is also true for a narrow desktop browser window.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform(): "android" | "ios" | "web" {
  const platform = Capacitor.getPlatform();
  if (platform === "android" || platform === "ios") {
    return platform;
  }
  return "web";
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * The status bar text/icon colour is set by the OS, not by CSS, so it has to
 * be kept in sync with the app theme manually. `Style.Dark` means "light text
 * on a dark background", which is what we want while the dark theme is active.
 */
async function syncStatusBarToTheme(): Promise<void> {
  try {
    await StatusBar.setStyle({
      style: isDarkTheme() ? StatusBarStyle.Dark : StatusBarStyle.Light,
    });
  } catch {
    // Not fatal: some Android skins and the iOS simulator reject style
    // changes. The app is fully usable with the default status bar.
  }
}

function watchThemeChanges(): void {
  const observer = new MutationObserver(() => {
    void syncStatusBarToTheme();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

/**
 * Publishes the software keyboard height as `--keyboard-height` so that
 * fixed-position UI (the script editor's quick-add panel) can lift above it.
 *
 * Android only, deliberately. The keyboard plugin resizes the Android WebView
 * only when `resizeOnFullScreen` is enabled, and Capacitor 8 draws
 * edge-to-edge — which counts as full screen — so by default the keyboard
 * simply covers the WebView: the viewport keeps its full height, `dvh` does
 * not shrink, and anything pinned to the bottom needs lifting by hand.
 *
 * iOS behaves the opposite way. `Keyboard.resize` defaults to `native` (and
 * capacitor.config.ts pins it) which resizes the WebView itself, so the
 * visual viewport already shrinks and `bottom` is already measured above the
 * keyboard. Publishing a height there too would lift that UI a second time,
 * by a full keyboard, pushing it into the middle of the screen. Leaving the
 * variable at its 0px default keeps iOS correct.
 *
 * If `Keyboard.resize` is ever changed away from `native`/`body` on iOS, this
 * assumption has to be revisited.
 */
function watchKeyboard(): void {
  if (getNativePlatform() !== "android") {
    return;
  }

  const setHeight = (height: number) => {
    document.documentElement.style.setProperty(
      "--keyboard-height",
      `${height}px`,
    );
  };

  void Keyboard.addListener("keyboardWillShow", (info) => {
    setHeight(info.keyboardHeight);
  });
  void Keyboard.addListener("keyboardWillHide", () => {
    setHeight(0);
  });
}

/**
 * Maps the Android hardware/gesture back button onto browser history so it
 * behaves like the in-app back navigation. Without this, back closes the app
 * from any screen, which is a guaranteed Play Store review complaint.
 */
function wireBackButton(): void {
  void CapacitorApp.addListener("backButton", ({ canGoBack }) => {
    // An open Radix/vaul overlay traps focus and should absorb the back press
    // rather than navigating the router underneath it.
    const openOverlay = document.querySelector(
      "[data-state='open'][role='dialog'], [data-vaul-drawer][data-state='open']",
    );
    if (openOverlay !== null) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return;
    }

    if (canGoBack) {
      window.history.back();
    } else {
      void CapacitorApp.exitApp();
    }
  });
}

/**
 * Initialises everything that only applies to the native shell. Safe to call
 * on the web, where it is a no-op.
 */
export async function initMobile(): Promise<void> {
  if (!isNativeApp()) {
    return;
  }

  // Lets CSS target the native shell for safe-area padding without having to
  // thread a React context through every layout.
  document.documentElement.classList.add("native-app");
  document.documentElement.classList.add(`native-${getNativePlatform()}`);

  wireBackButton();
  watchKeyboard();
  watchThemeChanges();
  await syncStatusBarToTheme();

  // Deliberately no setOverlaysWebView() call. Capacitor 8 already manages
  // edge-to-edge on Android and reports the resulting insets to CSS via its
  // SystemBars plugin; forcing overlay mode here pushed content under the
  // status bar while adding nothing the framework does not already do.

  try {
    await SplashScreen.hide();
  } catch {
    // Splash screen may already be hidden.
  }
}
