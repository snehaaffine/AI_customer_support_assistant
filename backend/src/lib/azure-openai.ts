import { AzureOpenAI } from "openai";
import { env } from "../config/env.js";

let client: AzureOpenAI | null = null;

export function getAzureOpenAIClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      apiKey: env.azureOpenAiApiKey,
      endpoint: env.azureOpenAiEndpoint,
      apiVersion: env.azureOpenAiApiVersion,
    });
  }
  return client;
}
