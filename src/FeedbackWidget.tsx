"use client";

import { useEffect, useRef, useState } from "react";
import { installErrorCapture, getRecentErrors } from "./errorBuffer";
import type {
  FeedbackOption,
  FeedbackPayload,
  FeedbackResult,
} from "./types";

/** Capture the current page as a downscaled JPEG data URL (best-effort). */
async function capturePage(): Promise<string | null> {
  try {
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      ignoreElements: (el) =>
        el instanceof HTMLElement &&
        (el.hasAttribute("data-feedback-widget") ||
          el.hasAttribute("data-onboarding-widget")),
    });
    const maxW = 1000;
    const scale = Math.min(1, maxW / canvas.width);
    const out = document.createElement("canvas");
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

export interface FeedbackWidgetProps {
  /** Feedback categories (Type chips). The first is the default selection. */
  categories: FeedbackOption[];
  /** Severity options. "normal" is used as the default if present. */
  severities: FeedbackOption[];
  /** Signed-in user's email; when present the email field is hidden. */
  userEmail: string | null;
  /** Current user role, stored in the report context. */
  role?: string | null;
  /** App/build version (e.g. git SHA), stored in the report context. */
  appVersion?: string | null;
  /** Persist + insert the report. Bring your own server action. */
  onSubmit: (payload: FeedbackPayload) => Promise<FeedbackResult>;
  /** localStorage key for the in-progress draft. */
  draftKey?: string;
  /**
   * Shown near the screenshot and in the annotator: tells the submitter they're
   * responsible for redacting sensitive info before sending. Override per
   * deployment with your own legal wording.
   */
  redactionDisclaimer?: string;
}

const DEFAULT_REDACTION_DISCLAIMER =
  "Please black out any sensitive information before sending. We are not liable for anything not redacted.";

