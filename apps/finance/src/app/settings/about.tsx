import * as Updates from "expo-updates";
import * as React from "react";
import { Image, Linking, Platform, ScrollView, View } from "react-native";

import { ListGroup, ListRow, showToast, Text } from "@studio/ui";
import { APP_NAME, REPO_URL } from "@/constants/app";
import { useActions } from "@/data/actions";
import { LICENCES } from "@/features/about/licences";
import { checkForUpdates, type UpdateResult } from "@/features/about/updates";
import { appVersion } from "@/features/settings/groups";

const open = (url: string) =>
  void Linking.openURL(url).catch(() =>
    showToast({ message: "Couldn't open the link", haptic: "warning" }),
  );

function UpdateRow({ version }: { version: string }) {
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState<UpdateResult | null>(null);

  if (result?.kind === "release")
    return (
      <ListRow
        label={`Get version ${result.version}`}
        chevron
        onPress={() => open(result.url)}
      />
    );
  if (result?.kind === "ready")
    return (
      <ListRow
        label="Restart to update"
        chevron
        onPress={() => void Updates.reloadAsync()}
      />
    );
  return (
    <ListRow
      label="Check for updates"
      value={
        checking
          ? "Checking…"
          : result?.kind === "current"
            ? "Up to date"
            : undefined
      }
      onPress={() => {
        if (checking) return;
        setChecking(true);
        checkForUpdates(version)
          .then(setResult)
          .catch(() =>
            showToast({
              message: "Couldn't check for updates",
              haptic: "warning",
            }),
          )
          .finally(() => setChecking(false));
      }}
    />
  );
}

export default function About() {
  const actions = useActions();
  const version = appVersion();
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 py-4 pb-12"
    >
      <View className="items-center px-8 pt-2">
        <Image
          source={require("../../../assets/images/icon.png")}
          accessibilityIgnoresInvertColors
          style={{ width: 96, height: 96, borderRadius: 22 }}
        />
        <Text variant="title1" className="mt-4">
          {APP_NAME}
        </Text>
        <Text variant="subhead" tone="secondary">
          Version {version}
        </Text>
        <Text variant="subhead" className="mt-4">
          Made with ♥ by thenetaji
        </Text>
        <Text variant="footnote" tone="secondary" className="mt-1 text-center">
          Free to use. Your data stays on your phone.
        </Text>
      </View>
      <ListGroup>
        {Platform.OS === "web" ? null : <UpdateRow version={version} />}
        <ListRow
          label="Report a bug"
          chevron
          onPress={() =>
            open(
              `${REPO_URL}/issues/new?title=${encodeURIComponent(`${APP_NAME} ${version}: `)}`,
            )
          }
        />
        <ListRow label="Source code" chevron onPress={() => open(REPO_URL)} />
      </ListGroup>
      <ListGroup header="Licences">
        {LICENCES.map((item) => (
          <ListRow key={item.name} label={item.name} value={item.licence} />
        ))}
      </ListGroup>
      {__DEV__ ? (
        <ListGroup>
          <ListRow
            label="Load demo data"
            onPress={() => {
              actions.dev.seedDemo();
              showToast({ message: "Demo data loaded" });
            }}
          />
        </ListGroup>
      ) : null}
    </ScrollView>
  );
}
