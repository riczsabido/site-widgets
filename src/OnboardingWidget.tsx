"use client";

import { useEffect, useState } from "react";
import type { OnboardingState, OnboardingTask } from "./types";

/**
 * Role-aware onboarding checklist (prop-driven). A task is done when the user
 * checked it (manual) OR when it is auto-detected (resolved by getState).
 * Auto-detected tasks are locked. Bring your own getState / onToggle actions.
 */
export interface OnboardingWidgetProps {
  /** Panel heading (resolve role -> title in your project config). */
  title: string;
  /** The resolved task list for this user/role. */
  tasks: OnboardingTask[];
  /** Used to greet the user by first name; pass null to skip the greeting. */
  userName?: string | null;
  /** Unique per-user cache key, e.g. `myapp-onb-${userId}`. */
  storageKey: string;
  /** Load progress (manual checks + auto-detected keys). */
  getState: () => Promise<OnboardingState>;
  /** Persist a manual check toggle. */
  onToggle: (taskKey: string, done: boolean) => Promise<void>;
  /** Optional greeting override. Receives the first name. */
  introText?: (firstName: string) => string;
  /** Optional completion message (shown when all tasks are done). */
  completionText?: string;
  /** Optional collapsed-button label (default "Test tasks"). */
  collapsedLabel?: string;
}

export function OnboardingWidget({
  title,
  tasks,
  userName = null,
  storageKey,
  getState,
  onToggle,
  introText,
  completionText = "✓ All done. Thank you for testing!",
  collapsedLabel = "Test tasks",
}: OnboardingWidgetProps) {
  const cacheKey = storageKey;

  const [manual, setManual] = useState<Set<string>>(new Set());
  const [auto, setAuto] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const isDone = (key: string, autoKey?: string) =>
    manual.has(key) || (autoKey != null && auto.has(autoKey));
  const isLocked = (key: string, autoKey?: string) =>
    autoKey != null && auto.has(autoKey) && !manual.has(key);

  // Load cached state for an instant render; default-open on first visit.
  useEffect(() => {
    let cachedManual: string[] = [];
    let cachedAuto: string[] = [];
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const c = JSON.parse(raw);
        cachedManual = c.manual ?? [];
        cachedAuto = c.auto ?? [];
      }
    } catch {
      /* ignore */
    }
    setManual(new Set(cachedManual));
    setAuto(new Set(cachedAuto));
    const noneDone =
      tasks.filter(
        (t) => cachedManual.includes(t.key) || (t.autoKey && cachedAuto.includes(t.autoKey)),
      ).length === 0;
    setOpen(noneDone);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  function cache(m: Set<string>, a: Set<string>) {
    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({ manual: [...m], auto: [...a] }),
      );
    } catch {
      /* ignore */
    }
  }

  // Refresh from the server whenever the panel is opened.
  async function refresh() {
    const state = await getState();
    const m = new Set(state.manual);
    const a = new Set(state.auto);
    setManual(m);
    setAuto(a);
    cache(m, a);
  }

  function onOpen() {
    setOpen(true);
    void refresh();
  }

  function toggle(key: string, autoKey?: string) {
    if (isLocked(key, autoKey)) return; // auto-detected, cannot uncheck
    const next = new Set(manual);
    const nowDone = !next.has(key);
    if (nowDone) next.add(key);
    else next.delete(key);
    setManual(next);
    cache(next, auto);
    void onToggle(key, nowDone);
  }

  if (!hydrated) return null;
  const count = tasks.filter((t) => isDone(t.key, t.autoKey)).length;
  const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
  const firstName = (userName ?? "").trim().split(" ")[0];
  const greeting =
    introText?.(firstName) ??
    `Welcome, ${firstName}. Below are tasks to help you get familiar with the platform. Check off each one as you go. A few tick automatically.`;

  return (
    <div
      data-onboarding-widget
      className="fixed bottom-4 left-4 z-50 print:hidden"
    >
      {open ? (
        <div
          role="region"
          aria-label={title}
          className="flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-border bg-background shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">{title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse onboarding checklist"
              className="rounded px-2 py-0.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground"
            >
              Hide
            </button>
          </div>
          <div className="overflow-y-auto p-3">
            {firstName ? (
              <p className="mb-2 text-xs text-muted">{greeting}</p>
            ) : null}
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-muted">
                {count}/{tasks.length}
              </span>
            </div>
            <ul className="space-y-1.5">
              {tasks.map((t) => {
                const done = isDone(t.key, t.autoKey);
                const locked = isLocked(t.key, t.autoKey);
                return (
                  <li key={t.key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={locked}
                      onChange={() => toggle(t.key, t.autoKey)}
                      className="mt-0.5"
                      aria-label={t.label}
                    />
                    <span className={done ? "text-muted line-through" : ""}>
                      {t.label}
                      {t.href ? (
                        <>
                          {" "}
                          <a href={t.href} className="text-brand hover:underline">
                            Go
                          </a>
                        </>
                      ) : null}
                      {locked ? (
                        <span className="ml-1 text-xs text-ok">(done)</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            {tasks.length > 0 && count === tasks.length ? (
              <p className="mt-3 text-sm font-medium text-ok">{completionText}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold shadow-lg hover:bg-surface-2"
          aria-label="Open onboarding checklist"
        >
          🎯 {collapsedLabel} ({count}/{tasks.length})
        </button>
      )}
    </div>
  );
}
