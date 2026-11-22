import { useLocalSearchParams } from "expo-router";

import { PayoutForm } from "@/features/investments/payout-form";

export default function Payout() {
  const { id, payoutId } = useLocalSearchParams<{
    id: string;
    payoutId?: string;
  }>();
  return <PayoutForm investmentId={id} payoutId={payoutId} />;
}
