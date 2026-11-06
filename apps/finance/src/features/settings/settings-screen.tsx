import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccounts, useSetting } from "@/data/hooks";
import { backupTimeLabel } from "@/features/backup/format";
import { useTokens } from "@studio/theme";
import { Pressable, SymbolIcon, Text } from "@studio/ui";

import { appVersion, searchRows, useSettingGroups, type PickerId } from "./groups";
import {
  FoldedNote,
  GroupPickers,
  GroupRow,
  LinkRow,
  RowCard,
  SectionTitle,
  StylePicker,
  useRowSkin,
  type RowSkin,
} from "./settings-rows";

function SummaryCard({ skin }: { skin: RowSkin }) {
  const router = useRouter();
  const accounts = useAccounts();
  const [currency] = useSetting("display_currency");
  const [lastBackup] = useSetting("last_backup_at");
  return (
    <Pressable
      role="button"
      accessibilityLabel="Your accounts"
      scale={0.99}
      onPress={() => router.push("/accounts")}
      className="mx-4 flex-row items-center gap-3 px-4 py-4"
      style={{ backgroundColor: skin.surface, borderRadius: 22 }}
    >
      <View className="flex-1 gap-0.5">
        <Text variant="headline" style={{ color: skin.text }}>
          {`${accounts.length} ${accounts.length === 1 ? "account" : "accounts"} in ${currency}`}
        </Text>
        <Text variant="footnote" style={{ color: skin.secondary }}>
          {lastBackup
            ? `Last backup ${backupTimeLabel(lastBackup)}`
            : "On this device, not backed up"}
        </Text>
      </View>
      <SymbolIcon name="chevron.right" size={13} color={skin.tertiary} weight="bold" />
    </Pressable>
  );
}

function SearchField({
  query,
  onChange,
  skin,
}: {
  query: string;
  onChange: (text: string) => void;
  skin: RowSkin;
}) {
  return (
    <View
      className="mx-4 h-11 flex-row items-center gap-2 px-3"
      style={{ backgroundColor: skin.surface, borderRadius: 14 }}
    >
      <SymbolIcon name="magnifyingglass" size={15} color={skin.tertiary} />
      <TextInput
        value={query}
        onChangeText={onChange}
        placeholder="Search settings"
        placeholderTextColor={skin.tertiary}
        accessibilityLabel="Search settings"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{ flex: 1, color: skin.text, fontSize: 17, padding: 0 }}
      />
    </View>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTokens();
  const [style] = useSetting("settings_style");
  const groups = useSettingGroups();
  const [query, setQuery] = React.useState("");
  const [picker, setPicker] = React.useState<PickerId | null>(null);
  const glass = style === "glass";
  const skin = useRowSkin(glass);
  const hits = searchRows(groups, query);
  const searching = query.trim().length > 0;

  return (
    <View className="flex-1" style={{ backgroundColor: glass ? "#000" : colors.bg }}>
      {glass ? (
        <>
          <StatusBar style="light" />
          <LinearGradient
            colors={["rgba(148,163,184,0.34)", "rgba(148,163,184,0)"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
          />
        </>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 64, gap: 16 }}
      >
        <View className="flex-row items-center justify-between px-5">
          <Text variant="largeTitle" accessibilityRole="header" style={{ color: skin.text }}>
            Settings
          </Text>
          <Pressable role="button" accessibilityLabel="Done" hitSlop={10} scale={0.96} onPress={() => router.dismiss()}>
            <Text variant="headline" style={{ color: glass ? "#fff" : colors.accentText }}>
              Done
            </Text>
          </Pressable>
        </View>

        {style !== "list" ? <SummaryCard skin={skin} /> : null}
        <SearchField query={query} onChange={setQuery} skin={skin} />

        {searching ? (
          <View className="px-4">
            {hits.length > 0 ? (
              <RowCard skin={skin}>
                {hits.map(({ group, row }) => (
                  <LinkRow
                    key={row.key}
                    label={row.label}
                    caption={group.title}
                    skin={skin}
                    onPress={() => {
                      if (row.href) router.push(row.href);
                      else
                        router.push({
                          pathname: "/settings/group/[id]",
                          params: { id: group.id },
                        });
                    }}
                  />
                ))}
              </RowCard>
            ) : (
              <Text variant="callout" className="py-8 text-center" style={{ color: skin.secondary }}>
                {`Nothing called "${query.trim()}"`}
              </Text>
            )}
          </View>
        ) : style === "list" ? (
          <View className="gap-6 px-4">
            {groups.map((group) => (
              <View key={group.id}>
                <SectionTitle title={group.title} skin={skin} />
                <RowCard skin={skin}>
                  {group.rows.map((row) => (
                    <GroupRow key={row.key} row={row} skin={skin} onPicker={setPicker} />
                  ))}
                </RowCard>
                {group.note ? <FoldedNote text={group.note} skin={skin} /> : null}
              </View>
            ))}
            <RowCard skin={skin}>
              {[
                <LinkRow
                  key="about"
                  label="About"
                  value={appVersion()}
                  skin={skin}
                  onPress={() => router.push("/settings/about")}
                />,
              ]}
            </RowCard>
          </View>
        ) : (
          <View className="gap-3 px-4">
            <RowCard skin={skin}>
              {groups.map((group) => (
                <LinkRow
                  key={group.id}
                  label={group.title}
                  caption={group.summary}
                  skin={skin}
                  onPress={() =>
                    router.push({
                      pathname: "/settings/group/[id]",
                      params: { id: group.id },
                    })
                  }
                />
              ))}
            </RowCard>
            <RowCard skin={skin}>
              {[
                <LinkRow
                  key="about"
                  label="About"
                  value={appVersion()}
                  skin={skin}
                  onPress={() => router.push("/settings/about")}
                />,
                <StylePicker key="style" skin={skin} />,
              ]}
            </RowCard>
          </View>
        )}
      </ScrollView>
      <GroupPickers open={picker} onClose={() => setPicker(null)} />
    </View>
  );
}

/** One group's rows on their own page. */
export function SettingsGroupScreen({ id }: { id: string }) {
  const { colors } = useTokens();
  const [style] = useSetting("settings_style");
  const groups = useSettingGroups();
  const [picker, setPicker] = React.useState<PickerId | null>(null);
  const glass = style === "glass";
  const skin = useRowSkin(glass);
  const group = groups.find((g) => g.id === id);
  if (!group) return null;
  return (
    <View className="flex-1" style={{ backgroundColor: glass ? "#000" : colors.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, paddingBottom: 64 }}
      >
        <SectionTitle title={group.title} skin={skin} />
        <RowCard skin={skin}>
          {group.rows.map((row) => (
            <GroupRow key={row.key} row={row} skin={skin} onPicker={setPicker} />
          ))}
        </RowCard>
        {group.note ? <FoldedNote text={group.note} skin={skin} /> : null}
      </ScrollView>
      <GroupPickers open={picker} onClose={() => setPicker(null)} />
    </View>
  );
}
