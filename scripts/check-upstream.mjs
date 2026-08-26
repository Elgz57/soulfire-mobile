#!/usr/bin/env node
/**
 * Reports what has changed in upstream SoulFireClient since our last sync.
 *
 * This repo is a hard fork by file copy, not a git fork: it shares no history
 * with upstream, so `git merge upstream/main` is not available and the only
 * usable mechanism is applying an upstream diff by path. That makes "are we
 * behind?" a question nobody can answer by eye, hence this script.
 *
 * It only reports. Applying the diff is a judgement call whenever a changed
 * file is one we have modified, so nothing here writes to the tree.
 *
 * Usage:
 *   node scripts/check-upstream.mjs            # human-readable report
 *   node scripts/check-upstream.mjs --json     # machine-readable
 *
 * Exit code is 0 whether or not updates exist; failures to reach upstream or
 * npm exit 1. CI reads has_updates from the JSON instead of the exit code, so
 * a real error is never mistaken for "nothing to do".
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = "upstream-soulfire";

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", options.quiet === true ? "ignore" : "inherit"],
  }).trim();
}

function gitOrNull(args) {
  try {
    return git(args, { quiet: true });
  } catch {
    return null;
  }
}

const ledger = JSON.parse(
  readFileSync(resolve(repoRoot, "upstream-sync.json"), "utf8"),
);

/** Adds or repoints the upstream remote, then fetches the tracked ref. */
function fetchUpstream() {
  const existing = gitOrNull(["remote", "get-url", REMOTE]);
  if (existing === null) {
    git(["remote", "add", REMOTE, ledger.client.repo]);
  } else if (existing !== ledger.client.repo) {
    git(["remote", "set-url", REMOTE, ledger.client.repo]);
  }
  // Full history, not a shallow fetch: the report compares file blobs against
  // the synced commit, which a shallow fetch would not have.
  git(["fetch", "--no-tags", REMOTE, ledger.client.ref]);
  return `${REMOTE}/${ledger.client.ref}`;
}

function isExcluded(path) {
  return ledger.excludePaths.some((prefix) =>
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
  );
}

/**
 * Classifies one upstream-changed path by how risky it is to apply.
 *
 * "clean" means our copy is byte-identical to the version we synced, so the
 * upstream change applies without thought. "modified" means we changed that
 * file for mobile and the upstream change has to be merged into ours by hand —
 * this is the only category that needs a human.
 */
function classify(path, syncedCommit) {
  const syncedBlob = gitOrNull(["rev-parse", `${syncedCommit}:${path}`]);
  const ourBlob = gitOrNull(["rev-parse", `HEAD:${path}`]);

  if (ourBlob === null) {
    return syncedBlob === null ? "upstream-new" : "absent-here";
  }
  if (syncedBlob === null) {
    return "modified";
  }
  return ourBlob === syncedBlob ? "clean" : "modified";
}

async function npmVersion(pkg) {
  const response = await fetch(
    `https://registry.npmjs.org/${pkg.replace("/", "%2F")}/latest`,
  );
  if (!response.ok) {
    throw new Error(`npm returned ${response.status} for ${pkg}`);
  }
  return (await response.json()).version;
}

const upstreamRef = fetchUpstream();
const syncedCommit = ledger.client.syncedCommit;
const upstreamHead = git(["rev-parse", upstreamRef]);

const commitCount = Number(
  git(["rev-list", "--count", `${syncedCommit}..${upstreamRef}`]),
);
const commits =
  commitCount === 0
    ? []
    : git([
        "log",
        "--no-merges",
        "--format=%h %s",
        `${syncedCommit}..${upstreamRef}`,
      ])
        .split("\n")
        .filter((line) => line !== "");

const changedPaths =
  commitCount === 0
    ? []
    : git(["diff", "--name-only", `${syncedCommit}..${upstreamRef}`])
        .split("\n")
        .filter((path) => path !== "" && !isExcluded(path));

const buckets = {
  clean: [],
  modified: [],
  "upstream-new": [],
  "absent-here": [],
};
for (const path of changedPaths) {
  buckets[classify(path, syncedCommit)].push(path);
}

const upstreamVersion = JSON.parse(
  git(["show", `${upstreamRef}:package.json`]),
).version;
const upstreamServerVersion =
  gitOrNull(["show", `${upstreamRef}:soulfire-server-version.txt`]) ??
  "unknown";
const sdkLatest = await npmVersion(ledger.sdk.package);

const report = {
  hasUpdates:
    commitCount > 0 ||
    upstreamVersion !== ledger.client.syncedVersion ||
    sdkLatest !== ledger.sdk.pinned ||
    upstreamServerVersion !== ledger.server.knownVersion,
  syncedCommit,
  upstreamHead,
  commitCount,
  commits,
  client: { synced: ledger.client.syncedVersion, upstream: upstreamVersion },
  server: {
    known: ledger.server.knownVersion,
    upstream: upstreamServerVersion,
  },
  sdk: { pinned: ledger.sdk.pinned, latest: sdkLatest },
  paths: buckets,
  // Whether a human has to make a decision, as opposed to applying a diff.
  needsReview: buckets.modified.length > 0,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const lines = [];
lines.push(`Upstream: ${ledger.client.repo} (${ledger.client.ref})`);
lines.push(
  `Synced at: ${syncedCommit.slice(0, 8)} (client ${report.client.synced})`,
);
lines.push(
  `Upstream head: ${upstreamHead.slice(0, 8)} (client ${report.client.upstream})`,
);
lines.push("");

if (!report.hasUpdates) {
  lines.push("Up to date. Nothing to sync.");
} else {
  lines.push(`New upstream commits: ${commitCount}`);
  for (const commit of commits) {
    lines.push(`  ${commit}`);
  }
  if (report.client.synced !== report.client.upstream) {
    lines.push(
      `Client version: ${report.client.synced} -> ${report.client.upstream}`,
    );
  }
  if (report.server.known !== report.server.upstream) {
    lines.push(
      `Server version: ${report.server.known} -> ${report.server.upstream}`,
    );
  }
  if (report.sdk.pinned !== report.sdk.latest) {
    lines.push(
      `${ledger.sdk.package}: pinned ${report.sdk.pinned}, latest ${report.sdk.latest}` +
        " (a server release usually means new protos — bump this)",
    );
  }
  lines.push("");
  if (buckets.modified.length > 0) {
    lines.push("Needs review (we modified these for mobile):");
    for (const path of buckets.modified) lines.push(`  ${path}`);
  }
  if (buckets.clean.length > 0) {
    lines.push("Applies cleanly (identical to our synced copy):");
    for (const path of buckets.clean) lines.push(`  ${path}`);
  }
  if (buckets["upstream-new"].length > 0) {
    lines.push("New upstream files (decide whether mobile wants them):");
    for (const path of buckets["upstream-new"]) lines.push(`  ${path}`);
  }
  if (buckets["absent-here"].length > 0) {
    lines.push("Changed upstream but deliberately absent here:");
    for (const path of buckets["absent-here"]) lines.push(`  ${path}`);
  }
}

const output = lines.join("\n");
console.log(output);

if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Upstream check\n\n\`\`\`\n${output}\n\`\`\`\n`,
  );
}
if (process.env.GITHUB_OUTPUT !== undefined) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `has_updates=${report.hasUpdates}\nneeds_review=${report.needsReview}\n`,
  );
}
