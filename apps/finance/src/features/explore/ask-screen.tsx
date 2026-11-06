import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";

import { useTodayKey } from "@/data/hooks";
import { useExploreLines } from "@/data/hooks/useExploreLines";
import { ASK_INSTRUCTIONS, askDigest } from "@/lib/explore/ask-digest";
import { addDays } from "@studio/dates";
import { useTokens } from "@studio/theme";
import { Card, Chip, Pressable, SymbolIcon, Text } from "@studio/ui";

import { aiRespond } from "../../../modules/finance-ai";
import { useMoneyText } from "./shared";

const SUGGESTIONS = [
  "What did I spend most on last month?",
  "Who do I pay the most?",
  "Did I spend more this month than last?",
];
const HISTORY_DAYS = 190;

type Turn = { question: string; answer: string | null };

export default function AskScreen() {
  const { colors } = useTokens();
  const money = useMoneyText();
  const today = useTodayKey();
  const lines = useExploreLines(addDays(today, -HISTORY_DAYS), today);
  const [text, setText] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);

  const ask = async (question: string) => {
    const asked = question.trim();
    if (!asked || busy) return;
    setText("");
    setBusy(true);
    setTurns((all) => [...all, { question: asked, answer: null }]);
    const answer = await aiRespond(asked, ASK_INSTRUCTIONS(askDigest(lines, today, money)));
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
        <Text variant="subhead" tone="secondary">
          Answers are generated on this phone and nothing is sent. They can be wrong.
        </Text>
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
