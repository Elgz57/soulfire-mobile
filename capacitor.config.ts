import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.soulfiremc.soulfire.mobile",
  appName: "SoulFire",
  webDir: "dist",
  android: {
    // SoulFire servers are self-hosted and very often reachable only over
    // plain HTTP on a LAN address, or behind a self-signed certificate.
    // Android blocks cleartext traffic by default, which would make the app
    // unusable for most self-hosters, so we allow it deliberately. The
    // connect screen warns when the entered address is not HTTPS.
    allowMixedContent: true,
  },
  server: {
    // gRPC-Web needs a real origin the SoulFire server will accept. The
    // server runs CorsService.builderForAnyOrigin(), so an https scheme
    // origin works without any server-side change, and keeps the WebView in
    // a secure context (required for crypto.subtle and streaming fetch).
    androidScheme: "https",
    iosScheme: "capacitor",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      // Darker stop of the logo's background gradient, so the splash matches
      // the generated splash images in android/app/src/main/res.
      backgroundColor: "#1c1e2a",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    Keyboard: {
      // iOS only — the plugin ignores `resize` on Android. Pinned rather than
      // left to the default because src/lib/mobile.ts depends on it: `native`
      // resizes the WebView, so the visual viewport shrinks and iOS needs no
      // manual --keyboard-height offset. Changing this breaks that assumption.
      //
      // Android deliberately does NOT set `resizeOnFullScreen`. Enabling it
      // would resize the WebView there too, which would then double-count
      // against the --keyboard-height offset the same UI relies on.
      resize: "native",
    },
  },
};

export default config;
