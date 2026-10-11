import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";

function getGenAI() {
  const apiKey = process.env["GEMINI_API_KEY"] || process.env["AI_API_KEY"];
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Universal server-side AI caller with @google/genai SDK primary execution,
 * OpenAI-compatible fallback, and graceful error recovery.
 */
async function callAi(system: string, prompt: string): Promise<string> {
  const gemini = getGenAI();
  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: system,
          temperature: 0.3,
        },
      });
      const text = response.text?.trim();
      if (text) return text;
    } catch (err) {
      console.warn("[Gemini API] Primary generation error, trying fallback gateway:", err);
    }
  }

  // Fallback to OpenAI-compatible endpoint if configured
  const apiKey = process.env["AI_API_KEY"] || process.env["GEMINI_API_KEY"];
  const baseUrl =
    process.env["AI_BASE_URL"] ?? "https://generativelanguage.googleapis.com/v1beta/openai";

  if (apiKey) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (err) {
      console.warn("[AI Gateway] Fallback gateway error:", err);
    }
  }

  return "";
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return fallback;
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    return fallback;
  }
}

// 1. Timetable Generation
export interface TimetableBlock {
  start: string;
  end: string;
  title: string;
  rationale: string;
  energy: string;
}

export const generateTimetable = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      tasks: { title: string; minutes: number; priority: string; energy: string }[];
      wakeTime: string;
      sleepTime: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<{ blocks: TimetableBlock[] }> => {
    if (data.tasks.length === 0) return { blocks: [] };

    const fallbackBlocks: TimetableBlock[] = [
      {
        start: "08:30",
        end: "09:30",
        title: data.tasks[0]?.title ?? "Priority Deep Work",
        rationale: "Aligns peak morning cognitive focus with your top priority work.",
        energy: "high",
      },
      {
        start: "09:45",
        end: "10:30",
        title: data.tasks[1]?.title ?? "Secondary Execution Sprint",
        rationale: "Maintains momentum before midday transitions.",
        energy: "medium",
      },
      {
        start: "11:00",
        end: "11:45",
        title: data.tasks[2]?.title ?? "Focused Follow-up & Review",
        rationale: "Clears critical items before lunch.",
        energy: "medium",
      },
    ].slice(0, Math.max(1, data.tasks.length));

    try {
      const raw = await callAi(
        "You are an elite focus coach who builds energy-aligned daily schedules. Reply with JSON only.",
        `Day runs ${data.wakeTime} to ${data.sleepTime}. Arrange these pending tasks into time blocks, placing high-energy work in peak-energy morning hours and low-energy work later. Include short breaks between deep blocks.
Tasks: ${JSON.stringify(data.tasks)}
Reply as JSON: {"blocks":[{"start":"08:00","end":"08:45","title":"...","rationale":"one short sentence","energy":"high|medium|low"}]}`,
      );
      const parsed = parseJson<{ blocks?: TimetableBlock[] }>(raw, { blocks: fallbackBlocks });
      return {
        blocks: (parsed.blocks && parsed.blocks.length > 0 ? parsed.blocks : fallbackBlocks).slice(
          0,
          16,
        ),
      };
    } catch {
      return { blocks: fallbackBlocks };
    }
  });

// 2. Goal Breakdown
export interface AiSubtask {
  title: string;
  definition_of_done: string;
  estimated_minutes: number;
}

export const breakdownGoal = createServerFn({ method: "POST" })
  .inputValidator((input: { title: string; description?: string; targetDays: number }) => input)
  .handler(async ({ data }): Promise<{ subtasks: AiSubtask[] }> => {
    const fallback: AiSubtask[] = [
      {
        title: `Scope and blueprint specifications for "${data.title}"`,
        definition_of_done:
          "Written plan with key constraints, dependencies, and requirements documented.",
        estimated_minutes: 45,
      },
      {
        title: `Set up environment, assets, and prerequisites for "${data.title}"`,
        definition_of_done:
          "All necessary workspace tools, templates, and permissions ready to use.",
        estimated_minutes: 30,
      },
      {
        title: `Execute foundational milestone for "${data.title}"`,
        definition_of_done: "Core 50% milestone implemented, functional, and verified.",
        estimated_minutes: 90,
      },
      {
        title: `Complete detailed implementation and polish for "${data.title}"`,
        definition_of_done: "All criteria met without blocking bugs or unfinished items.",
        estimated_minutes: 60,
      },
      {
        title: `Review results against Definition of Done and document learnings`,
        definition_of_done: "Final deliverable checked, submitted, and retrospective logged.",
        estimated_minutes: 30,
      },
    ];

    try {
      const raw = await callAi(
        "You break long-term goals into sequential, concrete milestones. Reply with JSON only.",
        `Goal: "${data.title}". Context: ${data.description || "none"}. Target horizon: ${data.targetDays} days.
Return 4-6 sequential subtasks. Each needs a crisp "definition of done" describing the exact completion criteria.
Reply as JSON: {"subtasks":[{"title":"...","definition_of_done":"...","estimated_minutes":90}]}`,
      );
      const parsed = parseJson<{ subtasks?: AiSubtask[] }>(raw, { subtasks: fallback });
      return {
        subtasks: (parsed.subtasks && parsed.subtasks.length > 0
          ? parsed.subtasks
          : fallback
        ).slice(0, 10),
      };
    } catch {
      return { subtasks: fallback };
    }
  });

