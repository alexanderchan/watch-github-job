import { execSync } from "child_process";
import { ghJson } from "./gh.js";
import { findLatestRunForBranch, findActiveRunByUser } from "./find-run.js";

interface RunStatus {
  status: string;
  conclusion: string | null;
  jobs: Job[];
}

interface Job {
  name: string;
  status: string;
  conclusion: string | null;
  steps: Step[];
}

interface Step {
  name: string;
  status: string;
  conclusion: string | null;
}

interface RunMeta {
  name: string;
  workflowName: string;
  displayTitle: string;
  createdAt: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`;
}

function openUrl(url: string) {
  try {
    execSync(`open "${url}"`, { stdio: "ignore" });
  } catch {
    // non-macOS fallback
    try {
      execSync(`xdg-open "${url}"`, { stdio: "ignore" });
    } catch {}
  }
}

function resolveRunId({
  input,
  textFilters,
}: {
  input: string | undefined;
  textFilters: string;
}): string {
  if (input) {
    const urlMatch = input.match(/actions\/runs\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    if (/^\d+$/.test(input)) return input;
    console.error(`❌ Invalid run ID or URL: ${input}`);
    process.exit(1);
  }

  console.error(
    `ℹ️  No run ID provided, searching with priority filters: [${textFilters}]`
  );

  const fromBranch = findLatestRunForBranch({ textFilters });
  if (fromBranch) return fromBranch;

  console.error(
    "🔄 Branch-based search failed, trying active runs by current user..."
  );
  const fromUser = findActiveRunByUser({ textFilters });
  if (fromUser) return fromUser;

  console.error("❌ Could not determine workflow run to monitor.");
  console.error(
    "   Tried: 1) Latest run for current branch, 2) Active runs by current user"
  );
  process.exit(1);
}

export async function watchRun({
  input,
  textFilters,
  openBrowser,
  timeoutMinutes,
  quiet,
}: {
  input: string | undefined;
  textFilters: string;
  openBrowser: boolean;
  timeoutMinutes: number;
  quiet: boolean;
}) {
  const runId = resolveRunId({ input, textFilters });

  // Get repo for URL construction
  let ownerRepo: string;
  try {
    ownerRepo = execSync("gh repo view --json nameWithOwner -q .nameWithOwner", {
      encoding: "utf-8",
    }).trim();
  } catch {
    ownerRepo = "unknown/unknown";
  }

  const runUrl = `https://github.com/${ownerRepo}/actions/runs/${runId}`;
  console.log(`\nRun ID: ${runId}`);
  console.log(`📡 Watching: ${runUrl}`);

  const meta = ghJson<RunMeta>(
    `run view ${runId} --json name,workflowName,displayTitle,createdAt`
  );
  console.log(`🔧 Workflow: ${meta.workflowName}`);
  console.log(`📘 Title:    ${meta.displayTitle}`);

  // Use job's createdAt for elapsed — avoids timezone issues with Date.parse on ISO 8601
  const jobStartMs = new Date(meta.createdAt).getTime();
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const POLL_INTERVAL = 15_000;

  console.log("");

  while (true) {
    const elapsed = Date.now() - jobStartMs;

    if (elapsed > timeoutMs) {
      console.error(`⚠️  Timeout: gave up after ${timeoutMinutes} minutes.`);
      process.exit(1);
    }

    const result = ghJson<RunStatus>(
      `run view ${runId} --json status,conclusion,jobs`
    );

    if (result.status === "completed") {
      const icon = result.conclusion === "success" ? "✅" : "❌";
      const summary = `${icon} ${result.conclusion}  elapsed: ${formatElapsed(elapsed)}`;
      if (quiet) {
        console.log(summary);
      } else {
        console.log(`\n${summary}`);
      }

      if (result.conclusion !== "success") {
        const failedJobs = result.jobs.filter(
          (j) => j.conclusion && j.conclusion !== "success" && j.conclusion !== "skipped"
        );
        if (failedJobs.length > 0) {
          console.log("\nFailed jobs:");
          for (const job of failedJobs) {
            console.log(`  ❌ ${job.name} (${job.conclusion})`);
            const failedSteps = job.steps.filter(
              (s) => s.conclusion && s.conclusion !== "success" && s.conclusion !== "skipped"
            );
            for (const step of failedSteps) {
              console.log(`      • ${step.name} (${step.conclusion})`);
            }
          }
        }
      }

      if (openBrowser) openUrl(runUrl);
      process.exit(result.conclusion === "success" ? 0 : 1);
    }

    if (!quiet) {
      const activeStep = result.jobs
        .flatMap((j) => (j.status === "in_progress" ? j.steps : []))
        .find((s) => s.status === "in_progress");

      const stepDisplay = activeStep?.name ?? "-";
      const elapsedStr = formatElapsed(elapsed);

      process.stdout.write(
        `\r⏳ ${result.status.padEnd(12)}  step: ${stepDisplay.padEnd(40)}  elapsed: ${elapsedStr}   `
      );
    }

    await sleep(POLL_INTERVAL);
  }
}
