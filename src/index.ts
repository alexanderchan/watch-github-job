#!/usr/bin/env node
import { Command } from "@commander-js/extra-typings";
import { watchRun } from "./watch.js";

const program = new Command()
  .name("watch-github-job")
  .description("Watch a GitHub Actions run until it completes")
  .argument("[run]", "Run ID or GitHub Actions URL to watch")
  .option(
    "--text <filters>",
    "Priority-ordered comma-delimited workflow name filters",
    "CI,Deploy"
  )
  .option("--no-open", "Don't open browser when run completes")
  .option("--timeout <minutes>", "Give up after N minutes", "35")
  .option("--quiet", "Suppress intermediate status lines; only print run ID, URL, and final result")
  .addHelpText(
    "after",
    `
Examples:
  $ watch-github-job                          # auto-detect from current branch
  $ watch-github-job 22412559223              # watch by run ID
  $ watch-github-job https://github.com/.../actions/runs/22412559223
  $ watch-github-job --text "Build,Test"      # custom priority filters
  $ watch-github-job --no-open --timeout 60   # no browser, longer timeout
  $ watch-github-job --quiet                  # minimal output for AI agents`
  )
  .action(async (run, opts) => {
    await watchRun({
      input: run,
      textFilters: opts.text,
      openBrowser: opts.open,
      timeoutMinutes: parseInt(opts.timeout, 10),
      quiet: opts.quiet ?? false,
    });
  });

program.parse();
