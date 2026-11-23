import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

type Native = {
  saveFolder(uri: string): boolean;
  clearFolder(): void;
  write(name: string, text: string): Promise<boolean>;
  list(): Promise<string[]>;
  head(name: string, bytes: number): Promise<string | null>;
  remove(name: string): Promise<boolean>;
};

const native =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<Native>("FinanceBackup")
    : null;

const safe = async <T>(
  run: (n: Native) => Promise<T>,
  fallback: T,
): Promise<T> => {
  if (!native) return fallback;
  try {
    return await run(native);
  } catch {
    return fallback;
  }
};

/** iOS keeps a picked folder for one session only; this native side bookmarks it and does the file work. */
export const BackupFolderNative = {
  available: native != null,
  /** Bookmarks the just-picked folder; false when it can't. */
  saveFolder(uri: string): boolean {
    try {
      return native?.saveFolder(uri) ?? false;
    } catch {
      return false;
    }
  },
  clearFolder(): void {
    try {
      native?.clearFolder();
    } catch {
      // Nothing to clear.
    }
  },
  write: (name: string, text: string) =>
    safe((n) => n.write(name, text), false),
  list: () => safe((n) => n.list(), [] as string[]),
  head: (name: string, bytes: number) =>
    safe((n) => n.head(name, bytes), null as string | null),
  remove: (name: string) => safe((n) => n.remove(name), false),
};