// 3. Procrastination Diagnosis
export const diagnoseProcrastination = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { reasons: { reason: string; count: number }[]; carriedTasks: string[] }) => input,
  )
  .handler(async ({ data }): Promise<{ insight: string; actions: string[] }> => {
    const fallback = {
      insight:
        data.carriedTasks.length > 0
          ? `Tasks like "${data.carriedTasks[0]}" are stalling primarily due to ambiguous first steps or oversized scope.`
          : "Consistent progress happens when tasks are sized down into 15-minute start blocks.",
      actions: [
        "Slice the top carried task into a single 15-minute micro-step you can execute immediately.",
        "Clarify the explicit Definition of Done before starting so completion is unambiguous.",
        "Schedule high-energy tasks in your morning peak window before cognitive fatigue sets in.",
      ],
    };

    if (data.reasons.length === 0 && data.carriedTasks.length === 0) {
      return {
        insight: "Not enough deferral history yet — keep logging reasons when you push a task.",
        actions: [
          "Log a reason whenever postponing a task to unlock tailored behavioural insights.",
        ],
      };
    }

    try {
      const raw = await callAi(
        "You are a behavioural coach. Be specific, warm and blunt. Reply with JSON only.",
        `Deferral reasons: ${JSON.stringify(data.reasons)}. Recently carried-forward tasks: ${JSON.stringify(data.carriedTasks)}.
Diagnose the root pattern in 2-3 sentences and give 3 concrete corrective actions.
Reply as JSON: {"insight":"...","actions":["...","...","..."]}`,
      );
      const parsed = parseJson<{ insight?: string; actions?: string[] }>(raw, fallback);
      return {
        insight: parsed.insight ?? fallback.insight,
        actions: (parsed.actions && parsed.actions.length > 0
          ? parsed.actions
          : fallback.actions
        ).slice(0, 5),
      };
    } catch {
      return fallback;
    }
  });

// 4. Weekly Retrospective
export interface WeeklyRetrospective {
  summary: string;
  topWins: string[];
  procrastinationAnalysis: string;
  scheduleAdjustments: string[];
  suggestedFocusBlocks: { time: string; focus: string; rationale: string }[];
}

