import { Stack } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import {
  useCategories,
  useFirstEntryDay,
  useSetting,
  useTodayKey,
  useYearStart,
} from "@/data/hooks";
import { useExploreLines } from "@/data/hooks/useExploreLines";
import { AskError, askGemini, type AskLogEntry, type AskStep } from "@/lib/ask/gemini";
import { clearGeminiKey, readGeminiKey, saveGeminiKey } from "@/lib/ask/key-store";
import { ASK_INSTRUCTIONS, askDigest } from "@/lib/explore/ask-digest";
import { minorDigits } from "@studio/money";
import { haptic, useTokens } from "@studio/theme";
import { Card, Pressable, SymbolIcon, Text } from "@studio/ui";

import { aiRespond } from "../../../modules/finance-ai";
import { useMoneyText } from "./shared";

const SUGGESTIONS = [
  "What did I spend most on last month?",
  "When did my income cross 20L this FY?",
  "Biggest purchases this year?",
  "How much on Zomato and Swiggy this FY?",
];

type Turn = {
  question: string;
  answer: string | null;
  steps: AskStep[];
  failed?: boolean;
  status?: string;
  log?: AskLogEntry[];
  detail?: string;
};

/** Seconds since `since`, ticking while the answer is on its way. */
function useElapsed(since: number | null): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [since]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

function Pending({ turn, since }: { turn: Turn; since: number | null }) {
  const { colors } = useTokens();
  const seconds = useElapsed(since);
  const last = turn.steps[turn.steps.length - 1];
  return (
    <View className="flex-row items-center gap-2">
      <ActivityIndicator size="small" color={colors.textSecondary} />
      <Text variant="subhead" tone="secondary" numberOfLines={1} className="flex-1">
        {last && turn.status?.startsWith("Looked up") ? `${stepLabel(last)}…` : `${turn.status ?? "Starting"}…`}
      </Text>
      <Text variant="footnote" tone="tertiary" numeric>
        {`${seconds}s`}
      </Text>
    </View>
  );
}

