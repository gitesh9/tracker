import { z } from "zod";
import { createResponsesCall } from "./responses.server.ts";

export async function callGoalGateway(system: string, prompt: string, schema: z.ZodType): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI planning is not configured on this host.");
  const { result } = createResponsesCall(new Request("https://ai.gateway.lovable.dev/v1/responses"), {
    baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra",
  }, [{ role: "user", content: prompt }], system, schema);
  // Consume the stream server-side: do not retry refusals or failed requests.
  for await (const part of result.fullStream) {
    if (part.type === "error") {
      const error = part.error;
      if (error && typeof error === "object" && "responseBody" in error && typeof error.responseBody === "string") {
        try {
          const body = JSON.parse(error.responseBody);
          throw new Error(body.error?.message || body.message || "AI planning request was declined.");
        } catch (parsed) {
          if (parsed instanceof Error && !(parsed instanceof SyntaxError)) throw parsed;
        }
      }
      throw error instanceof Error ? error : new Error("AI planning failed.");
    }
  }
  const text = await result.text;
  if (!text.trim()) throw new Error("AI returned no plan. No steps were added.");
  return text;
}