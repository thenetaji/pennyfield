import Constants from "expo-constants";
import { useEffect } from "react";
import { AppState } from "react-native";

import { notifyChange } from "@/data/changes";
import { useDb } from "@/db/context";
import { runAutoBackup } from "@/lib/backup/auto-backup";

/** Mount once near the app root: backs up shortly after launch and each time the app goes to the background. */
export function useAutoBackup(): void {
  const db = useDb();
  useEffect(() => {
    const version = Constants.expoConfig?.version ?? "0.0.0";
    const run = () =>
      void runAutoBackup(db, version)
        .then((wrote) => wrote && notifyChange(["settings"]))
        .catch(() => undefined);
    const timer = setTimeout(run, 5000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") run();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [db]);
}
