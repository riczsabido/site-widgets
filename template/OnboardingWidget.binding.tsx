"use client";

// Thin per-project binding. Resolves role -> {title, tasks} via your config and
// injects this project's state actions into the shared UI.
import { OnboardingWidget as Base } from "site-widgets";
import { onboardingFor } from "@/config/widgets";
import { getOnboardingState, toggleOnboardingTask } from "./actions"; // your onboarding.actions.ts

export function OnboardingWidget(props: {
  role: string | null;
  userId: string;
  userName: string | null;
}) {
  const { title, tasks } = onboardingFor(props.role);
  return (
    <Base
      title={title}
      tasks={tasks}
      userName={props.userName}
      storageKey={`myapp-onb-state-${props.userId}`}
      getState={getOnboardingState}
      onToggle={toggleOnboardingTask}
    />
  );
}
