import { Stack, useLocalSearchParams } from "expo-router";

import { useSettingGroups } from "@/features/settings/groups";
import { SettingsGroupScreen } from "@/features/settings/settings-screen";

export default function SettingsGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const title = useSettingGroups().find((g) => g.id === id)?.title ?? "Settings";
  return (
    <>
      <Stack.Screen options={{ title }} />
      <SettingsGroupScreen id={id} />
    </>
  );
}
