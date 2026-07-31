# soulfire-mobile

Android and iOS client for [SoulFire](https://github.com/soulfiremc-com/SoulFire).

This is the [SoulFireClient](https://github.com/soulfiremc-com/SoulFireClient) dashboard —
same React code, same design tokens, same screens — packaged as a native app with
[Capacitor](https://capacitorjs.com) instead of Electron. It connects to a SoulFire server
over gRPC-Web exactly like the desktop and web clients do.

It is a **hard fork**, not a submodule: `src/`, `locales/` and `public/` were copied from
upstream at client version `2.9.1`. Upstream changes have to be merged in by hand.

## Requirements

- Node 22+ and pnpm 10+
- **Android**: JDK 21 and the Android SDK (platform 36, build-tools 36)
- **iOS**: macOS with Xcode. Capacitor 8 uses Swift Package Manager, so CocoaPods is
  not required.

## Getting started

```bash
pnpm install
pnpm dev                # Vite dev server in a browser at :1420
```

To run on a device:

```bash
pnpm android            # build, sync, open Android Studio
pnpm android:apk        # build a debug APK directly
pnpm ios                # build, sync, open Xcode (macOS only)
```

The debug APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

`pnpm sync` rebuilds the web bundle and copies it into both native projects. Run it after
any change to `src/` before building natively — Capacitor ships the compiled bundle inside
the app, so native builds do not pick up source changes on their own.

### Icons and splash screens

`pnpm generate-assets` redraws `assets/` from `public/logo.svg` and expands them into every
Android density and iOS asset slot. The source images are recomposed from the logo's
gradient and flame path rather than rasterising the whole SVG, because that file draws its
own rounded tile which would show up as a square-inside-a-square under a launcher mask.

## Trying it without a server

The client's demo mode works here and needs no SoulFire server — useful for UI work and
for app store review, since a reviewer will not stand up a server. Set
`localStorage.demo-mode = "true"`, or pick **Demo server** on the connect screen.

## How this differs from the desktop client

| | Desktop (Electron) | Mobile (Capacitor) |
| --- | --- | --- |
| Server types | Integrated **and** dedicated | **Dedicated only** |
| Updates | electron-updater | App/Play Store |
| Tray, Discord RPC, Chromecast, mDNS | Yes | Removed (Node-only APIs) |
| Notifications | — | Not in v1, see below |

**No integrated server.** The desktop app can launch a SoulFire server locally as a child
process. That is impossible on Android and iOS — SoulFire is a Java 25 server and there is
no JVM on either platform — so the mobile app always connects to a server running
elsewhere.

**No push notifications in v1.** Every user runs their own SoulFire server, so there is no
central service that could hold FCM/APNs credentials and push to devices. Delivering
alerts would mean either background polling with local notifications or an Android
foreground service holding a live stream. Both are deliberately deferred; live updates work
normally while the app is open.

### Mobile-specific additions

Upstream is already responsive — the sidebar becomes a sheet under 768px and several routes
already branch on `useIsMobile()`. The changes here are the native layer:

- `src/lib/mobile.ts` — status bar theme sync, splash dismissal, keyboard height as a CSS
  variable, and Android hardware-back mapped onto router history (closing an open dialog
  first, rather than exiting the app)
- `src/lib/mobile-storage.ts` — mirrors auth and theme keys into native storage. A WebView's
  `localStorage` can be evicted by the OS, which would silently sign the user out; the
  mirror is hydrated before the app reads auth state. Values are mirrored rather than
  moved, so no route loader had to become async.
- `src/mobile.css` — safe-area insets, overscroll/pull-to-refresh suppression (a reload
  would drop every open gRPC stream), 44px touch targets, and a 16px input font on iOS to
  stop focus-zoom. All scoped to `html.native-app`.

  Insets read `var(--safe-area-inset-*)` first and fall back to
  `env(safe-area-inset-*)`. This matters: **Android never populates `env(safe-area-inset-*)`**.
  Capacitor 8's SystemBars plugin instead sets `--safe-area-inset-*` as inline styles on
  `<html>` from a `WindowInsets` listener (`insetsHandling: "css"`, its default). Reading
  only `env()` makes every inset silently resolve to 0 on Android, which is exactly how the
  status bar ended up overlapping the sidebar. Note also that the mobile sidebar is a Sheet
  that overrides `data-slot` to `"sidebar"`, so it needs its own selector rather than being
  covered by `[data-slot="sheet-content"]`.

  Do not call `StatusBar.setOverlaysWebView({ overlay: true })` here. Capacitor 8 already
  manages edge-to-edge and reports the resulting insets; forcing overlay mode only pushes
  content under the status bar.
- `src/components/cleartext-warning.tsx` — warns when a server address is plain HTTP
- The mobile sidebar closes when a link inside it is tapped (capture-phase handler in
  `ui/sidebar.tsx`), plus `src/components/close-sidebar-on-navigate.tsx` as a route-change
  safety net. On desktop the sidebar is a persistent column so upstream never needed to
  dismiss it; on mobile it covered the screen the user had just navigated to. The
  interaction handler is the primary mechanism because the route-change effect alone
  shipped and still left the sheet open on a real device.
- TanStack devtools are gated to dev builds; upstream renders them unconditionally, which
  put a floating badge over the bottom-right of the screen.
- Script editor touch handling: the minimap is hidden (a fixed 200x150 overlay is a large
  share of a phone screen and too small to navigate with), zoom and interaction-lock
  controls are dropped in favour of pinch-to-zoom, `nodeDragThreshold` is raised to 8px so
  a tap selects instead of nudging a node, and connection handles get a much larger hit
  area. The visible handle dot is deliberately unchanged — its size and shape encode the
  port type, and the node components set both inline.
- Control button groups stack vertically on mobile. `ButtonGroup` joins its children's
  borders, so wrapping left half-rounded buttons stranded on their own rows.

## Cleartext HTTP

Both platforms are configured to permit plain HTTP (`android:usesCleartextTraffic` plus
`allowMixedContent`; `NSAllowsArbitraryLoads` plus `NSAllowsLocalNetworking` on iOS),
because most self-hosted SoulFire servers are reachable only over `http://` on a LAN
address. The JWT is sent on every request, so anyone on the same network can read it — the
connect screen warns whenever the address is not HTTPS. Use HTTPS via a reverse proxy where
you can.

App Review requires a written justification for `NSAllowsArbitraryLoads`. The honest one is
that the app's entire purpose is connecting to a user-operated server at a user-supplied
address, which cannot be assumed to have a valid certificate.

## Known risks

- **Store policy.** An app for automating Minecraft bots may be rejected as facilitating
  third-party ToS violations. Android sideloading is the fallback.
- **Apple and the AGPL.** The App Store terms have historically conflicted with AGPL-3.0
  §13, which has removed apps before. Unresolved for the iOS build.
- **Trademark.** Mojang's brand guidelines restrict use of "Minecraft" in app names, icons
  and store copy, and forbid implying affiliation.
- **Fork drift.** Upstream fixes need manual merging.

## Licence

AGPL-3.0, matching upstream. See [LICENSE](LICENSE).
