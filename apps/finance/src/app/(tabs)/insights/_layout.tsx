import { Stack } from "expo-router";

import { useTabStackOptions } from "@studio/ui";

export default function InsightsLayout() {
  const options = useTabStackOptions({ tinted: true });
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Insights" }} />
    </Stack>
  );
}
