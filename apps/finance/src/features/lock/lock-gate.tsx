import * as React from "react";
import { AppState, Modal, Platform } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useSetting } from "@/data/hooks";

import { authenticate, type AuthResult } from "./authenticate";
import { LockScreen } from "./lock-screen";
import { PrivacyCover } from "./privacy-cover";
import { shouldLockOnReturn } from "./timeout";

/** Web QA only: `?lock=1` shows the overlay without a real lock. */
function devForced(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("lock") === "1";
}

/**
 * Sits in the root layout. Locks on cold start and after the app has been backgrounded for the
 * configured time, and always blurs the screen while the app is inactive or in the background.
 * It renders in a native Modal so it also covers sheets and modals presented by the navigator.
 */
export function LockGate() {
  const [enabled] = useSetting("lock_enabled");
  const [timeoutS] = useSetting("lock_timeout_s");
  const [forced] = React.useState(devForced);
  const [locked, setLocked] = React.useState(enabled || forced);
  const [obscured, setObscured] = React.useState(false);
  // The Unlock button only appears once Face ID has failed or been cancelled, so nothing flashes behind the prompt.
  const [needsTap, setNeedsTap] = React.useState(false);
  const opacity = useSharedValue(1);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const unlock = React.useCallback(() => {
    setLocked(false);
    setNeedsTap(false);
    opacity.set(1);
  }, [opacity]);
  const backgroundedAt = React.useRef<number | null>(null);
  const authenticating = React.useRef(false);

  // Resolves to null when an attempt is already running.
  const attempt = React.useCallback(async (): Promise<AuthResult | null> => {
    if (authenticating.current) return null;
    authenticating.current = true;
    return authenticate();
  }, []);

  const finish = React.useCallback((result: AuthResult | null) => {
    if (result === null) return;
    if (result === "failed") setNeedsTap(true);
    else
      opacity.set(
        withTiming(0, { duration: 220 }, (done) => {
          if (done) runOnJS(unlock)();
        }),
      );
    setObscured(AppState.currentState !== "active");
    // The system prompt toggles AppState (inactive, active) around itself; ignore those events.
    setTimeout(() => {
      authenticating.current = false;
    }, 400);
  }, [opacity, unlock]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (authenticating.current) return;
      setObscured(next !== "active");
      if (next === "background") {
        backgroundedAt.current ??= Date.now();
      } else if (next === "active") {
        if (
          shouldLockOnReturn({
            enabled,
            timeoutS,
            backgroundedAt: backgroundedAt.current,
            now: Date.now(),
          })
        )
          setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [enabled, timeoutS]);

  React.useEffect(() => {
    if (locked && !forced) void attempt().then(finish);
  }, [locked, forced, attempt, finish]);

  if (!locked && !obscured) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <Animated.View className="flex-1" style={fade}>
        {locked ? (
          <LockScreen
            showButton={needsTap}
            onUnlock={() => {
              setNeedsTap(false);
              void attempt().then(finish);
            }}
          />
        ) : (
          <PrivacyCover />
        )}
      </Animated.View>
    </Modal>
  );
}
