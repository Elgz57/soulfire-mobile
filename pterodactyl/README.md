# Running the custom server on Pterodactyl

The Auto TP Accept plugin is compiled into the SoulFire server (see
[`../server-plugin/README.md`](../server-plugin/README.md)), so the panel has to
run *your* jar instead of the one baked into the official Docker image.

There are two ways to do that, and **the first one needs no new egg at all**.

## Option 1: keep the official egg (simplest)

The official SoulFire egg already exposes `SF_JAR` as a user-editable variable,
defaulting to `/soulfire/soulfire.jar` — the jar inside the Docker image. Point
it somewhere else and the image's `start.sh` runs your jar instead:

1. Build the jar: Actions → **Build SoulFire server with plugins** → run it.
2. Download the release asset and upload it to your server's directory as
   `soulfire.jar` (file manager, or SFTP — SFTP is far more reliable for a
   ~430 MB file).
3. Panel → **Startup** → set `SF_JAR` to `/home/container/soulfire.jar`.
4. Restart.

Nothing else changes: Java, `start.sh` and the JVM flags all still come from the
official image.

## Option 2: import the custom egg

[`soulfire-custom-plugins-egg.json`](soulfire-custom-plugins-egg.json) is the
official egg with one difference — its install script **downloads** the jar into
the server directory, so you never move 430 MB through a browser.

1. Panel admin → **Nests** → **Import Egg** → upload the JSON.
2. Create (or reinstall) a server using **SoulFire (custom plugins)**.
3. Set these variables:

| Variable | Value |
| --- | --- |
| `SF_JAR_URL` | The release asset URL — the build's summary prints it for you |
| `SF_GITHUB_TOKEN` | A token with read access, **required while this repo is private** |
| `SF_JAR` | `/home/container/soulfire.jar` (already the default) |

4. Reinstall the server so the install script runs.

`SF_JAR_URL` points at a fixed release tag (`server-<version>-plugins`) that each
build overwrites, so rebuilding does not invalidate it. Reinstall to pick up a
new jar.

### The token

Release assets in a **private** repository cannot be downloaded anonymously, so
without `SF_GITHUB_TOKEN` the install fails. A fine-grained personal access
token with **Contents: Read** on this repository alone is enough.

The install script checks what it downloaded rather than trusting it: fetching a
private asset without a token returns a JSON error body, and curl will happily
save that as `soulfire.jar`. The script rejects anything that is not a valid
zip, and anything without the nested `META-INF/jars/mod-*.jar`, so you get a
clear message at install time instead of a confusing crash at startup.

If you make the repository public, clear `SF_GITHUB_TOKEN` and the same URL
works unauthenticated.

## Verifying it worked

After restart, the server log lists loaded plugins. In the app, the **Plugins**
page should show **Auto TP Accept** alongside the 19 stock plugins.

If the page still shows 19, the panel is running the old jar: check that
`SF_JAR` points at your file and that the file is actually there and ~430 MB.

## Rolling back

Set `SF_JAR` back to `/soulfire/soulfire.jar` and restart. That is the stock
server from the image, untouched — which is why leaving the image's jar in place
is worth doing.
