import * as Updates from "expo-updates";

const RELEASES =
  "https://api.github.com/repos/thenetaji/pennyfield/releases?per_page=30";
const TAG = /^finance-v(\d+\.\d+\.\d+)$/;

type GitHubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
};

export type UpdateResult =
  | { kind: "current" }
  | { kind: "ready" }
  | { kind: "release"; version: string; url: string };

function isNewer(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++)
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

export function newestRelease(
  releases: readonly GitHubRelease[],
  current: string,
): { version: string; url: string } | null {
  let newest: { version: string; url: string } | null = null;
  for (const release of releases) {
    const version = TAG.exec(release.tag_name)?.[1];
    if (!version || release.draft || release.prerelease) continue;
    if (isNewer(version, newest?.version ?? current))
      newest = { version, url: release.html_url };
  }
  return newest;
}

/** A new install takes priority, because an update published for this version can't carry native changes. */
export async function checkForUpdates(current: string): Promise<UpdateResult> {
  const response = await fetch(RELEASES, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const release = newestRelease(
    (await response.json()) as GitHubRelease[],
    current,
  );
  if (release) return { kind: "release", ...release };
  if (Updates.isEnabled) {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (isAvailable) {
      await Updates.fetchUpdateAsync();
      return { kind: "ready" };
    }
  }
  return { kind: "current" };
}