export function FeedbackWidget({
  categories,
  severities,
  userEmail,
  role = null,
  appVersion = null,
  onSubmit,
  draftKey = "site-fb-draft",
  redactionDisclaimer = DEFAULT_REDACTION_DISCLAIMER,
}: FeedbackWidgetProps) {
  const cats = categories;
  const sevs = severities;

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(cats[0]?.key ?? "bug");
  const [severity, setSeverity] = useState("normal");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [shot, setShot] = useState<string | null>(null); // original capture
  const [annotated, setAnnotated] = useState<string | null>(null); // with drawing
  const [annotating, setAnnotating] = useState(false); // full-screen overlay open
  const [mode, setMode] = useState<"draw" | "redact" | "scroll">("draw");
  const [capturing, setCapturing] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const redactSnapshot = useRef<ImageData | null>(null);
  const redactStart = useRef<{ x: number; y: number } | null>(null);

  // Install error capture once.
  useEffect(() => {
    installErrorCapture();
  }, []);

  // Restore a saved draft.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.kind) setKind(d.kind);
        if (d.severity) setSeverity(d.severity);
        if (d.message) setMessage(d.message);
      }
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  // Persist the draft as it changes.
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ kind, severity, message }));
    } catch {
      /* ignore */
    }
  }, [draftKey, kind, severity, message]);

  // Paint the current image onto the annotation canvas when the overlay opens.
  useEffect(() => {
    if (!annotating || !canvasRef.current) return;
    const src = annotated ?? shot;
    if (!src) return;
    const canvas = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotating]);

  function reset() {
    setKind(cats[0]?.key ?? "bug");
    setSeverity("normal");
    setMessage("");
    setEmail("");
    setShot(null);
    setAnnotated(null);
    setAnnotating(false);
    setDone(false);
    setError(null);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }

  async function onCapture() {
    setCapturing(true);
    setError(null);
    setOpen(false);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const data = await capturePage();
    setOpen(true);
    setCapturing(false);
    if (data) {
      setShot(data);
      setAnnotated(null);
    } else {
      setError("Could not capture this page. You can still send without a screenshot.");
    }
  }

  // Open the full-screen annotator. Default to scroll mode on touch devices so a
  // tall screenshot can be positioned before drawing; draw mode on mouse.
  function openAnnotator() {
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;
    setMode(coarse ? "scroll" : "draw");
    setAnnotating(true);
  }

  function doneAnnotating() {
    const canvas = canvasRef.current;
    if (canvas) setAnnotated(canvas.toDataURL("image/jpeg", 0.6));
    setAnnotating(false);
  }

  function removeScreenshot() {
    setShot(null);
    setAnnotated(null);
    setAnnotating(false);
  }

  // Freehand red annotation, or a solid black redaction box, on the canvas.
  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === "scroll") return; // let the browser pan
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);
    if (mode === "redact") {
      redactSnapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      redactStart.current = p;
      return;
    }
    drawing.current = true;
    ctx.strokeStyle = "#e11d48";
    ctx.lineWidth = Math.max(3, canvas.width / 250);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === "scroll") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    if (mode === "redact") {
      const snapshot = redactSnapshot.current;
      const start = redactStart.current;
      if (!snapshot || !start) return;
      const p = canvasPoint(e);
      ctx.putImageData(snapshot, 0, 0);
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x);
      const h = Math.abs(p.y - start.y);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
      return;
    }
    if (!drawing.current) return;
    const p = canvasPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === "redact") {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const snapshot = redactSnapshot.current;
      const start = redactStart.current;
      if (canvas && ctx && snapshot && start) {
        const p = canvasPoint(e);
        const x = Math.min(start.x, p.x);
        const y = Math.min(start.y, p.y);
        const w = Math.abs(p.x - start.x);
        const h = Math.abs(p.y - start.y);
        ctx.putImageData(snapshot, 0, 0);
        // Below this size, treat it as an accidental tap and discard rather than
        // stamping a redaction box no one intended.
        if (w >= 8 && h >= 8) {
          ctx.fillStyle = "#000";
          ctx.fillRect(x, y, w, h);
        }
      }
      redactSnapshot.current = null;
      redactStart.current = null;
      return;
    }
    drawing.current = false;
  }
  function clearDrawing() {
    if (!shot || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);
    };
    img.src = shot;
  }

  async function onSend() {
    setSending(true);
    setError(null);
    const screenshot = annotated ?? shot;
    const context = {
      role: role ?? "anonymous",
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : null,
      screen:
        typeof window !== "undefined"
          ? `${window.screen.width}x${window.screen.height}`
          : null,
      language: typeof navigator !== "undefined" ? navigator.language : null,
      appVersion: appVersion ?? null,
      consoleErrors: getRecentErrors(),
    };
    const res = await onSubmit({
      kind,
      message,
      severity,
      email: email || userEmail,
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      screenshot,
      context,
      company,
    });
    setSending(false);
    if (res.ok) {
      setDone(true);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    } else setError(res.error ?? "Something went wrong. Please try again.");
  }

  const inputBase =
    "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <>
      <div data-feedback-widget className="fixed bottom-4 right-4 z-50 print:hidden">
        {open ? (
          <div className="flex max-h-[80vh] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-sm font-semibold">Send feedback</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {done ? (
              <div className="p-4">
                <p className="text-sm font-medium text-ok">
                  ✓ Thanks! Your feedback was sent.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-3 text-sm font-semibold text-brand hover:underline"
                >
                  Send another
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto p-4">
                <div>
                  <label className="text-xs font-medium text-muted">Type</label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {cats.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setKind(c.key)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                          kind === c.key
                            ? "border-brand bg-brand/5 text-brand"
                            : "border-border text-muted hover:bg-surface-2"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted" htmlFor="fb-sev">
                    Severity
                  </label>
                  <select
                    id="fb-sev"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className={inputBase}
                  >
                    {sevs.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted" htmlFor="fb-msg">
                    What happened, or what would you change?
                  </label>
                  <textarea
                    id="fb-msg"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={inputBase}
                    placeholder="Describe the bug or the change you'd like."
                  />
                </div>

                {userEmail ? null : (
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor="fb-email">
                      Your email (optional)
                    </label>
                    <input
                      id="fb-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                )}

                {/* Honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="hidden"
                  aria-hidden
                />

                {shot ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted">Screenshot attached.</p>
                    <p className="text-xs text-muted">{redactionDisclaimer}</p>
                    <button
                      type="button"
                      onClick={openAnnotator}
                      aria-label="Mark on screenshot"
                      className="group relative block w-full overflow-hidden rounded border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={annotated ?? shot}
                        alt="Screenshot preview"
                        className="block w-full"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
                        <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                          ✏️ Tap to mark
                        </span>
                      </span>
                    </button>
                    <div className="flex justify-end text-xs">
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="text-muted hover:text-foreground"
                      >
                        Remove screenshot
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onCapture}
                    disabled={capturing}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-60"
                  >
                    {capturing ? "Capturing…" : "📷 Attach screenshot of this page"}
                  </button>
                )}

                {error ? <p className="text-xs text-danger">{error}</p> : null}

                <button
                  type="button"
                  onClick={onSend}
                  disabled={sending || message.trim() === ""}
                  className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-dark disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send feedback"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg shadow-lg hover:bg-brand-dark"
          >
            Send feedback
          </button>
        )}
      </div>

      {/* Full-screen screenshot annotator: Draw / Redact / Scroll toggle so tall
          screenshots can be scrolled on touch, marked up, or redacted before sending. */}
      {annotating && shot ? (
        <div
          data-feedback-widget
          className="fixed inset-0 z-[60] flex flex-col bg-black/90 print:hidden"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-white">
            <div className="flex rounded-md border border-white/30 text-xs">
              <button
                type="button"
                onClick={() => setMode("draw")}
                className={`rounded-l-md px-3 py-1.5 font-medium ${
                  mode === "draw" ? "bg-white text-black" : "text-white/80"
                }`}
              >
                ✏️ Draw
              </button>
              <button
                type="button"
                onClick={() => setMode("redact")}
                className={`px-3 py-1.5 font-medium ${
                  mode === "redact" ? "bg-white text-black" : "text-white/80"
                }`}
              >
                ⬛ Redact
              </button>
              <button
                type="button"
                onClick={() => setMode("scroll")}
                className={`rounded-r-md px-3 py-1.5 font-medium ${
                  mode === "scroll" ? "bg-white text-black" : "text-white/80"
                }`}
              >
                ✋ Scroll
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={clearDrawing}
                title="Clears all drawing and redaction marks"
                className="text-white/80 hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={doneAnnotating}
                className="rounded-md bg-brand px-4 py-1.5 font-semibold text-brand-fg hover:bg-brand-dark"
              >
                Done
              </button>
            </div>
          </div>
          <p className="px-3 text-center text-xs text-white/70">
            {mode === "draw"
              ? "Drag to draw. Switch to Redact to black out sensitive info, or Scroll to move a tall screenshot."
              : mode === "redact"
                ? "Drag to black out sensitive info. Switch to Draw to mark the problem, or Scroll to move a tall screenshot."
                : "Scroll to position. Switch to Draw or Redact to mark up the screenshot."}
          </p>
          <p className="px-3 pb-2 text-center text-xs text-white/50">{redactionDisclaimer}</p>
          <div className="flex-1 overflow-auto p-3">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className={`mx-auto block h-auto w-full max-w-3xl rounded bg-white ${
                mode === "scroll" ? "cursor-default touch-pan-y" : "cursor-crosshair touch-none"
              }`}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
