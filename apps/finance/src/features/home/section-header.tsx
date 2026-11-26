import { View } from "react-native";

import { SymbolIcon, Pressable, Text } from "@studio/ui";
import { pressOpacity, useTokens } from "@studio/theme";

type HomeSectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Letter-spaced caps title with an "All ›" link. */
function HomeSectionHeader({
  title,
  actionLabel,
  onAction,
}: HomeSectionHeaderProps) {
  const { colors } = useTokens();
  return (
    <View className="flex-row items-baseline justify-between px-0.5 pb-2.5">
      <Text
        variant="footnote"
        tone="secondary"
        accessibilityRole="header"
        className="font-semibold uppercase tracking-[1.4px]"
      >
        {title}
      </Text>
      {actionLabel ? (
        <Pressable
          role="button"
          scale={1}
          dimTo={pressOpacity.text}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onAction}
        >
          <View className="flex-row items-center gap-0.5">
            <Text variant="footnote" tone="accent" className="font-semibold">
              {actionLabel}
            </Text>
            <SymbolIcon
              name="chevron.right"
              size={11}
              color={colors.accentText}
              weight="bold"
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The question the next sections answer: quiet, so it guides the eye without competing with their titles. */
function HomeChapter({ title }: { title: string }) {
  return (
    <Text
      variant="caption"
      tone="tertiary"
      accessibilityRole="header"
      className="px-0.5 pb-2 uppercase tracking-[0.7px]"
    >
      {title}
    </Text>
  );
}

export { HomeChapter, HomeSectionHeader };
