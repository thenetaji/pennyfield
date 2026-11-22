import { useLocalSearchParams } from "expo-router";

import { InvestmentForm } from "@/features/investments/form";

export default function EditInvestment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InvestmentForm mode="edit" investmentId={id} />;
}
