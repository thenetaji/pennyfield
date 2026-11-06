import * as React from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

type Register = (check: () => void) => () => void;

/** How far above the bottom of the screen a section's top has to be: about where the tab bar ends. */
const REVEAL_MARGIN = 60;

const RevealContext = React.createContext<Register | null>(null);

/** Gives a scroll view what `Reveal` needs: pass `register` to the provider and call `onScroll` from it. */
export function useScrollReveal() {
  const checks = React.useRef(new Set<() => void>());
  const register = React.useCallback<Register>((check) => {
    checks.current.add(check);
    return () => {
      checks.current.delete(check);
    };
  }, []);
  const onScroll = React.useCallback(() => {
    checks.current.forEach((check) => check());
  }, []);
  return { register, onScroll };
}

export const ScrollRevealProvider = RevealContext.Provider;

/**
 * Remounts a section as it scrolls into view. A chart's entrance plays on mount, so without this anything
 * below the fold finishes animating before anyone sees it. The first mount stays visible, off screen, so
 * screen readers can still reach the section and scrolling never depends on it.
 */
export function Reveal({ children }: { children: React.ReactNode }) {
  const register = React.useContext(RevealContext);
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const ref = React.useRef<View>(null);
  const [phase, setPhase] = React.useState<"unknown" | "shown" | "below" | "arrived">("unknown");
  const measure = React.useCallback(() => {
    ref.current?.measureInWindow((_x, y, _width, sectionHeight) => {
      if (sectionHeight === 0) return;
      const inView = y < height - REVEAL_MARGIN;
      setPhase((was) => {
        if (was === "unknown") return inView ? "shown" : "below";
        return was === "below" && inView ? "arrived" : was;
      });
    });
  }, [height]);
  React.useEffect(() => {
    if (phase !== "below" || !register || reduced) return;
    measure();
    return register(measure);
  }, [phase, register, reduced, measure]);
  return (
    <View ref={ref} collapsable={false} onLayout={phase === "unknown" ? measure : undefined}>
      <Animated.View
        key={phase === "arrived" ? "arrived" : "first"}
        entering={phase === "arrived" ? FadeIn.duration(260) : undefined}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** 0 to 1 once `ready` is true, for an entrance; already 1 under Reduce Motion. */
export function useEntrance(duration: number, ready = true, delay = 0) {
  const reduced = useReducedMotion();
  const value = useSharedValue(reduced ? 1 : 0);
  React.useEffect(() => {
    if (reduced || !ready) return;
    value.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, reduced, ready, duration, delay]);
  return value;
}
