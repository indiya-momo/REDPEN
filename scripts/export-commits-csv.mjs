import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(repo);

const unpushed = new Set();
try {
  const out = execSync("git log origin/main..main --format=%H", {
    encoding: "utf8",
  }).trim();
  if (out) {
    for (const hash of out.split(/\r?\n/)) {
      unpushed.add(hash);
    }
  }
} catch {
  // origin/main may be unavailable offline
}

const raw = execSync(
  'git log --author=Rosa --format=%H%x1f%h%x1f%ai%x1f%s --reverse',
  { encoding: "utf8" },
);

const rows = raw
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [full_hash, short_hash, datetime, ...rest] = line.split("\x1f");
    const message = rest.join("\x1f").replace(/"/g, '""');
    const date = datetime.slice(0, 10);
    const pushed = unpushed.has(full_hash) ? "no" : "yes";
    return [full_hash, short_hash, datetime, date, message, pushed]
      .map((value) => `"${value}"`)
      .join(",");
  });

const csv = ["full_hash,short_hash,datetime,date,message,pushed", ...rows].join(
  "\n",
);

const outPath = join(repo, "commits.csv");
writeFileSync(outPath, `\uFEFF${csv}\n`, "utf8");

console.log(`Wrote ${rows.length} commits to ${outPath}`);
console.log(`Unpushed: ${unpushed.size}`);
