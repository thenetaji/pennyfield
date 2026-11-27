import { HomeSectionHeader } from "./section-header";
import { useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { IconTile, Pressable, SymbolIcon, Text } from "@studio/ui";
import {
  useAccounts,
  useCategories,
  usePeople,
  useQuickAdd,
  useSetting,
  useTitleMemory,
  useTodayKey,
} from "@/data/hooks";
import { aiReadLine } from "@/lib/quick-line/ai";
import { guessCategories } from "@/lib/quick-line/guess";
import { parseQuickLine } from "@/lib/quick-line/parse";
import { addDays, dayLabel } from "@studio/dates";
import { formatMoney, minorDigits } from "@studio/money";
import { useTokens } from "@studio/theme";
import type { CategoryColorKey } from "@studio/theme";

const LIMIT = 8;

function LineChip({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone?: "accent" | "soft";
  onPress?: () => void;
}) {
  const { colors } = useTokens();
  const body = (
    <View
      className="h-7 flex-row items-center gap-1 rounded-full px-2.5"
      style={{ backgroundColor: tone === "accent" ? colors.accentSoft : colors.fill }}
    >
      <Text
        variant="footnote"
        numeric
        numberOfLines={1}
        style={{ color: tone === "accent" ? colors.accentText : colors.text }}
      >
        {label}
      </Text>
      {onPress ? <SymbolIcon name="arrow.triangle.2.circlepath" size={10} color={colors.textSecondary} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable role="button" accessibilityLabel={`${label}, tap for another`} scale={0.95} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Type or dictate "spent 250 on uber yesterday" and the Add sheet opens filled in, ready to check and save. */
function QuickLineField() {
  const router = useRouter();
  const { colors } = useTokens();
  const accounts = useAccounts();
  const categories = useCategories();
  const people = usePeople();
  const memory = useTitleMemory();
  const today = useTodayKey();
  const [currency] = useSetting("display_currency");
  const [text, setText] = React.useState("");
  const [pick, setPick] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const digits = minorDigits(currency);
  const line = parseQuickLine(text, { accounts, categories, people, memory, digits, today });
  const lending = line.kind === "lent" || line.kind === "borrowed";
  const options = lending
    ? []
    : [
        ...new Set(
          [
            line.categoryId,
            ...guessCategories(line.title, line.kind as "expense" | "income", { categories, memory }),
          ].filter((id): id is string => !!id),
        ),
      ];
  const categoryId = options.length > 0 ? options[pick % options.length]! : null;
  const ready = line.amount !== null || line.title !== "";
  const date = line.daysAgo > 0 ? addDays(today, -line.daysAgo) : null;
  const person = line.personId ? people.find((p) => p.id === line.personId)?.name : line.personName;

  const open = (l: typeof line, cat: string | null) => {
    const params: Record<string, string> = {};
    if (l.title) params.title = l.title;
    if (l.amount !== null) {
      params.amount = String(l.amount);
      params.currency = currency;
    }
    if (l.accountId) params.accountId = l.accountId;
    if (cat && !(l.kind === "lent" || l.kind === "borrowed")) params.categoryId = cat;
    if (l.kind !== "expense") params.kind = l.kind;
    if (l.daysAgo > 0) params.date = addDays(today, -l.daysAgo);
    if (l.personId) params.personId = l.personId;
    if (l.memo) params.memo = l.memo;
    setText("");
    setPick(0);
    router.push({ pathname: "/transaction/new", params });
  };

  const submit = async () => {
    if (busy || text.trim() === "") return;
    // The rules read most lines; the on-device model only fills what they missed.
    if (line.amount === null || (!lending && line.title === "")) {
      setBusy(true);
      const ai = await aiReadLine(text, {
        categories: categories.map((c) => c.name),
        accounts: accounts.map((a) => a.name),
      });
      setBusy(false);
      if (ai) {
        const byName = <T extends { name: string }>(list: readonly T[], name?: string) =>
          name ? list.find((x) => x.name.toLowerCase() === name.toLowerCase()) : undefined;
        const merged = {
          ...line,
          title: line.title || ai.title || "",
          amount: line.amount ?? (ai.amount !== undefined ? Math.round(ai.amount * 10 ** digits) : null),
          kind: line.kind === "expense" && ai.kind ? ai.kind : line.kind,
          accountId: line.accountId ?? byName(accounts, ai.account)?.id ?? null,
          daysAgo: line.daysAgo || ai.daysAgo || 0,
          personId: line.personId ?? byName(people, ai.person)?.id ?? null,
        };
        open(merged, categoryId ?? byName(categories, ai.category)?.id ?? null);
        return;
      }
    }
    if (ready) open(line, categoryId);
  };

  const chips: React.ReactNode[] = [];
  if (line.amount !== null)
    chips.push(<LineChip key="amt" tone="accent" label={formatMoney(line.amount, currency, { sign: "none" })} />);
  if (line.kind === "income") chips.push(<LineChip key="kind" label="Income" />);
  if (lending) chips.push(<LineChip key="kind" label={line.kind === "lent" ? "Lent" : "Borrowed"} />);
  if (person) chips.push(<LineChip key="person" label={person} />);
  if (line.title) chips.push(<LineChip key="title" label={line.title} />);
  if (categoryId) {
    const name = categories.find((c) => c.id === categoryId)?.name ?? "";
    chips.push(
      <LineChip
        key="cat"
        label={name}
        tone="accent"
        onPress={options.length > 1 ? () => setPick((n) => n + 1) : undefined}
      />,
    );
  }
  if (line.accountId)
    chips.push(<LineChip key="acc" label={accounts.find((a) => a.id === line.accountId)?.name ?? ""} />);
  if (date) chips.push(<LineChip key="date" label={dayLabel(date, today)} />);
  if (line.splitCount > 1) chips.push(<LineChip key="split" label={`Your share of ${line.splitCount}`} />);

  return (
    <View>
      <View
        className="h-11 flex-row items-center gap-2 rounded-full bg-surface pl-4 pr-1.5"
        style={{ borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border }}
      >
        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(next);
            setPick(0);
          }}
          onSubmitEditing={() => void submit()}
          placeholder="Type or say: zomato 349 yesterday"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="go"
          autoCorrect={false}
          accessibilityLabel="Add by typing or dictating"
          style={{ flex: 1, color: colors.text, fontSize: 16, padding: 0 }}
        />
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
        ) : ready || text.trim() !== "" ? (
          <Pressable
            role="button"
            accessibilityLabel="Open in Add"
            scale={0.9}
            onPress={() => void submit()}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.accent }}
          >
            <SymbolIcon name="arrow.up" size={14} color={colors.bg} weight="bold" />
          </Pressable>
        ) : null}
      </View>
      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          className="-mx-4 mt-2"
          contentContainerClassName="gap-1.5 px-4"
        >
          {chips}
        </ScrollView>
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
