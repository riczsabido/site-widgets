"use client";

// Thin per-project binding. Injects this project's config + server action into
// the shared UI. Mount <FeedbackWidget> from here in your root layout.
import { FeedbackWidget as Base } from "site-widgets";
import { widgets } from "@/config/widgets";
import { submitFeedback } from "./actions"; // your feedback.actions.ts

export function FeedbackWidget(props: {
  userEmail: string | null;
  role: string | null;
  appVersion: string | null;
}) {
  return (
    <Base
      categories={widgets.feedback.categories}
      severities={widgets.feedback.severities}
      userEmail={props.userEmail}
      role={props.role}
      appVersion={props.appVersion}
      onSubmit={submitFeedback}
      draftKey="myapp-fb-draft"
    />
  );
}
