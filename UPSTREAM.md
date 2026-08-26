# Tracking upstream SoulFire

This repo is a **hard fork of [SoulFireClient][client] by file copy**. It shares
no git history with upstream, so `git merge upstream/main` is not available:
syncing means applying an upstream diff by path.

The state of the fork lives in [`upstream-sync.json`](upstream-sync.json).
`syncedCommit` is the upstream commit whose content this tree is based on — the
only thing that makes "are we behind?" answerable.

## Checking

```sh
node scripts/check-upstream.mjs          # report
node scripts/check-upstream.mjs --json   # same, machine-readable
```

It adds an `upstream-soulfire` remote if missing, fetches, and reports new
commits, client/server version changes, a newer `@soulfiremc/sdk`, and — the
part that matters — **which changed files we have modified for mobile**.

`.github/workflows/upstream-check.yml` runs the same check every Monday and
keeps one `upstream-sync` issue in step with the result. It never pushes: most
upstream commits touch files that were changed for mobile, and merging those is
a judgement call.

## Applying

```sh
SYNCED=$(node -p "require('./upstream-sync.json').client.syncedCommit")
git fetch upstream-soulfire main
git diff "$SYNCED"..upstream-soulfire/main -- locales/ src/ public/ images/ index.html \
  package.json biome.json tsconfig.json components.json tsr.config.json > up.patch
git apply -3 up.patch
```

`git apply -3` does a real three-way merge using the fetched upstream blobs, so
files we have not touched apply silently and genuine conflicts land in the tree
as conflict markers rather than being lost.

Restrict the paths. Upstream carries an Electron app, CI, Crowdin, Vercel and
IDE config that this fork deliberately does not — `excludePaths` in
`upstream-sync.json` is the list, and the check script already filters by it.

Then, in order:

1. Resolve any conflicts. Locale files are the usual case: this fork adds keys
   (`error.connection.*`, `emailCode.toast.errorNetwork`,
   `dedicated.form.address.cleartextWarning`, `dialog.import.main.clipboard*`)
   that upstream does not have, so verify they survived.
2. `pnpm install && pnpm typecheck && pnpm check`
3. Bump `version` in `package.json`, and `versionCode`/`versionName` in
   `android/app/build.gradle`. Android refuses to downgrade, and a repeated
   `versionCode` makes it impossible to tell whether a reinstall replaced the
   previous APK.
4. `pnpm android:apk`
5. Set `syncedCommit` and `syncedVersion` in `upstream-sync.json` to what you
   actually applied — **not** to upstream head if you skipped anything.

## Server releases

A new SoulFire **server** release matters through the protos, not the UI. When
`soulfire-server-version.txt` moves upstream, or npm has a newer
`@soulfiremc/sdk`, bump the pinned `@soulfiremc/sdk` in `package.json` and
re-run the typecheck: removed or renamed RPCs surface there.

## Files this fork has diverged on

The check script derives this at runtime by comparing blobs, which is why there
is no hand-maintained list here to go stale. Anything it reports under **needs
review** is a file where mobile changes and upstream changes have to be
reconciled by hand.

[client]: https://github.com/soulfiremc-com/SoulFireClient
