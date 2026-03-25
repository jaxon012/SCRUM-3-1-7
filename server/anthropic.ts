import Anthropic from "@anthropic-ai/sdk";

/**
 * Resolve API key from common env names (dotenv / hosting dashboards differ).
 */
export function resolveAnthropicApiKey(): string | undefined {
  const raw =
    process.env.ANTHROPIC_API_KEY ||
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_KEY;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = resolveAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add your key from https://console.anthropic.com/ to .env",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}