export const generateWeeklyRetrospective = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      completionsCount: number;
      focusMinutes: number;
      streak: number;
      topDomains: string[];
      deferralReasons: { reason: string; count: number }[];
      peakHour: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<WeeklyRetrospective> => {
    const fallback: WeeklyRetrospective = {
      summary: `You completed ${data.completionsCount} tasks with ${data.focusMinutes} focus minutes logged this week across ${data.topDomains.join(", ") || "core areas"}.`,
      topWins: [
        `Maintained strong consistency with a current streak of ${data.streak} days.`,
        `Invested high cognitive bandwidth in peak performance hours around ${data.peakHour}.`,
      ],
      procrastinationAnalysis:
        "Deferrals were kept minimal. Focus on defining explicit DoD criteria on complex tasks to maintain flow.",
      scheduleAdjustments: [
        "Protect your morning peak focus hours (08:30 - 11:00) for high-energy P1 tasks.",
        "Batch routine administrative and low-energy tasks into late afternoon blocks.",
      ],
      suggestedFocusBlocks: [
        {
          time: "08:30 - 10:00",
          focus: "High-Bandwidth Deep Work",
          rationale: "Aligns with peak cognitive stamina and highest task yield.",
        },
        {
          time: "14:00 - 15:00",
          focus: "Review, Consolidation & Habit Loop",
          rationale: "Keeps daily streaks alive during afternoon energy transitions.",
        },
      ],
    };

    try {
      const raw = await callAi(
        "You are an executive performance and personal growth coach conducting a Sunday weekly retrospective. Reply with JSON only.",
        `Weekly performance stats:
- Task completions: ${data.completionsCount}
- Focus minutes logged: ${data.focusMinutes}m
- Current streak: ${data.streak} days
- Active domains: ${data.topDomains.join(", ") || "General"}
- Peak focus hour: ${data.peakHour}
- Deferral breakdown: ${JSON.stringify(data.deferralReasons)}

Synthesize a comprehensive weekly retrospective with:
1. summary (2-3 sentences of inspiring, clear analysis)
2. topWins (2-3 bullet highlights)
3. procrastinationAnalysis (behavioral diagnosis of deferral bottlenecks)
4. scheduleAdjustments (2-3 specific timetable adjustments for the upcoming week based on peak focus hours)
5. suggestedFocusBlocks (2-3 recommended time slots with time, focus description, and rationale)

Reply as JSON:
{"summary":"...","topWins":["..."],"procrastinationAnalysis":"...","scheduleAdjustments":["..."],"suggestedFocusBlocks":[{"time":"08:30 - 10:00","focus":"Deep coding / writing","rationale":"Capitalizes on morning peak focus"}]}`,
      );

      const parsed = parseJson<Partial<WeeklyRetrospective>>(raw, fallback);
      return {
        summary: parsed.summary ?? fallback.summary,
        topWins: parsed.topWins && parsed.topWins.length > 0 ? parsed.topWins : fallback.topWins,
        procrastinationAnalysis: parsed.procrastinationAnalysis ?? fallback.procrastinationAnalysis,
        scheduleAdjustments:
          parsed.scheduleAdjustments && parsed.scheduleAdjustments.length > 0
            ? parsed.scheduleAdjustments
            : fallback.scheduleAdjustments,
        suggestedFocusBlocks:
          parsed.suggestedFocusBlocks && parsed.suggestedFocusBlocks.length > 0
            ? parsed.suggestedFocusBlocks
            : fallback.suggestedFocusBlocks,
      };
    } catch {
      return fallback;
    }
  });

// 5. Task Focus Sprint
export interface TaskFocusSprintPlan {
  sprintGoal: string;
  blocks: {
    blockNumber: number;
    title: string;
    targetMinutes: number;
    deliverable: string;
    focusTip: string;
  }[];
  breakSuggestion: string;
}

