import { execSync } from "child_process";

export function gh(args: string): string {
  try {
    return execSync(`gh ${args}`, { encoding: "utf-8" }).trim();
  } catch (e: any) {
    const msg = e.stderr?.toString().trim() || e.message;
    throw new Error(`gh ${args.split(" ")[0]} failed: ${msg}`);
  }
}

export function ghJson<T>(args: string): T {
  return JSON.parse(gh(args));
}
