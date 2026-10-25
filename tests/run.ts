import { spawnSync } from "node:child_process";
for (const script of [
  "tests/domain.test.ts",
  "tests/navigation.test.ts",
  "tests/db.integration.ts",
]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
