import { StyleSheet, View } from "react-native";

import { AppIcon, useIconPrefs, tileRadius, tileSpec } from "@studio/icons";
import type { IconBackground, IconStyle } from "@studio/icons";
import type { CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";

type IconTileProps = {
  /** Concept id or a legacy SF Symbol name. */
  icon: string;
  color: CategoryColorKey;
  /** Footprint in points: 38 list, 46 grid, 22 chip. */
  size?: number;
  /** Ignored: the corner radius follows the treatment. Kept so existing call sites compile. */
  radius?: number;
  splitBadge?: boolean;
  /** Force a treatment / icon style (appearance previews). Defaults to the user's choice. */
  background?: IconBackground;
  iconStyle?: IconStyle;
};

function IconTile({
  icon,
  color,
  size = 38,
  radius: _radius,
  splitBadge = false,
  background,
  iconStyle,
}: IconTileProps) {
  const { colors, category, categoryMode, ink } = useTokens();
  const chosen = useIconPrefs((s) => s.background);
  const treatment = background ?? chosen;
  const mono = categoryMode === "mono";
  const tone =
    treatment === "glyph-only"
      ? mono ? colors.accent : category[color]
      : mono ? colors.tile : ink[color];
  const spec = tileSpec(treatment, tone);
  const glyph = Math.round(size * spec.iconScale);
  const radius = tileRadius(size);
  const glyphNode = (
    <AppIcon
      name={icon}
      size={glyph}
      color={spec.icon}
      iconStyle={iconStyle}
    />
  );

  let body: React.ReactNode;
  if (spec.kind === "none") {
    body = (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center"
      >
        {glyphNode}
      </View>
    );
  } else {
    body = (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderCurve: "continuous",
          backgroundColor: spec.base,
        }}
        className="items-center justify-center"
      >
        {glyphNode}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      {body}
      {splitBadge ? (
        <View
          style={{
            borderColor: colors.surface,
            backgroundColor: colors.fill,
            borderWidth: StyleSheet.hairlineWidth * 3,
          }}
          className="absolute -bottom-1 -right-1 h-[14px] w-[14px] items-center justify-center rounded-full"
        >
          <AppIcon name="split" size={8} color={colors.textSecondary} />
        </View>
      ) : null}
    </View>
  );
}

export { IconTile };
export type { IconTileProps };
