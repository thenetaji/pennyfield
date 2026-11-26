import { useRouter } from "expo-router";
import * as React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTokens } from "@studio/theme";
import { Pressable, SymbolIcon, Text } from "@studio/ui";

import { searchRows, useSettingGroups, type PickerId, type SettingGroup } from "./groups";
import {
  FoldedNote,
  GroupPickers,
  GroupRow,
  LinkRow,
  RowCard,
  SectionTitle,
  useRowSkin,
  type RowSkin,
} from "./settings-rows";

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

/** Groups with their rows inline; the pickers open from the rows. */
function GroupList({ groups, skin }: { groups: readonly SettingGroup[]; skin: RowSkin }) {
  const [picker, setPicker] = React.useState<PickerId | null>(null);
  return (
    <View className="gap-7 px-4">
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
      <GroupPickers open={picker} onClose={() => setPicker(null)} />
    </View>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTokens();
  const all = useSettingGroups();
  const groups = all.filter((g) => g.id !== "more");
  const [query, setQuery] = React.useState("");
  const skin = useRowSkin();
  const hits = searchRows(all, query);
  const searching = query.trim().length > 0;

  const header = (
    <>
      <View className="flex-row items-center justify-between px-5">
        <Text variant="largeTitle" accessibilityRole="header" style={{ color: skin.text }}>
          Settings
        </Text>
        <Pressable role="button" accessibilityLabel="Done" hitSlop={10} scale={0.96} onPress={() => router.dismiss()}>
          <Text variant="headline" style={{ color: colors.accentText }}>
            Done
          </Text>
        </Pressable>
      </View>
      <SearchField query={query} onChange={setQuery} skin={skin} />
    </>
  );

  const results = (
    <View className="px-4">
      {hits.length > 0 ? (
        <RowCard skin={skin}>
          {hits.map(({ group, row }) => (
            <LinkRow
              key={`${group.id}-${row.key}`}
              icon={row.icon}
              label={row.label}
              caption={group.title}
              skin={skin}
              onPress={() => {
                if (row.href) router.push(row.href);
                else if (group.id === "more") router.push("/settings/more");
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
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.accentSoft, colors.bg]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 64, gap: 16 }}
      >
        {header}
        {searching ? results : <GroupList groups={groups} skin={skin} />}
      </ScrollView>
    </View>
  );
}

/** The small options, on their own page. */
export function SettingsMoreScreen() {
  const { colors } = useTokens();
  const skin = useRowSkin();
  const group = useSettingGroups().find((g) => g.id === "more");
  if (!group) return null;
  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 64 }}
      >
        <GroupList groups={[{ ...group, title: "" }]} skin={skin} />
      </ScrollView>
    </View>
  );
}

/** One group's rows on their own page, reached from a search hit. */
export function SettingsGroupScreen({ id }: { id: string }) {
  const { colors } = useTokens();
  const skin = useRowSkin();
  const group = useSettingGroups().find((g) => g.id === id);
  if (!group) return null;
  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 64 }}
      >
        <GroupList groups={[group]} skin={skin} />
      </ScrollView>
    </View>
  );
}
