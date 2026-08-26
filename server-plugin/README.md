# Auto TP Accept — SoulFire server plugin

Accepts teleport requests from an allowlist of players. Appears in the app as a
settings page ("Auto TP Accept") with a toggle, an allowlist, the request
pattern and the accept command — no script graph to wire up.

## Read this first: plugins are compiled into the server

SoulFire has no drop-in plugin loading. `SoulFireAbstractBootstrap.initPlugins()`
scans the classpath with ClassGraph for `@InternalPluginClass` types in the
`com.soulfiremc.server.plugins` package, and that is the whole mechanism: there
is no plugins directory, no `URLClassLoader`, and nothing in the docs about
third-party JARs. The server also launches through Mixins, so a JAR bolted onto
the classpath is not a supported path.

**So installing this means running your own SoulFire server build.** That is a
real cost: Java 25, a Gradle build, uploading your own JAR to your host, and
rebasing onto upstream whenever SoulFire releases.

If you do not want to maintain a server fork, use
[`../scripts/soulfire-scripts/tpa-auto-accept.soulfire-script.json`](../scripts/soulfire-scripts/README.md)
instead. It does the same job on an unmodified server and installs by importing
a file. It is the less elegant option but it costs nothing to deploy.

## Installing

### The easy way: let CI build it

Run the **Build SoulFire server with plugins** workflow
(`.github/workflows/build-server.yml`) from the Actions tab, leaving the
version at `2.9.1` unless your server runs something else. It clones SoulFire,
copies in every `.java` file from this directory, builds, and **fails the run if
the plugin class is not actually in the jar**.

Download the artifact, unzip it, and upload the jar to your host in place of the
stock SoulFire jar. Then restart the server.

The jar is around 433 MB, which is why this is a CI artifact rather than
something committed or handed over directly.

### Or build it locally

```sh
git clone --depth=1 --branch 2.9.1 https://github.com/soulfiremc-com/SoulFire.git
cd SoulFire
cp /path/to/AutoTpAccept.java mod/src/main/java/com/soulfiremc/server/plugins/
./gradlew :dedicated-launcher:uberJar    # needs JDK 25; Gradle fetches it via foojay
```

The runnable jar lands at `dedicated-launcher/build/libs/SoulFireDedicated-2.9.1.jar`.

Use `uberJar`, not `build` or `assemble` — those only produce the `-unshaded`
launcher jar, which will not run on its own.

Match the SoulFire version to the one your client expects (2.9.1 for this app
build). Building `main` gives you a `2.9.2-SNAPSHOT` server, which may drift
from the protos the client's pinned `@soulfiremc/sdk` was generated against.

Nothing needs to be registered anywhere — ClassGraph finds the class by its
annotation and package.

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| Enable Auto TP Accept | off | |
| Allowed Players | *empty* | Case-insensitive. **Empty means accept from nobody.** |
| Request Pattern | see below | Regex. Capture group 1 must be the player name. |
| Accept Command | `/tpaccept %player%` | `%player%` is substituted. |
| Min/Max delay | 500–1500 ms | Random delay before replying. |

The default pattern covers the wordings EssentialsX and the common TPA plugins
use, case-insensitively, tolerating a rank prefix like `[VIP]`:

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
line in the bot's chat log, and adjust the pattern. The player name has to stay
in capture group 1.

## Design notes

- **An empty allowlist accepts nothing.** Treating empty as "everyone" would let
  any player on the server teleport to your bot on demand, which is not a
  default worth applying silently.
- **Patterns are compiled once and cached**, keyed by the setting's value. The
  handler runs for every chat line every bot receives, so compiling per message
  would cost CPU proportional to chat volume. Keying on the value means editing
  the setting takes effect without a restart, and a pattern that does not
  compile is logged once rather than once per message.
- **Replies are delayed 500–1500 ms.** Answering a teleport request in the tick
  it arrives is a reliable bot tell, and some servers rate-limit commands sent
  that fast. `AutoRegister` does the same.
- **Names are lowercased with `Locale.ROOT`.** Minecraft names are ASCII, and
  the default locale would turn `I` into a dotless character under a Turkish
  locale and stop matching.

## Worth knowing

The trigger is chat text, and on most servers any player can type any text.
Someone could type `Friend1 has requested to teleport to you` and the bot would
run `/tpaccept Friend1` — harmless, since no request is pending. The allowlist
is what bounds this. Do not put a name on it you would not want teleporting to
your bot on demand.
