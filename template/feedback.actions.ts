"use server";

// ── BIND THESE to your project ──────────────────────────────────────────────
import { createClient } from "@/lib/supabase/server"; // your server Supabase client
import { getSessionContext } from "@/lib/supabase/auth"; // must return { userId }
import type { FeedbackPayload, FeedbackResult } from "site-widgets";
// Note: ensure your Supabase server client targets the right schema (via
// db.schema in createClient, or `.schema("<schema>").from(...)`).
// ────────────────────────────────────────────────────────────────────────────

const KINDS = ["bug", "change", "other"]; // keep in sync with config categories
const SEVERITIES = ["blocker", "normal", "minor"]; // keep in sync with config severities

/** Save a user's feedback. Anyone signed in may submit; only admins read (RLS). */
export async function submitFeedback(
  input: FeedbackPayload,
): Promise<FeedbackResult> {
  // Honeypot: silently accept (don't tip off bots) but store nothing.
  if (input.company && input.company.trim() !== "") return { ok: true };

  const message = (input.message || "").trim();
  if (!message) return { ok: false, error: "Please describe the issue first." };
  const kind = KINDS.includes(input.kind) ? input.kind : "bug";
  const severity = SEVERITIES.includes(input.severity) ? input.severity : "normal";

  const { userId } = await getSessionContext();
  const supabase = await createClient();
  const { error } = await supabase.from("site_feedback").insert({
    user_id: userId,
    email: input.email?.trim() || null,
    kind,
    severity,
    message,
    page_url: input.pageUrl || null,
    user_agent: input.userAgent || null,
    screenshot: input.screenshot || null,
    context: input.context ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
