import { execSync } from "child_process";
import { gh, ghJson } from "./gh.js";

interface RunSummary {
  databaseId: number;
  name: string;
  headSha: string;
  headBranch: string;
  status: string;
}

function pickByPriority({
  runs,
  textFilters,
}: {
  runs: RunSummary[];
  textFilters: string;
}): string | null {
  const filters = textFilters
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  for (const filter of filters) {
    const regex = new RegExp(filter, "i");
    const match = runs.find((r) => regex.test(r.name));
    if (match) {
      console.error(`🎯 Matched filter: "${filter}" → ${match.name}`);
      return String(match.databaseId);
    }
  }

  if (runs.length > 0) {
    console.error(
      `⚠️  No priority filter matched [${textFilters}], using first available: ${runs[0].name}`
    );
    return String(runs[0].databaseId);
  }

  return null;
}

export function findLatestRunForBranch({
  textFilters,
}: {
  textFilters: string;
}): string | null {
  let branch: string;
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    console.error("❌ Not in a git repository");
    return null;
  }

  console.error(`🔍 Current branch: ${branch}`);

  // Try to get PR SHA for more precise matching
  let prSha: string | null = null;
  try {
    const prInfo = ghJson<{ sha: string }>(
      `pr view ${branch} --json number,headRefOid --jq '{number: .number, sha: .headRefOid}'`
    );
    prSha = prInfo.sha;
    console.error(`🔎 PR found, filtering to SHA: ${prSha}`);
  } catch {
    console.error("ℹ️  No PR found, searching by branch only");
  }

  let runs = ghJson<RunSummary[]>(
    `run list --limit 50 --branch ${branch} --json name,headSha,databaseId,status,headBranch`
  );

  // Prefer runs on the exact PR SHA if available
  if (prSha) {
    const shaRuns = runs.filter((r) => r.headSha === prSha);
    if (shaRuns.length > 0) {
      console.error(`🔎 Found ${shaRuns.length} run(s) on SHA ${prSha}`);
      runs = shaRuns;
    } else {
      console.error("⚠️  No runs on PR SHA, using all branch runs");
    }
  }

  return pickByPriority({ runs, textFilters });
}

export function findActiveRunByUser({
  textFilters,
}: {
  textFilters: string;
}): string | null {
  let currentUser: string;
  try {
    currentUser = gh("api user --jq .login");
  } catch {
    console.error("❌ Could not get current GitHub user");
    return null;
  }

  console.error(`👤 Looking for active runs by user: ${currentUser}`);

  let allRuns: RunSummary[] = [];
  for (const status of ["in_progress", "queued", "waiting"] as const) {
    try {
      const batch = ghJson<RunSummary[]>(
        `run list --status ${status} --user ${currentUser} --limit 50 --json name,databaseId,headBranch,status,headSha`
      );
      allRuns = allRuns.concat(batch);
    } catch {
      // status filter may return empty — that's fine
    }
  }

  return pickByPriority({ runs: allRuns, textFilters });
}