export const generateTaskFocusSprint = createServerFn({ method: "POST" })
  .validator(
    (input: {
      taskTitle: string;
      domain?: string;
      estimatedMinutes?: number;
      definitionOfDone?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<TaskFocusSprintPlan> => {
    const fallback: TaskFocusSprintPlan = {
      sprintGoal: `Complete primary deliverable for "${data.taskTitle}"`,
      blocks: [
        {
          blockNumber: 1,
          title: "Setup & High-Concentration Architecture",
          targetMinutes: 25,
          deliverable: "Clear initial scope, gather all materials, and execute foundational 50%.",
          focusTip:
            "Close all unneeded tabs, silence chat notifications, and single-task without switching.",
        },
        {
          blockNumber: 2,
          title: "Core Execution & Flow State",
          targetMinutes: 25,
          deliverable: "Complete implementation and address primary friction points.",
          focusTip:
            "Maintain momentum; avoid premature polishing until the baseline is functional.",
        },
        {
          blockNumber: 3,
          title: "Verification, DoD Check & Polish",
          targetMinutes: 15,
          deliverable:
            data.definitionOfDone ||
            "Test, verify against Definition of Done, and wrap up loose ends.",
          focusTip: "Verify your final output matches your Definition of Done criteria.",
        },
      ],
      breakSuggestion:
        "Stand up, stretch your shoulders and neck, hydrate with a full glass of water, and rest your eyes looking at a distance.",
    };

    try {
      const raw = await callAi(
        "You are an elite deep work productivity coach. Break down this task into 2-3 laser-focused Pomodoro/Focus sprint blocks. Reply with JSON only.",
        `Task: "${data.taskTitle}"
Domain: ${data.domain || "General Focus"}
Estimated Duration: ${data.estimatedMinutes || 45} minutes
Definition of Done: ${data.definitionOfDone || "Fully completed and verified"}

Provide:
1. sprintGoal: 1 concise sentence summarizing the intended outcome of this focus session.
2. blocks: array of 2-3 focus blocks (each with blockNumber, title, targetMinutes (15-50), deliverable, and a focusTip).
3. breakSuggestion: A healthy, restorative micro-break recovery activity.

Reply as JSON:
{"sprintGoal":"...","blocks":[{"blockNumber":1,"title":"...","targetMinutes":25,"deliverable":"...","focusTip":"..."}],"breakSuggestion":"..."}`,
      );

      const parsed = parseJson<Partial<TaskFocusSprintPlan>>(raw, fallback);
      return {
        sprintGoal: parsed.sprintGoal ?? fallback.sprintGoal,
        blocks: (parsed.blocks && parsed.blocks.length > 0 ? parsed.blocks : fallback.blocks).slice(
          0,
          4,
        ),
        breakSuggestion: parsed.breakSuggestion ?? fallback.breakSuggestion,
      };
    } catch {
      return fallback;
    }
  });

// 6. AI-Powered Task Refinements & Smart Category Suggestions
export interface TaskRefinementResult {
  title: string;
  categories: string[];
  definitionOfDone: string;
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  energyLevel: "high" | "medium" | "low";
  iconName: string;
  tips: string[];
}

export const suggestTaskRefinements = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { rawTitle: string; notes?: string; currentCategories?: string[] }) => input,
  )
  .handler(async ({ data }): Promise<TaskRefinementResult> => {
    const raw = data.rawTitle.trim();
    const fallback: TaskRefinementResult = {
      title: raw || "Refined Task",
      categories:
        data.currentCategories && data.currentCategories.length > 0
          ? data.currentCategories
          : ["focus", "learning"],
      definitionOfDone: "Completed fully with all requirements verified.",
      estimatedMinutes: 25,
      priority: "medium",
      energyLevel: "medium",
      iconName: "sparkles",
      tips: ["Size tasks to 25-45 minutes for maximum flow state."],
    };

    try {
      const response = await callAi(
        "You are an AI task optimization assistant. Suggest crisp title, multi-categories, definition of done, duration, priority, energy, and icon for this task. Available domains include: focus, health, career, mindset, finance, learning, creativity, relationships (or custom categories). Reply with JSON only.",
        `Task input: "${data.rawTitle}". Notes: "${data.notes || "none"}". Current categories: ${JSON.stringify(data.currentCategories || [])}
Reply as JSON:
{
  "title": "Clean concise action-oriented title",
  "categories": ["focus", "career"],
  "definitionOfDone": "Observable completion criteria",
  "estimatedMinutes": 30,
  "priority": "high|medium|low",
  "energyLevel": "high|medium|low",
  "iconName": "sparkles|activity|target|book|flame|timer|briefcase|heart|brain|wallet",
  "tips": ["Tip for overcoming friction"]
}`,
      );
      const parsed = parseJson<Partial<TaskRefinementResult>>(response, fallback);
      return {
        title: parsed.title || fallback.title,
        categories:
          parsed.categories && parsed.categories.length > 0
            ? parsed.categories
            : fallback.categories,
        definitionOfDone: parsed.definitionOfDone || fallback.definitionOfDone,
        estimatedMinutes: Number(parsed.estimatedMinutes) || fallback.estimatedMinutes,
        priority: parsed.priority || fallback.priority,
        energyLevel: parsed.energyLevel || fallback.energyLevel,
        iconName: parsed.iconName || fallback.iconName,
        tips: parsed.tips && parsed.tips.length > 0 ? parsed.tips : fallback.tips,
      };
    } catch {
      return fallback;
    }
  });

// 7. AI Task Generation from Goal
export interface GeneratedGoalTask {
  title: string;
  categories: string[];
  frequency_type: "daily" | "weekly_count" | "weekdays" | "once";
  target_days_per_week?: number;
  estimated_minutes: number;
  energy_level: "high" | "medium" | "low";
  priority: "high" | "medium" | "low";
  definition_of_done: string;
  icon_name: string;
}

