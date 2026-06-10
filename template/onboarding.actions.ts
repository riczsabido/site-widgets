"use server";

// ── BIND THESE to your project ──────────────────────────────────────────────
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/supabase/auth"; // must return { userId }
import type { OnboardingState } from "site-widgets";
// ────────────────────────────────────────────────────────────────────────────

/** Resolve onboarding progress: manual checks + auto-detected tasks. */
export async function getOnboardingState(): Promise<OnboardingState> {
  const { userId } = await getSessionContext();
  if (!userId) return { manual: [], auto: [] };
  const supabase = await createClient();

  const { data: prog } = await supabase
    .from("onboarding_progress")
    .select("task_key")
    .eq("user_id", userId);
  const manual = ((prog as { task_key: string }[]) ?? []).map((p) => p.task_key);

  const auto: string[] = [];

  // gave_feedback is the one auto-detect every project gets for free.
  try {
    const { data } = await supabase.rpc("user_gave_feedback");
    if (data === true) auto.push("gave_feedback");
  } catch {
    /* ignore */
  }

  // ── PROJECT-SPECIFIC AUTO-DETECT GOES HERE ────────────────────────────────
  // For each task with an `autoKey`, push that key when the user has actually
  // done it. Example:
  //   const head = { count: "exact" as const, head: true };
  //   const { count } = await supabase
  //     .from("orders").select("id", head).eq("user_id", userId);
  //   if ((count ?? 0) > 0) auto.push("placed_order");
  // ──────────────────────────────────────────────────────────────────────────

  return { manual, auto };
}

/** Toggle a manual onboarding task on or off for the current user. */
export async function toggleOnboardingTask(taskKey: string, done: boolean) {
  const { userId } = await getSessionContext();
  if (!userId) return;
  const supabase = await createClient();
  if (done) {
    await supabase
      .from("onboarding_progress")
      .upsert({ user_id: userId, task_key: taskKey }, { onConflict: "user_id,task_key" });
  } else {
    await supabase
      .from("onboarding_progress")
      .delete()
      .eq("user_id", userId)
      .eq("task_key", taskKey);
  }
}
