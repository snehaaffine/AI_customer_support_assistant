import { env, assertAzureOpenAiConfig } from "../config/env.js";
import { getAzureOpenAIClient } from "../lib/azure-openai.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function* streamChatCompletion(
  systemPrompt: string,
  messages: ChatMessage[],
  categoryLabel?: string
): AsyncGenerator<string> {
  assertAzureOpenAiConfig();

  const client = getAzureOpenAIClient();
  const systemContent = categoryLabel
    ? `${systemPrompt}\n\nThe customer selected the topic: "${categoryLabel}".`
    : systemPrompt;

  const stream = await client.chat.completions.create({
    model: env.azureOpenAiChatDeployment,
    messages: [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
    temperature: 0.4,
    max_tokens: 1024,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}
