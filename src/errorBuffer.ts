"use client";

// Small ring buffer of recent client errors, attached to feedback reports so
// bug reports carry the actual JS error (testers usually cannot describe it).
const MAX = 10;
let buffer: string[] = [];
let installed = false;

function push(msg: string) {
  buffer.push(msg.slice(0, 500));
  if (buffer.length > MAX) buffer = buffer.slice(-MAX);
}

export function installErrorCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    const where = e.filename ? ` @ ${e.filename}:${e.lineno}:${e.colno}` : "";
    push(`Error: ${e.message}${where}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    push(`Unhandled rejection: ${String(e.reason)}`);
  });
}

export function getRecentErrors(): string[] {
  return [...buffer];
}
