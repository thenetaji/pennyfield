import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Alert, ScrollView, View } from "react-native";

import { keyToLocalMs, toDateKey, type DateKey } from "@studio/dates";
import { currencySymbol, minorDigits } from "@studio/money";
import { haptic } from "@studio/theme";
import {
  barRight,
  Button,
  HeaderButton,
  Input,
  ListGroup,
  ListRow,
  Pressable,
  Text,
} from "@studio/ui";

import { useActions } from "@/data/actions";
import { useExpectedFlows, useInvestment } from "@/data/hooks";
import { DatePicker } from "@/features/transaction-form/date-picker";

import { parseMinor } from "./format";

type Line = {
  key: string;
  dateKey: DateKey;
  kind: "interest" | "principal";
  text: string;
};

let lineSeq = 0;
const nextKey = () => `l${(lineSeq += 1)}`;

/** The payouts the app expects; edit them to match the issuer's schedule exactly. */
export function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const actions = useActions();
  const detail = useInvestment(id);
  const { flows, entered } = useExpectedFlows(id);
  const currency = detail?.investment.currency ?? "INR";
  const digits = minorDigits(currency);
  const [lines, setLines] = React.useState<Line[] | null>(null);

  // Until the first edit, the lines are the expected flows; editing copies them into local state.
  const initial = React.useMemo(
    () =>
      flows.map((f, i) => ({
        key: `f${i}`,
        dateKey: f.dateKey,
        kind: f.kind,
        text: String(f.amount / 10 ** digits),
      })),
    [flows, digits],
  );

  if (!detail) return <View className="flex-1 bg-bg" />;
  const inv = detail.investment;
  const rows = lines ?? initial;
  const parsed = rows.map((l) => parseMinor(l.text, digits));
  const valid = parsed.every((v) => Number.isFinite(v) && v > 0);

  const patch = (key: string, change: Partial<Line>) =>
    setLines((prev) =>
      (prev ?? initial).map((l) => (l.key === key ? { ...l, ...change } : l)),
    );

  const save = () => {
    if (!valid) {
      haptic("error");
      return;
    }
    actions.investments.setSchedule(
      inv.id,
      rows.map((l, i) => ({
        dateKey: l.dateKey,
        kind: l.kind,
        amount: parsed[i] ?? 0,
      })),
    );
    haptic("success");
    router.back();
  };

  const reset = () =>
    Alert.alert(
      "Use the calculated schedule?",
      "Your entered dates and amounts are removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use calculated",
          style: "destructive",
          onPress: () => {
            actions.investments.setSchedule(inv.id, []);
            router.back();
          },
        },
      ],
    );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12 pt-2"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: "Payout schedule",
          ...barRight(
            <HeaderButton
              symbol="checkmark"
              label="Save schedule"
              onPress={save}
            />,
          ),
        }}
      />
      <Text variant="footnote" tone="secondary" className="px-8">
        {entered
          ? "Entered from the issuer's schedule. Pennyfield uses these dates and amounts for returns, Coming up and TDS."
          : "Worked out from the rate and dates. Change any date or amount to match the platform's schedule, then save."}
      </Text>
      <ListGroup>
        {rows.map((l, i) => (
          <View
            key={l.key}
            className="gap-2 border-b border-border bg-surface px-4 py-3"
          >
            <View className="flex-row items-center justify-between">
              <Pressable
                role="button"
                accessibilityLabel={`${l.kind === "interest" ? "Interest" : "Principal"}, tap to switch`}
                onPress={() =>
                  patch(l.key, {
                    kind: l.kind === "interest" ? "principal" : "interest",
                  })
                }
              >
                <Text variant="body" tone="accent">
                  {l.kind === "interest" ? "Interest" : "Principal back"}
                </Text>
              </Pressable>
              <DatePicker
                value={keyToLocalMs(l.dateKey, 12)}
                mode="date"
                display="compact"
                onChange={(ms) => patch(l.key, { dateKey: toDateKey(ms) })}
              />
            </View>
            <View className="flex-row items-center gap-3">
              <Text variant="body" tone="secondary">
                {currencySymbol(currency)}
              </Text>
              <Input
                variant="inline"
                value={l.text}
                onChangeText={(text) => patch(l.key, { text })}
                keyboardType="decimal-pad"
                returnKeyType="done"
                accessibilityLabel="Amount"
                className="h-6 min-h-0 flex-1 py-0"
              />
              <Pressable
                role="button"
                accessibilityLabel="Remove payout"
                onPress={() =>
                  setLines((prev) =>
                    (prev ?? initial).filter((x) => x.key !== l.key),
                  )
                }
              >
                <Text variant="footnote" tone="expense">
                  Remove
                </Text>
              </Pressable>
            </View>
            {Number.isFinite(parsed[i]) && (parsed[i] ?? 0) > 0 ? null : (
              <Text variant="footnote" tone="warning">
                Enter an amount
              </Text>
            )}
          </View>
        ))}
        <ListRow
          label="Add payout"
          icon={{ name: "add", color: "blue" }}
          onPress={() =>
            setLines((prev) => [
              ...(prev ?? initial),
              {
                key: nextKey(),
                dateKey: inv.maturityDate ?? inv.buyDate,
                kind: "interest",
                text: "",
              },
            ])
          }
        />
      </ListGroup>
      <View className="gap-3 px-4">
        <Button
          size="lg"
          onPress={save}
          disabled={!valid}
          accessibilityLabel="Save schedule"
        >
          Save schedule
        </Button>
        {entered ? (
          <Button
            variant="secondary"
            onPress={reset}
            accessibilityLabel="Use calculated schedule"
          >
            Use calculated schedule
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}
