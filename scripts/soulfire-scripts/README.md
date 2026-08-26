# SoulFire scripts

Importable script graphs for the SoulFire script editor. These are not part of
the mobile app build — they are files you load into an instance.

## Importing one

In the app: open an instance → **Scripts** → create or open a script → the
toolbar's **Import** button → pick the `.soulfire-script.json` file. Then
**Save**, and make sure the script is not paused.

Import replaces whatever is on the canvas, so import into a new script rather
than over one you want to keep.

## `tpa-auto-accept.soulfire-script.json`

Watches chat for a teleport request and runs `/tpaccept <player>` when the
requesting player is on an allowlist.

**Two nodes to edit after importing:**

- **Allowed players** (the green String node) — comma-separated names, e.g.
  `Friend1,Friend2,Friend3`. Matching is case-insensitive; spaces around the
  commas are not trimmed, so do not add any.
- **Is this a TPA request?** (the Regex Match node) — the `pattern` field. The
  default covers the wordings used by EssentialsX and most TPA plugins:

  | Message | Captured |
  | --- | --- |
  | `Steve has requested to teleport to you.` | `Steve` |
  | `[VIP] Alex_99 has requested to teleport to you.` | `Alex_99` |
  | `Notch sent you a teleport request` | `Notch` |
  | `Notch sent you a tpa request` | `Notch` |
  | `Herobrine wants to teleport to you` | `Herobrine` |
  | `Bob has requested that you teleport to them.` | `Bob` |
  | `dinnerbone is requesting to teleport to you` | `dinnerbone` |

  If your server words it differently, send yourself a request, read the exact
  line in the bot's chat log, and adjust the pattern. The player name must stay
  in **capture group 1** — that is what gets appended to `/tpaccept`.

  It is a Java regex (the server compiles it), and `flags` is set to `i`.

**How it decides**, left to right on the canvas: `On Chat` feeds the plain-text
message into `Regex Match`; capture group 1 is the requesting player. The
allowlist string is lowercased and split on commas, and the lowercased player
name is looked up in it. Only when the message matched **and** the player is
allowed does `Branch` fire, through a rate limiter, into
`Send Chat` with `/tpaccept <name>`.

**Anti-spam.** The `flow.rate_limit` node allows 3 accepts immediately, then
one every 5 seconds (`maxTokens` 3, `refillRate` 0.2/s). Raise `refillRate` to
react faster, lower it to be more conservative.

**Worth knowing:** the trigger is chat text, and on most servers any player can
type any text. Someone could type `Friend1 has requested to teleport to you`
and the bot would run `/tpaccept Friend1` — which harmlessly fails, since there
is no pending request. The allowlist is what keeps this bounded: a name that is
not on it is ignored outright. Do not put a name on the allowlist you would not
want teleported to your bot on demand.

If nothing happens, check in this order: the script is saved and not paused;
the bot is actually receiving the chat line (the instance chat log shows it);
the regex matches that exact line; the name is on the allowlist.
