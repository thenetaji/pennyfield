import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type AiStatus = "ready" | "downloading" | "unavailable";

type Native = {
  status(): Promise<AiStatus>;
  respond(prompt: string, instructions: string): Promise<string | null>;
};

const native = Platform.OS === "ios" ? requireOptionalNativeModule<Native>("FinanceAI") : null;

export async function aiStatus(): Promise<AiStatus> {
  try {
    return (await native?.status()) ?? "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function aiRespond(prompt: string, instructions: string): Promise<string | null> {
  try {
    return (await native?.respond(prompt, instructions)) ?? null;
  } catch {
    return null;
  }
}
