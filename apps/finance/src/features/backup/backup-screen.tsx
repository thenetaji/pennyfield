import * as React from "react";
import { ScrollView, View } from "react-native";

import { useRouter } from "expo-router";

import { Button, ListGroup, ListRow, showToast, Text } from "@studio/ui";
import { Eyebrow, HeroWash } from "@/components/app/surface";
import { confirmErase } from "@/features/data-transfer/erase";
import { APP_NAME } from "@/constants/app";
import { useActions } from "@/data/actions";
import { useSetting, useSyncStatus } from "@/data/hooks";
import type { BackupSummary } from "@/db/repos/backup";
import { AppIcon } from "@studio/icons";
import { getSyncProvider, type SyncProviderId } from "@/lib/sync";
import { haptic, useTokens } from "@studio/theme";

import { backupTimeLabel } from "./format";
import { RestoreSheet } from "./restore-sheet";

const PROVIDERS: readonly { id: SyncProviderId; label: string }[] = [
  { id: "icloud", label: "iCloud" },
  { id: "gdrive", label: "Google Drive" },
];

/** Everything about keeping data safe: backup status, daily backup, restore, CSV and erase. */
export function BackupScreen() {
  const actions = useActions();
  const router = useRouter();
  const { colors } = useTokens();
  // Onboarding is the unprotected route once `onboarding_done` resets, so the navigator moves there on its own.
  const eraseAll = () =>
    confirmErase(() => {
      actions.data.eraseAll();
      haptic("success");
    });
  const { provider, lastBackupAt } = useSyncStatus();
  const [, setProvider] = useSetting("sync_provider");
  const [pending, setPending] = React.useState<{
    json: string;
    summary: BackupSummary;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [autoFolder] = useSetting("auto_backup_folder");
  const [autoFolderName] = useSetting("auto_backup_folder_name");
  const [autoAt] = useSetting("auto_backup_at");
  const [autoError] = useSetting("auto_backup_error");
  const [autoBusy, setAutoBusy] = React.useState(false);
  const statuses = React.useMemo(
    () =>
      PROVIDERS.map((p) => ({
        ...p,
        status: getSyncProvider(p.id)?.status() ?? null,
      })),
    [],
  );

  const backUp = async () => {
    try {
      await actions.backup.share();
      haptic("success");
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message === "sharing_unavailable"
            ? "Sharing is not available"
            : "Backup failed",
        haptic: "warning",
      });
    }
  };

  const pick = async () => {
    try {
      const text = await actions.backup.pick();
      if (text === null) return;
      const result = actions.backup.validate(text);
      if (!result.ok) {
        showToast({
          message:
            result.error === "newer_schema"
              ? "Made by a newer version"
              : `Not a ${APP_NAME} backup`,
          haptic: "warning",
        });
        return;
      }
      setPending({ json: text, summary: result.summary });
    } catch {
      showToast({ message: "Could not read the file", haptic: "warning" });
    }
  };

  const restore = () => {
    if (!pending) return;
    setBusy(true);
    try {
      actions.backup.restore(pending.json);
      haptic("success");
      setPending(null);
      showToast({ message: "Restored", haptic: false });
    } catch {
      showToast({ message: "Restore failed", haptic: "warning" });
    } finally {
      setBusy(false);
    }
  };

  const toggleProvider = async (id: SyncProviderId, next: boolean) => {
    try {
      if (next) {
        await getSyncProvider(id)?.connect();
        setProvider(id);
        await actions.sync.now(getSyncProvider(id));
      } else {
        await getSyncProvider(id)?.disconnect();
        setProvider("none");
      }
    } catch {
      showToast({ message: "Could not connect", haptic: "warning" });
    }
  };

  const pickFolder = async () => {
    setAutoBusy(true);
    try {
      if (await actions.autoBackup.pick()) haptic("success");
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Could not use that folder",
        haptic: "warning",
      });
    } finally {
      setAutoBusy(false);
    }
  };

  const autoNow = async () => {
    setAutoBusy(true);
    try {
      const ok = await actions.autoBackup.runNow();
      if (ok) haptic("success");
      else showToast({ message: "Backup failed", haptic: "warning" });
    } finally {
      setAutoBusy(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await actions.sync.now();
      haptic("success");
    } catch {
      showToast({ message: "Sync failed", haptic: "warning" });
    } finally {
      setSyncing(false);
    }
  };

  const syncChoices = statuses.filter((p) => p.status?.status === "available");
  const lastAt = Math.max(lastBackupAt ?? 0, autoAt ?? 0) || null;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="pb-12"
    >
      <HeroWash>
        <View className="items-center px-5 pb-8 pt-6">
          <View
            className="mb-4 h-14 w-14 items-center justify-center rounded-[18px]"
            style={{ backgroundColor: autoError ? colors.warning : colors.accent }}
          >
            <AppIcon name="cloud" size={26} color={colors.onAccent} />
          </View>
          <Text variant="title2" className="text-center">
            {autoError ? "Backup failed" : lastAt ? `Backed up ${backupTimeLabel(lastAt)}` : "Not backed up yet"}
          </Text>
          <Text variant="subhead" tone="secondary" className="mt-1 text-center">
            {autoError ?? (autoFolder ? `Daily to ${autoFolderName ?? "your folder"}` : "Your data lives only on this phone")}
          </Text>
          <View className="mt-5 self-stretch">
            <Button
              size="lg"
              loading={autoBusy}
              onPress={() => void (autoFolder ? autoNow() : backUp())}
            >
              Back up now
            </Button>
          </View>
        </View>
      </HeroWash>

      <Eyebrow>Automatic</Eyebrow>
      <ListGroup
        footer={autoFolder ? undefined : "Pick a folder in iCloud Drive or Files. One backup a day, plus a copy for each of the last 8 weeks."}
      >
        <ListRow
          label="Daily backup"
          switchValue={!!autoFolder}
          onSwitchChange={(on) => {
            if (on) void pickFolder();
            else actions.autoBackup.turnOff();
          }}
        />
        {autoFolder ? (
          <ListRow label="Folder" value={autoFolderName ?? "Folder"} chevron onPress={() => void pickFolder()} />
        ) : null}
        {syncChoices.map(({ id, label }) => (
          <ListRow
            key={id}
            label={`Sync with ${label}`}
            switchValue={provider === id}
            onSwitchChange={(next) => void toggleProvider(id, next)}
          />
        ))}
        {provider !== "none" ? (
          <ListRow
            label={syncing ? "Syncing" : "Sync now"}
            onPress={syncing ? undefined : () => void syncNow()}
          />
        ) : null}
      </ListGroup>

      <Eyebrow>Your data</Eyebrow>
      <ListGroup>
        <ListRow label="Restore a backup" chevron onPress={() => void pick()} />
        <ListRow label="Send a backup file" chevron onPress={() => void backUp()} />
        <ListRow label="Spreadsheet (CSV)" value="Import, export" chevron onPress={() => router.push("/settings/transfer")} />
      </ListGroup>

      <View className="mt-8">
        <ListGroup>
          <ListRow label="Erase all data" destructive onPress={eraseAll} />
        </ListGroup>
      </View>

      <RestoreSheet
        summary={pending?.summary ?? null}
        busy={busy}
        onConfirm={restore}
        onClose={() => setPending(null)}
      />
    </ScrollView>
  );
}
