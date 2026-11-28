import type { ReactNode } from "react";

import { AmountsHiddenProvider } from "@studio/ui";
import { useAmountsHidden } from "@/features/privacy/use-amounts-hidden";

/** Feeds the Hide amounts setting to every `Amount` and `AmountReadout` below it. */
export function AmountsPrivacy({ children }: { children: ReactNode }) {
  const [hidden] = useAmountsHidden();
  return (
    <AmountsHiddenProvider hidden={hidden}>{children}</AmountsHiddenProvider>
  );
}
