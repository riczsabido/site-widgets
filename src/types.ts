/**
 * Shared types for the site-widgets package. These are the contract between the
 * prop-driven UI (this package) and each project's own server actions.
 */

export interface FeedbackOption {
  key: string;
  label: string;
}

export interface OnboardingTask {
  /** Stable key, used for server-side manual progress. */
  key: string;
  label: string;
  /** Optional deep link rendered as a "Go" shortcut. */
  href?: string;
  /**
   * Optional auto-detect key. When the user has actually done this (resolved by
   * the project's getState), the task shows completed and locks (cannot uncheck).
   */
  autoKey?: string;
}

export interface OnboardingState {
  /** Task keys the user manually checked off. */
  manual: string[];
  /** Auto-detect keys the user has actually satisfied (computed live). */
  auto: string[];
}

/** Structured environment captured with each feedback report. */
export interface FeedbackContext {
  role: string | null;
  viewport: string | null;
  screen: string | null;
  language: string | null;
  appVersion: string | null;
  consoleErrors: string[];
}

/** Payload the widget hands to your onSubmit action. */
export interface FeedbackPayload {
  kind: string;
  message: string;
  severity: string;
  email: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  screenshot: string | null;
  context: FeedbackContext;
  /** Honeypot: real users never fill this. Accept-and-discard if non-empty. */
  company: string;
}

export interface FeedbackResult {
  ok: boolean;
  error?: string;
}
