import { Stack, useRouter } from "expo-router";

import { HeaderButton, barRight, useTabStackOptions } from "@studio/ui";

export const unstable_settings = { initialRouteName: "index" };

export default function AdvancedLayout() {
  const options = useTabStackOptions();
  const router = useRouter();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Advanced" }} />
      <Stack.Screen
        name="budgets"
        options={{
          title: "Budgets",
          ...barRight(
            <HeaderButton
              symbol="plus"
              label="Add budget"
              onPress={() => router.push("/budget/new")}
            />,
          ),
        }}
      />
    </Stack>
  );
}
