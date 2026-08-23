import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3.5-flash";

async function callGateway(system: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
  if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return fallback;
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    return fallback;
  }
}

export interface TimetableBlock {
  start: string;
  end: string;
  title: string;
  rationale: string;
  energy: string;
}

export const generateTimetable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tasks: { title: string; minutes: number; priority: string; energy: string }[];
      wakeTime: string;
      sleepTime: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<{ blocks: TimetableBlock[] }> => {
    if (data.tasks.length === 0) return { blocks: [] };
    const raw = await callGateway(
      "You are a focus coach who builds energy-aligned daily schedules. Reply with JSON only.",
      `Day runs ${data.wakeTime} to ${data.sleepTime}. Arrange these pending tasks into time blocks, placing high-energy work in peak-energy morning hours and low-energy work later. Include short breaks between deep blocks.
Tasks: ${JSON.stringify(data.tasks)}
Reply as JSON: {"blocks":[{"start":"07:30","end":"08:15","title":"...","rationale":"one short sentence","energy":"high|medium|low"}]}`,
    );
    const parsed = parseJson<{ blocks?: TimetableBlock[] }>(raw, {});
    return { blocks: (parsed.blocks ?? []).slice(0, 16) };
  });

export interface AiSubtask {
  title: string;
  definition_of_done: string;
  estimated_minutes: number;
}

export const breakdownGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; description?: string; targetDays: number }) => input)
  .handler(async ({ data }): Promise<{ subtasks: AiSubtask[] }> => {
    const raw = await callGateway(
      "You break long-term goals into sequential, concrete milestones. Reply with JSON only.",
      `Goal: "${data.title}". Context: ${data.description || "none"}. Target horizon: ${data.targetDays} days.
Return 5-8 sequential subtasks. Each needs a crisp "definition of done" describing the exact completion criteria.
Reply as JSON: {"subtasks":[{"title":"...","definition_of_done":"...","estimated_minutes":90}]}`,
    );
    const parsed = parseJson<{ subtasks?: AiSubtask[] }>(raw, {});
    return { subtasks: (parsed.subtasks ?? []).slice(0, 10) };
  });

export const diagnoseProcrastination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { reasons: { reason: string; count: number }[]; carriedTasks: string[] }) => input,
  )
  .handler(async ({ data }): Promise<{ insight: string; actions: string[] }> => {
    if (data.reasons.length === 0) {
      return { insight: "Not enough deferral history yet — keep logging reasons when you push a task.", actions: [] };
    }
    const raw = await callGateway(
      "You are a behavioural coach. Be specific, warm and blunt. Reply with JSON only.",
      `Deferral reasons: ${JSON.stringify(data.reasons)}. Recently carried-forward tasks: ${JSON.stringify(data.carriedTasks)}.
Diagnose the root pattern in 2-3 sentences and give 3 concrete corrective actions.
Reply as JSON: {"insight":"...","actions":["...","...","..."]}`,
    );
    const parsed = parseJson<{ insight?: string; actions?: string[] }>(raw, {});
    return {
      insight: parsed.insight ?? "Could not read a pattern this time.",
      actions: (parsed.actions ?? []).slice(0, 5),
    };
  });