export const generateTasksFromGoal = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { goalTitle: string; goalDescription?: string; goalDomain?: string }) => input,
  )
  .handler(async ({ data }): Promise<{ tasks: GeneratedGoalTask[] }> => {
    const fallbackDomain = data.goalDomain || "career";
    const fallback: GeneratedGoalTask[] = [
      {
        title: `Daily 25-min progress sprint for "${data.goalTitle}"`,
        categories: [fallbackDomain, "focus"],
        frequency_type: "daily",
        target_days_per_week: 5,
        estimated_minutes: 25,
        energy_level: "high",
        priority: "high",
        definition_of_done: "Logged 25 mins of uninterrupted execution toward the milestone.",
        icon_name: "target",
      },
      {
        title: `Weekly review and milestone audit for "${data.goalTitle}"`,
        categories: [fallbackDomain, "learning"],
        frequency_type: "weekly_count",
        target_days_per_week: 1,
        estimated_minutes: 20,
        energy_level: "medium",
        priority: "medium",
        definition_of_done: "Updated goal metrics and logged wins/roadblocks.",
        icon_name: "book",
      },
      {
        title: `Eliminate top blocker or friction point for "${data.goalTitle}"`,
        categories: [fallbackDomain, "mindset"],
        frequency_type: "weekly_count",
        target_days_per_week: 2,
        estimated_minutes: 30,
        energy_level: "medium",
        priority: "medium",
        definition_of_done: "Resolved dependencies or clarified next requirements.",
        icon_name: "sparkles",
      },
    ];

    try {
      const raw = await callAi(
        "You are an elite productivity designer. Given a high-level goal, generate 3-4 recurring habits/tasks that ensure this goal is achieved. Assign realistic multi-categories to each task. Reply with JSON only.",
        `Goal: "${data.goalTitle}". Context: "${data.goalDescription || "none"}". Primary domain: ${fallbackDomain}.
Reply as JSON:
{
  "tasks": [
    {
      "title": "Daily 30-min deep work",
      "categories": ["${fallbackDomain}", "focus"],
      "frequency_type": "daily",
      "target_days_per_week": 5,
      "estimated_minutes": 30,
      "energy_level": "high",
      "priority": "high",
      "definition_of_done": "Complete key sprint output",
      "icon_name": "target"
    }
  ]
}`,
      );
      const parsed = parseJson<{ tasks?: GeneratedGoalTask[] }>(raw, { tasks: fallback });
      return {
        tasks: (parsed.tasks && parsed.tasks.length > 0 ? parsed.tasks : fallback).slice(0, 6),
      };
    } catch {
      return { tasks: fallback };
    }
  });

// 8. Ascend AI Coach Q&A
export interface CoachAdviceResult {
  answer: string;
  actionItems: string[];
  suggestedTasks?: {
    title: string;
    categories: string[];
    estimatedMinutes: number;
    frequency: string;
  }[];
}

export const askAscendCoach = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      question: string;
      context?: {
        currentStreak?: number;
        activeGoals?: string[];
        carriedTasks?: string[];
      };
    }) => input,
  )
  .handler(async ({ data }): Promise<CoachAdviceResult> => {
    const fallback: CoachAdviceResult = {
      answer:
        "Focus on high-leverage simplicity: identify the single most impactful task on your board today, eliminate visual clutter, and commit to one uninterrupted 25-minute Pomodoro session.",
      actionItems: [
        "Pick exactly one high-energy P1 task to finish before noon.",
        "Break tasks with carry-over count > 2 into 10-minute micro-steps.",
        "Protect at least 45 minutes for dedicated recovery and deep focus.",
      ],
      suggestedTasks: [
        {
          title: "Top Priority Deep Work Sprint",
          categories: ["focus", "career"],
          estimatedMinutes: 25,
          frequency: "daily",
        },
      ],
    };

    try {
      const raw = await callAi(
        "You are Ascend AI Coach — an empathetic, precise, high-performance productivity mentor. Give crisp, actionable advice with specific next steps and optional task suggestions. Reply with JSON only.",
        `User Question: "${data.question}"
User Context: Streak: ${data.context?.currentStreak ?? 0} days, Goals: ${JSON.stringify(data.context?.activeGoals || [])}, Carried: ${JSON.stringify(data.context?.carriedTasks || [])}

Reply as JSON:
{
  "answer": "2-3 concise paragraphs of actionable, motivating advice",
  "actionItems": ["Action 1", "Action 2", "Action 3"],
  "suggestedTasks": [
    {
      "title": "...",
      "categories": ["focus", "health"],
      "estimatedMinutes": 25,
      "frequency": "daily"
    }
  ]
}`,
      );
      const parsed = parseJson<Partial<CoachAdviceResult>>(raw, fallback);
      return {
        answer: parsed.answer || fallback.answer,
        actionItems:
          parsed.actionItems && parsed.actionItems.length > 0
            ? parsed.actionItems
            : fallback.actionItems,
        suggestedTasks: parsed.suggestedTasks ?? fallback.suggestedTasks ?? [],
      };
    } catch {
      return fallback;
    }
  });
