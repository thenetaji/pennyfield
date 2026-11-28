import { File, Paths } from "expo-file-system";

// Kept in the app's own sandbox, outside the database, so backups and CSV exports never carry it.
// Moves to the Keychain once a native build adds expo-secure-store.
const file = () => new File(Paths.document, "gemini-key.txt");

export function readGeminiKey(): string | null {
  try {
    const f = file();
    if (!f.exists) return null;
    const key = f.textSync().trim();
    return key || null;
  } catch {
    return null;
  }
}

export function saveGeminiKey(key: string): void {
  const f = file();
  if (!f.exists) f.create();
  f.write(key.trim());
}

export function clearGeminiKey(): void {
  const f = file();
  if (f.exists) f.delete();
}
