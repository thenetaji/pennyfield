import { haptic, useTokens } from "@studio/theme";
import { Platform, Switch as RNSwitch, type SwitchProps } from "react-native";

// iOS's own green, not the accent: the default accent is nearly white in dark mode, which hides the white thumb.
const ON = { light: "#34C759", dark: "#30D158" } as const;

const webThumb: object =
  Platform.OS === "web" ? { activeThumbColor: "#FFFFFF" } : {};

function Switch({
  onValueChange,
  value,
  style,
  ...props
}: Omit<SwitchProps, "className">) {
  const { colors, scheme } = useTokens();
  return (
    <RNSwitch
      accessibilityRole="switch"
      // React Native pins the iOS switch to the top of its row with `alignSelf: flex-start`.
      style={[{ alignSelf: "center" }, style]}
      value={value}
      trackColor={{ false: colors.fill, true: ON[scheme] }}
      thumbColor="#FFFFFF"
      {...webThumb}
      ios_backgroundColor={colors.fill}
      onValueChange={(next) => {
        haptic("selection");
        onValueChange?.(next);
      }}
      {...props}
    />
  );
}

export { Switch };
