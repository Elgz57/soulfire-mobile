# brag-plan — SoulFire Mobile

**Tone:** cinematic, Apple product film. Black, restrained, slow pushes, big tight type,
one idea per scene.

## Angle

SoulFire's control panel was a desktop app. This is *the same dashboard* — same React
code, same design tokens, same screens — running as a native Android app. The angle is
not "we built an app", it's **the whole thing, unchanged, in your hand**.

## Hook

Black. The flame mark ignites. That's it — Apple opens on the product, not on a claim.

## Highlights

1. **Your own server** — the real connect screen. SoulFire is self-hosted; you point it
   at your machine.
2. **Every bot, at a glance** — the real Overview: `1 online · 1 desired · 1 total`, the
   stat cards.
3. **The whole dashboard** — the real sidebar: Overview, Terminal, Bots, Audit Log,
   Bot/Account/Proxy/AI/Pathfinding Settings, Plugins, Scripts. Nothing was cut.

## Punchline

"Same code. Same screens. Now it fits in your hand." — true and checkable: the README
says the fork copies `src/`, `locales/` and `public/` from upstream at 2.9.1.

## Visual identity

Taken from the app's own tokens, used as `oklch()` verbatim since Chromium preserves it:

- background `#000` → `oklch(0.148 0.004 228.8)` (the app's dark surface)
- primary `oklch(0.457 0.24 277.023)` — the indigo on buttons and the instance mark
- foreground `oklch(0.987 0.002 197.1)`, muted `oklch(0.56 0.021 213.5)`
- Type: system-ui, 600 weight, `letter-spacing: -0.03em` on display sizes — per the
  apple-design skill in this repo: tracking is size-specific and large text wants
  negative tracking.

Footage is the **real app**, captured at 412×915 @3x with `demo-mode` enabled, which
makes `isDemo()` true and serves the actual dashboard from `demo-data.ts` with no server.
Not a mock-up.

## Storyboard — 21.0s @ 30fps (630 frames), 1920×1080

| # | Time | Beat | On screen |
| --- | --- | --- | --- |
| 1 | 0.0–3.6 | Ignite | Flame mark fades up on black, indigo glow blooms, "SoulFire" sets beneath it |
| 2 | 3.6–7.8 | Your own server | Phone rises, connect screen. Line: **Your own server.** |
| 3 | 7.8–12.2 | At a glance | Phone holds Overview, slow push. Line: **Every bot, at a glance.** |
| 4 | 12.2–16.6 | Everything | Phone holds the sidebar. Line: **The whole dashboard.** |
| 5 | 16.6–21.0 | Payoff | Back to black. "SoulFire Mobile" / "Same code. Same screens. Now it fits in your hand." / "Open source · Android" |

Transitions dip through black rather than crossfading two busy layouts, which would
double-expose the phone.

## Sound

One piece, A minor, written with the picture: a 55 Hz sub drone under everything; a pad
moving Am–F–C–G, one chord per scene; a bell pluck on each cut, tuned to the chord under
it; a soft filtered-noise swell into each transition, well under the music. Final chord
opens up and rings out under the payoff.
