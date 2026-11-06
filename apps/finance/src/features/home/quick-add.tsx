import { HomeSectionHeader } from "./section-header";
import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { IconTile, Pressable, SymbolIcon, Text } from "@studio/ui";
import {
  useAccounts,
  useCategories,
  useQuickAdd,
  useSetting,
  useTodayKey,
} from "@/data/hooks";
import { parseQuickLine } from "@/lib/quick-line/parse";
import { addDays } from "@studio/dates";
import { formatMoney, minorDigits } from "@studio/money";
import { useTokens } from "@studio/theme";
import type { CategoryColorKey } from "@studio/theme";

const LIMIT = 8;

/** Type "uber 250 card yesterday" and the Add sheet opens filled in, ready to check and save. */
function QuickLineField() {
  const router = useRouter();
  const { colors } = useTokens();
  const accounts = useAccounts();
  const categories = useCategories();
  const today = useTodayKey();
  const [currency] = useSetting("display_currency");
  const [text, setText] = React.useState("");
  const line = parseQuickLine(text, {
    accounts,
    categories,
    digits: minorDigits(currency),
  });
  const ready = line.amount !== null || line.title !== "";
  const preview = [
    line.amount !== null ? formatMoney(line.amount, currency, { sign: "none" }) : null,
    line.title || null,
    categories.find((c) => c.id === line.categoryId)?.name,
    accounts.find((a) => a.id === line.accountId)?.name,
    line.daysAgo === 1 ? "yesterday" : null,
    line.kind === "income" ? "income" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const submit = () => {
    if (!ready) return;
    const params: Record<string, string> = {};
    if (line.title) params.title = line.title;
    if (line.amount !== null) {
      params.amount = String(line.amount);
      params.currency = currency;
    }
    if (line.accountId) params.accountId = line.accountId;
    if (line.categoryId) params.categoryId = line.categoryId;
    if (line.kind === "income") params.kind = "income";
    if (line.daysAgo > 0) params.date = addDays(today, -line.daysAgo);
    setText("");
    router.push({ pathname: "/transaction/new", params });
  };
  return (
    <View>
      <View
        className="h-11 flex-row items-center gap-2 rounded-full bg-surface pl-4 pr-1.5"
        style={{ borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="uber 250 card yesterday"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="go"
          autoCorrect={false}
          accessibilityLabel="Add by typing"
          style={{ flex: 1, color: colors.text, fontSize: 16, padding: 0 }}
        />
        {ready ? (
          <Pressable
            role="button"
            accessibilityLabel="Open in Add"
            scale={0.9}
            onPress={submit}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.accent }}
          >
            <SymbolIcon name="arrow.up" size={14} color={colors.bg} weight="bold" />
          </Pressable>
        ) : null}
      </View>
      {preview ? (
        <Text variant="footnote" tone="secondary" numeric numberOfLines={1} className="px-4 pt-1.5">
          {preview}
        </Text>
      ) : null}
    </View>
  );
}

/** Eyebrow plus chips for the most frequent title + category pairs; a tap opens the add sheet with the keypad ready. */
function QuickAdd() {
  const router = useRouter();
  const { colors } = useTokens();
  const entries = useQuickAdd(LIMIT);
  const categories = useCategories();
  const byId = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  return (
    <View>
      <HomeSectionHeader title="Quick add" />
      <QuickLineField />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4 mt-2.5"
        contentContainerClassName="gap-2 px-4"
      >
        {entries.map((entry) => {
          const category = entry.categoryId
            ? byId.get(entry.categoryId)
            : undefined;
          const params: Record<string, string> = {
            title: entry.title,
            accountId: entry.accountId,
          };
          if (entry.kind === "income") params.kind = "income";
          if (entry.categoryId) params.categoryId = entry.categoryId;
          return (
            <Pressable
              key={`${entry.title}:${entry.categoryId ?? ""}`}
              role="button"
              accessibilityLabel={`Add ${entry.title}`}
              haptic="light"
              scale={0.94}
              onPress={() =>
                router.push({ pathname: "/transaction/new", params })
              }
              className="h-10 flex-row items-center gap-2 rounded-full bg-surface pl-2 pr-[15px]"
              style={{
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: colors.border,
              }}
            >
              <IconTile
                icon={category?.icon ?? "tag.fill"}
                color={(category?.color ?? "gray") as CategoryColorKey}
                size={26}
              />
              <Text
                variant="footnote"
                numberOfLines={1}
                className="max-w-[150px] text-[14px] font-semibold tracking-[-0.1px]"
              >
                {entry.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export { QuickAdd };
