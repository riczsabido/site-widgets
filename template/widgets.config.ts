import type { FeedbackOption, OnboardingTask } from "site-widgets";

/**
 * Per-project widget config. Edit this file (no code changes) to set feedback
 * categories/severities and the onboarding tasks per role. Flip `enabled` to
 * false for a production launch where the widgets should not appear.
 */
export const widgets = {
  /** Master switch. Set false to hide both widgets. */
  enabled: true,

  feedback: {
    enabled: true,
    categories: [
      { key: "bug", label: "Bug / error" },
      { key: "change", label: "Change request" },
      { key: "other", label: "Other" },
    ] as FeedbackOption[],
    // "blocker" also triggers the urgent webhook in feedback.actions.ts - keep
    // the key in sync if you rename it there.
    severities: [
      { key: "blocker", label: "Blocker (cannot proceed)" },
      { key: "normal", label: "Normal" },
      { key: "minor", label: "Minor / cosmetic" },
    ] as FeedbackOption[],
    // Shown near the screenshot and in the annotator. Override with your own
    // legal wording; the package ships a generic default if you omit this.
    redactionDisclaimer:
      "Please black out any sensitive information before sending. We are not liable for anything not redacted.",
  },

  onboarding: {
    enabled: true,
    // Keyed by role. `autoKey` ties a task to an auto-detect in onboarding.actions.ts.
    tasks: {
      default: [
        { key: "explore", label: "Explore the main dashboard", href: "/" },
        {
          key: "feedback",
          label: "Use 'Send feedback' (bottom-right) to report any bug or change",
          autoKey: "gave_feedback",
        },
      ],
    } as Record<string, OnboardingTask[]>,
  },
};

/** Resolve the task list + panel title for a role. Customize freely. */
export function onboardingFor(
  role: string | null,
): { title: string; tasks: OnboardingTask[] } {
  const tasks =
    widgets.onboarding.tasks[role ?? "default"] ?? widgets.onboarding.tasks.default;
  return { title: "Getting started", tasks };
}