function Details({ turn }: { turn: Turn }) {
  const { colors } = useTokens();
  const [open, setOpen] = React.useState(false);
  if (!turn.log?.length) return null;
  return (
    <View className="gap-2">
      <Pressable role="button" scale={1} dimTo={0.6} onPress={() => setOpen((v) => !v)} className="flex-row items-center gap-1.5 self-start">
        <SymbolIcon name="info.circle" size={12} color={colors.textTertiary} />
        <Text variant="footnote" tone="tertiary">
          {open ? "Hide details" : "Details"}
        </Text>
      </Pressable>
      {open ? (
        <Card className="gap-1 px-4 py-3">
          {turn.log.map((entry, i) => (
            <Text key={i} variant="caption" tone="secondary" numeric>
              {`${(entry.ms / 1000).toFixed(1)}s  ${entry.text}`}
            </Text>
          ))}
          {turn.detail ? (
            <Text variant="caption" tone="tertiary" selectable className="pt-1">
              {turn.detail}
            </Text>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

const TOOL_ICONS: Record<string, string> = {
  total: "sum",
  by_month: "chart.bar",
  top: "list.number",
  milestone: "flag",
  entries: "list.bullet",
};

/** "Total income · Salary · 2026-04-01 to today": what a lookup was asked, in words. */
function stepLabel(step: AskStep): string {
  const a = step.args;
  const kind = a.kind === "income" ? "income" : "spending";
  const what = [a.category, a.payee].filter((v) => typeof v === "string" && v).join(" · ");
  const period =
    a.from || a.to ? `${(a.from as string) ?? "start"} to ${(a.to as string) ?? "today"}` : "all time";
  const head: Record<string, string> = {
    total: `Total ${kind}`,
    by_month: `${kind === "income" ? "Income" : "Spending"} by month`,
    top: `Top ${a.by === "payee" ? "payees" : "categories"}`,
    milestone: `When ${kind} reached ${Number(a.amount ?? 0).toLocaleString("en-IN")}`,
    entries: `${a.sort === "date" ? "Latest" : "Biggest"} entries`,
  };
  return [head[step.name] ?? step.name, what, period].filter(Boolean).join(" · ");
}

/** The lookup's answer as short lines, not raw JSON. */
function resultLines(result: unknown): string[] {
  const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : String(v));
  if (Array.isArray(result)) {
    const rows = result.map((r) =>
      r && typeof r === "object" ? Object.values(r).map(fmt).join(" · ") : fmt(r),
    );
    if (rows.length === 0) return ["nothing found"];
    return rows.length > 8 ? [...rows.slice(0, 8), `+${rows.length - 8} more`] : rows;
  }
  return result && typeof result === "object"
    ? [
        Object.entries(result)
          .map(([k, v]) => `${k} ${fmt(v)}`)
          .join(" · "),
      ]
    : [fmt(result)];
}

function StepRow({ step }: { step: AskStep }) {
  const { colors } = useTokens();
  return (
    <View className="flex-row gap-3 px-4 py-3">
      <SymbolIcon name={TOOL_ICONS[step.name] ?? "wrench"} size={14} color={colors.accent} />
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="footnote" className="font-semibold">
          {stepLabel(step)}
        </Text>
        {resultLines(step.result).map((line, i) => (
          <Text key={i} variant="caption" tone="secondary" numeric>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Steps({ steps }: { steps: AskStep[] }) {
  const { colors } = useTokens();
  const [open, setOpen] = React.useState(false);
  if (steps.length === 0) return null;
  return (
    <View className="gap-2">
      <Pressable
        role="button"
        scale={1}
        dimTo={0.6}
        accessibilityLabel={`${open ? "Hide" : "Show"} the ${steps.length} lookups used`}
        onPress={() => {
          haptic("selection");
          setOpen((v) => !v);
        }}
        className="flex-row items-center gap-1.5 self-start"
      >
        <SymbolIcon name="wrench.and.screwdriver" size={12} color={colors.textTertiary} />
        <Text variant="footnote" tone="tertiary">
          {`Used ${steps.length} lookup${steps.length === 1 ? "" : "s"}`}
        </Text>
        <SymbolIcon name={open ? "chevron.up" : "chevron.down"} size={10} color={colors.textTertiary} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(180)}>
          <Card className="p-0">
            {steps.map((step, i) => (
              <View key={i} className={i > 0 ? "border-t border-separator" : ""}>
                <StepRow step={step} />
              </View>
            ))}
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function KeyCard({ onSave }: { onSave: (key: string) => void }) {
  const { colors } = useTokens();
  const [draft, setDraft] = React.useState("");
  return (
    <Card className="gap-3 px-4 py-4">
      <View className="flex-row items-center gap-2.5">
        <View
          className="h-8 w-8 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: colors.accentSoft }}
        >
          <SymbolIcon name="sparkles" size={16} color={colors.accent} />
        </View>
        <Text variant="headline">Smarter answers with Gemini</Text>
      </View>
      <Text variant="subhead" tone="secondary">
        The built-in model is small and only sees recent months. With a free Gemini key, Ask can answer
        anything about all your entries.
      </Text>
      <Pressable
        role="link"
        scale={1}
        dimTo={0.6}
        onPress={() => void Linking.openURL("https://aistudio.google.com/apikey")}
      >
        <Text variant="subhead" tone="accent">
          Get a free key at aistudio.google.com
        </Text>
      </Pressable>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Paste key"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          accessibilityLabel="Gemini API key"
          className="h-11 flex-1 rounded-full bg-fill px-4"
          style={{ color: colors.text, fontSize: 15 }}
        />
        <Pressable
          role="button"
          accessibilityLabel="Save key"
          disabled={!draft.trim()}
          scale={0.95}
          onPress={() => onSave(draft.trim())}
          className="h-11 items-center justify-center rounded-full px-5"
          style={{ backgroundColor: colors.accent, opacity: draft.trim() ? 1 : 0.4 }}
        >
          <Text variant="headline" style={{ color: colors.bg }}>
            Save
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function AskScreen() {
  const { colors } = useTokens();
  const money = useMoneyText();
  const today = useTodayKey();
  const lines = useExploreLines("0000-01-01", today);
  const [currency] = useSetting("display_currency");
  const yearStart = useYearStart();
  const categories = useCategories();
  const firstEntry = useFirstEntryDay();
  const [key, setKey] = React.useState<string | null>(() => readGeminiKey());
  const [text, setText] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [since, setSince] = React.useState<number | null>(null);
  const scroll = React.useRef<ScrollView>(null);

  const updateLast = (patch: (t: Turn) => Turn) =>
    setTurns((all) => all.map((t, i) => (i === all.length - 1 ? patch(t) : t)));

  const ask = async (question: string) => {
    const asked = question.trim();
    if (!asked || busy) return;
    setText("");
    setBusy(true);
    setSince(Date.now());
    setTurns((all) => [...all, { question: asked, answer: null, steps: [] }]);
    if (key) {
      try {
        const result = await askGemini(
          key,
          asked,
          turns
            .filter((t) => t.answer && !t.failed)
            .map((t) => ({ question: t.question, answer: t.answer! })),
          lines,
          {
            today,
            digits: minorDigits(currency),
            currency,
            yearStart,
            categories: [...new Set(categories.map((c) => c.name))],
            firstEntry,
          },
          (step) => updateLast((t) => ({ ...t, steps: [...t.steps, step] })),
          (status) => updateLast((t) => ({ ...t, status })),
        );
        updateLast((t) => ({ ...t, answer: result.text, log: result.log }));
      } catch (e) {
        updateLast((t) => ({
          ...t,
          answer: e instanceof Error ? e.message : "Gemini could not be reached.",
          failed: true,
          log: e instanceof AskError ? e.log : t.log,
          detail: e instanceof AskError ? e.detail : String(e),
        }));
      }
    } else {
      const answer = await aiRespond(asked, ASK_INSTRUCTIONS(askDigest(lines, today, money)));
      updateLast((t) => ({
        ...t,
        answer: answer ?? "Couldn't answer that. Try rephrasing.",
        failed: !answer,
      }));
    }
    setBusy(false);
    setSince(null);
  };

  const retry = (index: number) => {
    const question = turns[index]?.question;
    if (!question || busy) return;
    setTurns((all) => all.filter((_, i) => i !== index));
    void ask(question);
  };

  const keyMenu = () =>
    Alert.alert("Gemini key", "Ask uses your Gemini key. Remove it to go back to the on-phone model.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove key",
        style: "destructive",
        onPress: () => {
          clearGeminiKey();
          setKey(null);
        },
      },
    ]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          headerRight: key
            ? () => (
                <Pressable
                  role="button"
                  accessibilityLabel="Gemini key"
                  hitSlop={10}
                  scale={0.9}
                  onPress={keyMenu}
                >
                  <SymbolIcon name="key" size={17} color={colors.text} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerClassName="gap-6 px-4 pb-6 pt-3"
      >
        {!key ? (
          <KeyCard
            onSave={(next) => {
              saveGeminiKey(next);
              setKey(next);
            }}
          />
        ) : null}
        {turns.length === 0 ? (
          <View className="gap-3 pt-2">
            <Text variant="title2">Ask about your money</Text>
            <Text variant="subhead" tone="secondary">
              {key
                ? "Gemini answers; the numbers are worked out on this phone from all your entries."
                : "Answers come from the small on-phone model and can be wrong."}
            </Text>
            <View className="gap-2 pt-1">
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  role="button"
                  scale={0.98}
                  onPress={() => void ask(s)}
                  className="flex-row items-center justify-between rounded-2xl bg-surface px-4 py-3.5"
                >
                  <Text variant="callout" className="flex-1 pr-3">
                    {s}
                  </Text>
                  <SymbolIcon name="arrow.up.right" size={12} color={colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {turns.map((turn, i) => (
          <Animated.View key={i} entering={FadeInDown.duration(220)} className="gap-3">
            <View
              className="max-w-[85%] self-end rounded-[20px] rounded-br-[6px] px-4 py-2.5"
              style={{ backgroundColor: colors.elevated }}
            >
              <Text variant="body">
                {turn.question}
              </Text>
            </View>
            <View className="gap-2.5 pr-6">
              {turn.answer === null ? (
                <Pending turn={turn} since={since} />
              ) : (
                <Text variant="body" tone={turn.failed ? "secondary" : "default"} selectable>
                  {turn.answer}
                </Text>
              )}
              {turn.failed && i === turns.length - 1 ? (
                <Pressable
                  role="button"
                  scale={0.96}
                  onPress={() => retry(i)}
                  className="h-9 flex-row items-center gap-1.5 self-start rounded-full bg-fill px-3.5"
                >
                  <SymbolIcon name="arrow.clockwise" size={12} color={colors.text} />
                  <Text variant="footnote" className="font-semibold">
                    Try again
                  </Text>
                </Pressable>
              ) : null}
              {turn.answer !== null ? (
                <View className="flex-row flex-wrap gap-x-4 gap-y-2">
                  <Steps steps={turn.steps} />
                  <Details turn={turn} />
                </View>
              ) : null}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
      <View className="px-4 pb-6 pt-2">
        <View
          className="flex-row items-center gap-2 rounded-full bg-surface pl-4 pr-1.5"
          style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void ask(text)}
            placeholder="Ask about your money"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="send"
            accessibilityLabel="Ask about your money"
            className="flex-1"
            style={{ color: colors.text, fontSize: 17, paddingVertical: 10 }}
          />
          <Pressable
            role="button"
            accessibilityLabel="Send"
            disabled={!text.trim() || busy}
            scale={0.92}
            onPress={() => void ask(text)}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.accent, opacity: !text.trim() || busy ? 0.35 : 1 }}
          >
            <SymbolIcon name="arrow.up" size={15} color={colors.bg} weight="bold" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
