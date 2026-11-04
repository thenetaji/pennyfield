import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import type { AccountWithBalance } from "@/db/repos/accounts";
import { totalInDisplay } from "@/features/accounts/model";
import { AnimatedNumber, Card, Pressable, SymbolIcon, Text } from "@studio/ui";
import {
  formatMoney,
  formatMoneyForSpeech,
  type RateLookup,
} from "@studio/money";
import { pressScale, useTokens } from "@studio/theme";

type AccountsCardProps = {
  accounts: readonly AccountWithBalance[];
  displayCurrency: string;
  rates: RateLookup;
  locale?: string;
  showDecimals: boolean;
};

const MAX_CHIPS = 6;

/** What is left across accounts, smaller than the spending hero; each account's balance underneath. Opens Accounts. */
function AccountsCard({
  accounts,
  displayCurrency,
  rates,
  locale,
  showDecimals,
}: AccountsCardProps) {
  const router = useRouter();
  const { colors } = useTokens();
  const decimals = showDecimals ? undefined : 0;
  const { total } = React.useMemo(
    () => totalInDisplay(accounts, { displayCurrency, rates }),
    [accounts, displayCurrency, rates],
  );
  const sorted = React.useMemo(
    () =>
      [...accounts]
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, MAX_CHIPS),
    [accounts],
  );
  if (accounts.length === 0) return null;
  const formatted = formatMoney(total, displayCurrency, {
    locale,
    sign: "auto",
    decimals,
  });
  const open = () => router.push("/accounts");

  return (
    <Card className="overflow-hidden rounded-[20px] p-0">
      <Pressable
        role="button"
        accessibilityLabel={`Left in accounts, ${formatMoneyForSpeech(total, displayCurrency, { locale })}, ${accounts.length} accounts`}
        accessibilityHint="Opens accounts"
        scale={pressScale.row}
        onPress={open}
        className="flex-row items-center px-4 pb-2.5 pt-3.5"
      >
        <View className="min-w-0 flex-1">
          <Text variant="caption" tone="secondary">
            Left in accounts
          </Text>
          <AnimatedNumber
            value={formatted}
            variant="title2"
            tone={total < 0 ? "expense" : undefined}
            fit
            align="left"
            intro
            className="mt-0.5 font-bold tracking-[-0.5px]"
          />
        </View>
        <SymbolIcon
          name="chevron.right"
          size={12}
          color={colors.textTertiary}
          weight="bold"
        />
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 pb-3.5"
      >
        {sorted.map((a) => (
          <Pressable
            key={a.id}
            role="button"
            accessibilityLabel={`${a.name}, ${formatMoneyForSpeech(a.balance, a.currency, { locale })}`}
            scale={0.97}
            onPress={() =>
              router.push({ pathname: "/accounts/[id]", params: { id: a.id } })
            }
            className="rounded-[12px] bg-fill px-3 py-2"
            style={{ borderCurve: "continuous" }}
          >
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {a.name}
            </Text>
            <Text
              variant="footnote"
              numeric
              tone={a.balance < 0 ? "expense" : undefined}
              className="font-semibold"
              numberOfLines={1}
            >
              {formatMoney(a.balance, a.currency, {
                locale,
                sign: "auto",
                decimals,
              })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}

export { AccountsCard };
