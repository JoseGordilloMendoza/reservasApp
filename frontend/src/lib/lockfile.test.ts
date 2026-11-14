import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The host that publishes the app installs with "npm ci", which refuses a lock file that lacks the optional
 * packages of any platform. Installing a package from inside the Linux container rewrites the lock with only
 * its own platform, and the next publish fails before it starts. This catches that here, where it is cheap.
 */
describe("package-lock.json", () => {
  const lock = JSON.parse(readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8")) as {
    packages: Record<string, unknown>;
  };
  const entries = Object.keys(lock.packages);

  it("keeps the optional packages of every platform, not only of the one that wrote it", () => {
    const of = (prefix: string) => entries.filter((name) => name.startsWith(prefix)).length;

    // esbuild, rollup and tailwind publish one package per platform; a complete lock lists all of them.
    expect(of("node_modules/@esbuild/")).toBeGreaterThanOrEqual(20);
    expect(of("node_modules/@rollup/rollup-")).toBeGreaterThanOrEqual(20);
    expect(of("node_modules/@tailwindcss/oxide-")).toBeGreaterThanOrEqual(10);
  });

  it("covers the platforms that publish and the ones that develop", () => {
    for (const platform of ["linux-x64-gnu", "linux-x64-musl", "darwin-arm64", "win32-x64-msvc"]) {
      expect(entries.some((name) => name.startsWith("node_modules/@rollup/rollup-") && name.endsWith(platform))).toBe(true);
    }
  });
});
