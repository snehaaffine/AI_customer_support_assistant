import { env, assertAzureOpenAiConfig } from "../config/env.js";
import { getAzureOpenAIClient } from "../lib/azure-openai.js";

export async function createEmbedding(text: string): Promise<number[]> {
  assertAzureOpenAiConfig();

  const client = getAzureOpenAIClient();
  const response = await client.embeddings.create({
    model: env.azureOpenAiEmbeddingDeployment,
    input: text,
    dimensions: env.embeddingDimension,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("No embedding returned from Azure OpenAI");
  }

  return embedding;
}

export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
