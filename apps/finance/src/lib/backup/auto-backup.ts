import { Directory, type File } from "expo-file-system";
import { Platform } from "react-native";

import { BackupFolderNative } from "../../../modules/finance-backup";
import { APP_NAME } from "@/constants/app";
import {
  BACKUP_FORMAT,
  exportBackup,
  serializeBackup,
} from "@/db/repos/backup";
import { getSetting, setSetting } from "@/db/repos/settings";
import type { Db } from "@/db/types";

const DAY = 24 * 60 * 60 * 1000;
export const MAIN_FILE = `${APP_NAME} backup.json`;
const WEEKLY = new RegExp(`^${APP_NAME} backup (\\d{4}-W\\d{2})\\.json$`);
export const KEEP_WEEKS = 8;
export const BACKUP_LOST = "Can't reach the backup folder. Pick it again.";
const NATIVE = Platform.OS === "ios" && BackupFolderNative.available;

/** ISO 8601 week, e.g. "2026-W47". */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jan1 = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - jan1) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const weeklyName = (week: string) => `${APP_NAME} backup ${week}.json`;

/** Weekly copies to delete: older than the kept weeks, or this week's (it is rewritten). */
export function staleWeeklies(names: readonly string[], now: Date): string[] {
  const week = isoWeek(now);
  const keep = new Set(
    Array.from({ length: KEEP_WEEKS }, (_, i) =>
      isoWeek(new Date(now.getTime() - i * 7 * DAY)),
    ),
  );
  return names.filter((name) => {
    const m = WEEKLY.exec(name);
    return !!m && (m[1] === week || !keep.has(m[1] ?? ""));
  });
}

/** True when it is time for another automatic backup. */
export function backupDue(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= DAY;
}

/** Lets the user pick a folder (iCloud Drive, Google Drive, On My iPhone…); false when cancelled. */
export async function pickBackupFolder(db: Db): Promise<boolean> {
  if (Platform.OS === "web") return false;
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message))) return false;
    throw e;
  }
  if (NATIVE && !BackupFolderNative.saveFolder(dir.uri))
    throw new Error("Couldn't keep access to that folder. Try another one.");
  setSetting(db, "auto_backup_folder", dir.uri);
  setSetting(db, "auto_backup_folder_name", folderName(dir.uri));
  setSetting(db, "auto_backup_error", null);
  setSetting(db, "auto_backup_at", null);
  return true;
}

export function turnOffAutoBackup(db: Db): void {
  setSetting(db, "auto_backup_folder", null);
  setSetting(db, "auto_backup_folder_name", null);
  setSetting(db, "auto_backup_at", null);
  setSetting(db, "auto_backup_error", null);
  if (NATIVE) BackupFolderNative.clearFolder();
}

let running: Promise<boolean> | null = null;

/** Writes the backup to the picked folder at most once a day (always when `force`); true when written. */
export function runAutoBackup(
  db: Db,
  appVersion: string,
  force = false,
): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(false);
  const uri = getSetting(db, "auto_backup_folder");
  if (!uri) return Promise.resolve(false);
  if (!force && getSetting(db, "auto_backup_error"))
    return Promise.resolve(false);
  if (!force && !backupDue(getSetting(db, "auto_backup_at"), Date.now()))
    return Promise.resolve(false);
  running ??= write(db, uri, appVersion).finally(() => {
    running = null;
  });
  return running;
}

async function write(
  db: Db,
  uri: string,
  appVersion: string,
): Promise<boolean> {
  try {
    const now = new Date();
    const json = serializeBackup(
      exportBackup(db, { now: now.getTime(), appVersion }),
    );
    if (NATIVE) await writeNative(json, now);
    else writeFiles(new Directory(uri), json, now);
    setSetting(db, "auto_backup_at", now.getTime());
    setSetting(db, "auto_backup_error", null);
    return true;
  } catch {
    setSetting(db, "auto_backup_error", BACKUP_LOST);
    return false;
  }
}

const isOurs = (head: string | null) => !!head?.includes(BACKUP_FORMAT);

// Native writes replace atomically, so only weekly copies past the window are deleted.
async function writeNative(json: string, now: Date): Promise<void> {
  const week = isoWeek(now);
  const names = await BackupFolderNative.list();
  for (const name of staleWeeklies(names, now)) {
    if (name === weeklyName(week)) continue;
    if (!isOurs(await BackupFolderNative.head(name, 64))) continue;
    if (!(await BackupFolderNative.remove(name)))
      throw new Error("delete failed");
  }
  for (const name of [weeklyName(week), MAIN_FILE])
    if (!(await BackupFolderNative.write(name, json)))
      throw new Error("write failed");
}

function writeFiles(dir: Directory, json: string, now: Date): void {
  const files = entries(dir);
  const stale = new Set(
    staleWeeklies(
      files.map((f) => f.name),
      now,
    ),
  );
  // Delete then create: Android's "w" mode can leave old bytes past the new end.
  for (const { name, file } of files)
    if (stale.has(name) && isOurs(readHead(file))) file.delete();
  dir.createFile(weeklyName(isoWeek(now)), "application/json").write(json);
  for (const { name, file } of files)
    if (name === MAIN_FILE && isOurs(readHead(file))) file.delete();
  dir.createFile(MAIN_FILE, "application/json").write(json);
}

function readHead(file: File): string | null {
  try {
    const handle = file.open();
    try {
      return String.fromCharCode(...Array.from(handle.readBytes(64)));
    } finally {
      handle.close();
    }
  } catch {
    return null;
  }
}

// Android SAF uris often hide the file name, so names come from info() in list order.
function entries(dir: Directory): { name: string; file: File }[] {
  const items = dir.list();
  const names = Platform.OS === "android" ? (dir.info().files ?? []) : [];
  const out: { name: string; file: File }[] = [];
  items.forEach((item, i) => {
    if (item instanceof Directory) return;
    const name =
      names.length === items.length ? (names[i] ?? "") : lastName(item.uri);
    out.push({ name, file: item });
  });
  return out;
}

function lastName(uri: string): string {
  let s = uri.replace(/\/+$/, "");
  s = s.slice(s.lastIndexOf("/") + 1);
  try {
    s = decodeURIComponent(s);
  } catch {
    // Keep the raw name.
  }
  return s.slice(Math.max(s.lastIndexOf("/"), s.lastIndexOf(":")) + 1);
}

export function folderName(uri: string): string {
  if (uri.includes("com.google.android.apps.docs")) return "Google Drive";
  if (uri.includes("com.android.providers.downloads")) return "Downloads";
  const name = lastName(uri);
  if (!name || name.includes("=") || name.length > 40) return "Folder";
  return name === "com~apple~CloudDocs" ? "iCloud Drive" : name;
}
