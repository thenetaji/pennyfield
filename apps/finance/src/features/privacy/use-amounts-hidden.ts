import * as React from "react";
import { create } from "zustand";

import { useSetting } from "@/data/hooks";

// Saving a setting re-runs every query that watches settings, which made the eye stutter. The
// screen flips from memory at once and the save follows after the frame has painted.
const useLocal = create<{ hidden: boolean | null; set: (hidden: boolean | null) => void }>((set) => ({
  hidden: null,
  set: (hidden) => set({ hidden }),
}));

/** Hide amounts, answered from memory first so toggling it is instant. */
export function useAmountsHidden(): readonly [boolean, (hidden: boolean) => void] {
  const [saved, save] = useSetting("hide_amounts");
  const local = useLocal((s) => s.hidden);
  const setLocal = useLocal((s) => s.set);
  React.useEffect(() => {
    if (local !== null && local === saved) setLocal(null);
  }, [saved, local, setLocal]);
  const set = React.useCallback(
    (hidden: boolean) => {
      setLocal(hidden);
      setTimeout(() => save(hidden), 350);
    },
    [save, setLocal],
  );
  return [local ?? saved, set] as const;
}
