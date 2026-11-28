import * as React from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, TextInput, View } from "react-native";


import {
  useCategories,
  useFirstEntryDay,
  useSetting,
  useTodayKey,
  useYearStart,
} from "@/data/hooks";
import { askGemini } from "@/lib/ask/gemini";
import { clearGeminiKey, readGeminiKey, saveGeminiKey } from "@/lib/ask/key-store";
import { minorDigits } from "@studio/money";
import { useExploreLines } from "@/data/hooks/useExploreLines";
import { ASK_INSTRUCTIONS, askDigest } from "@/lib/explore/ask-digest";
import { useTokens } from "@studio/theme";
import { Card, Chip, Pressable, SymbolIcon, Text } from "@studio/ui";

import { aiRespond } from "../../../modules/finance-ai";
import { useMoneyText } from "./shared";

const SUGGESTIONS = [
  "What did I spend most on last month?",
  "When did my income cross 20L this FY?",
  "Biggest purchases this year?",
];

type Turn = { question: string; answer: string | null };

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
  const [draftKey, setDraftKey] = React.useState("");
  const [text, setText] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);

  const ask = async (question: string) => {
    const asked = question.trim();
    if (!asked || busy) return;
    setText("");
    setBusy(true);
    setTurns((all) => [...all, { question: asked, answer: null }]);
    let answer: string | null;
    if (key) {
      try {
        answer = await askGemini(
          key,
          asked,
          turns.filter((t) => t.answer).map((t) => ({ question: t.question, answer: t.answer! })),
          lines,
          {
            today,
            digits: minorDigits(currency),
            currency,
            yearStart,
            categories: [...new Set(categories.map((c) => c.name))],
            firstEntry,
          },
        );
      } catch (e) {
        answer = e instanceof Error ? e.message : "Gemini could not be reached.";
      }
    } else {
      answer = await aiRespond(asked, ASK_INSTRUCTIONS(askDigest(lines, today, money)));
    }
    setTurns((all) =>
      all.map((turn, i) =>
        i === all.length - 1
          ? { ...turn, answer: answer ?? "Couldn't answer that. Try rephrasing." }
          : turn,
      ),
    );
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 px-4 pb-6 pt-2"
      >
        {key ? (
          <Text variant="subhead" tone="secondary">
            Answers come from Gemini with your key. The app works out the numbers on this phone; Gemini
            sees only the totals and entries it asks for.
          </Text>
        ) : (
          <Card className="gap-2 px-4 py-3">
            <Text variant="headline">Smarter answers with Gemini</Text>
            <Text variant="subhead" tone="secondary">
              The built-in model is small and only sees recent months. Paste a free Gemini API key and
              Ask can answer anything about all your entries.
            </Text>
            <Pressable
              role="link"
              scale={1}
              onPress={() => void Linking.openURL("https://aistudio.google.com/apikey")}
            >
              <Text variant="subhead" tone="accent">
                Get a free key at aistudio.google.com
              </Text>
            </Pressable>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={draftKey}
                onChangeText={setDraftKey}
                placeholder="Paste key"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                accessibilityLabel="Gemini API key"
                className="h-10 flex-1 rounded-full bg-fill px-4"
                style={{ color: colors.text, fontSize: 15 }}
              />
              <Chip
                label="Save"
                onPress={() => {
                  if (!draftKey.trim()) return;
                  saveGeminiKey(draftKey);
                  setKey(draftKey.trim());
                  setDraftKey("");
                }}
              />
            </View>
          </Card>
        )}
        {turns.length === 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onPress={() => void ask(s)} />
            ))}
          </View>
        ) : null}
        {turns.map((turn, i) => (
          <View key={i} className="gap-2">
            <Text variant="headline">{turn.question}</Text>
            <Card className="px-4 py-3">
              <Text variant="body" tone={turn.answer ? "default" : "secondary"}>
                {turn.answer ?? "Thinking…"}
              </Text>
            </Card>
          </View>
        ))}
        {key ? (
          <Pressable
            role="button"
            scale={1}
            className="self-start pt-2"
            onPress={() => {
              clearGeminiKey();
              setKey(null);
            }}
          >
            <Text variant="footnote" tone="tertiary">
              Remove Gemini key
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <View className="flex-row items-center gap-2 px-4 pb-6 pt-2">
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void ask(text)}
          placeholder="Ask about your spending"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="send"
          accessibilityLabel="Ask about your spending"
          className="h-11 flex-1 rounded-full bg-surface px-4"
          style={{ color: colors.text, fontSize: 17 }}
        />
        <Pressable
          role="button"
          accessibilityLabel="Send"
          disabled={!text.trim() || busy}
          scale={0.92}
          onPress={() => void ask(text)}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accent, opacity: !text.trim() || busy ? 0.4 : 1 }}
        >
          <SymbolIcon name="arrow.up" size={17} color={colors.bg} weight="bold" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
