import { create } from "zustand";

type SelectionState = {
  ids: readonly string[];
  start: (id: string) => void;
  toggle: (id: string) => void;
  clear: () => void;
};

/** Rows picked for a bulk change in Activity; empty means select mode is off. */
export const useSelection = create<SelectionState>((set) => ({
  ids: [],
  start: (id) => set({ ids: [id] }),
  toggle: (id) =>
    set((s) => ({
      ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
    })),
  clear: () => set({ ids: [] }),
}));
