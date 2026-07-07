import OpenAI from "openai";

export const ai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";

export async function reason(prompt: string, model: string = DEFAULT_MODEL): Promise<string> {
  const response = await ai.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("AI returned no content");
  }

  return content;
}

export async function parseJSON<T>(
  prompt: string,
  model: string = DEFAULT_MODEL,
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("AI returned no content");
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as T;
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        console.warn(`[AI] Parse attempt ${attempt + 1} failed, retrying:`, lastError.message);
      }
    }
  }

  throw new Error(
    `Failed to parse JSON from AI after ${maxRetries + 1} attempts: ${lastError?.message}`
  );
}
