import { requireNativeView, requireOptionalNativeModule } from "expo";
import * as React from "react";
import { Platform, type ViewProps } from "react-native";

type Native = { available(): boolean };

const native = Platform.OS === "ios" ? requireOptionalNativeModule<Native>("FinanceChart3D") : null;
const available = (() => {
  try {
    return native?.available() ?? false;
  } catch {
    return false;
  }
})();

/** Apple's 3D charts need iOS 26. */
export const useChart3DAvailable = () => available;

export type Chart3DPoint = { week: number; weekday: number; amount: number };

type Props = ViewProps & { points: number[][]; tint: string };

const NativeView: React.ComponentType<Props> | null = available
  ? requireNativeView("FinanceChart3D")
  : null;

export function Chart3D({ points, tint, ...props }: ViewProps & { points: Chart3DPoint[]; tint: string }) {
  const rows = React.useMemo(() => points.map((p) => [p.week, p.weekday, p.amount]), [points]);
  return NativeView ? <NativeView points={rows} tint={tint} {...props} /> : null;
}
