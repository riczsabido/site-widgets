# site-widgets

Reusable, prop-driven **Feedback** and **Onboarding** widgets for Next.js (App Router) apps.

The UI lives here and is shared across projects (fix once, bump version everywhere).
The database/auth glue is **not** here. Each project supplies its own server
actions, schema, and config (see `template/`). This split is deliberate: the
parts that differ per project (Supabase schema, auth helpers, admin model) stay
in the project; the parts you iterate on (the widgets) stay shared.

## What's in the box

- `FeedbackWidget`: floating "Send feedback" button with category + severity +
  message + one-click page screenshot (html2canvas-pro) and a full-screen
  red-pen annotator (Draw/Scroll toggle for tall screenshots on touch),
  draft persistence, console-error capture, honeypot.
- `OnboardingWidget`: role-aware checklist. Manual checkboxes + auto-detected
  tasks (auto locks). Server-backed state with sessionStorage cache, progress
  bar, default-open on first visit.
- `installErrorCapture` / `getRecentErrors`: error ring buffer (the widget
  installs this for you; exported in case you want it elsewhere).

## Install

Consumed as source (TSX), no build step. The consuming app transpiles it.

1. Add the dependency (git URL, no npm publish needed):
   ```jsonc
   // package.json
   "dependencies": {
     "site-widgets": "github:<you>/site-widgets#v1.0.0"
   }
   ```
   For local development you can instead use `"file:../path/to/site-widgets"`.

2. Tell Next to transpile it:
   ```ts
   // next.config.ts
   export default { transpilePackages: ["site-widgets"] };
   ```

3. **(Tailwind v4) Source the package so its classes are generated.** Tailwind
   does not scan `node_modules` automatically, so without this the widgets
   render unstyled/misaligned. Add to the CSS file that has `@import "tailwindcss"`
   (path is relative to that file):
   ```css
   @source "../../node_modules/site-widgets/src";
   ```
   Also ensure the required tokens below exist in your theme.

4. Provide the per-project glue. Copy `template/` into your project and edit:
   - `0001_site_widgets.sql`: replace `${SCHEMA}`, run the migration.
   - `feedback.actions.ts` + `onboarding.actions.ts`: wire your Supabase client + auth.
   - `widgets.config.ts`: your categories, severities, tasks per role.
   - `FeedbackWidget.binding.tsx` + `OnboardingWidget.binding.tsx`: mount these in your layout.

## Props

### `<FeedbackWidget>`

| prop         | type                                              | notes                                  |
|--------------|---------------------------------------------------|----------------------------------------|
| `categories` | `FeedbackOption[]`                                | Type chips. First is the default.      |
| `severities` | `FeedbackOption[]`                                | "normal" used as default if present.   |
| `userEmail`  | `string \| null`                                  | When set, the email field is hidden.   |
| `role`       | `string \| null` (optional)                       | Stored in report context.              |
| `appVersion` | `string \| null` (optional)                       | e.g. git SHA. Stored in context.       |
| `onSubmit`   | `(p: FeedbackPayload) => Promise<FeedbackResult>` | Your server action.                    |
| `draftKey`   | `string` (optional)                               | localStorage draft key.                |

### `<OnboardingWidget>`

| prop             | type                                          | notes                                   |
|------------------|-----------------------------------------------|-----------------------------------------|
| `title`          | `string`                                      | Panel heading.                          |
| `tasks`          | `OnboardingTask[]`                            | Resolve role to tasks in your config.   |
| `userName`       | `string \| null` (optional)                   | First name greeting; null = skip.       |
| `storageKey`     | `string`                                      | Unique per user, e.g. `app-onb-${id}`.  |
| `getState`       | `() => Promise<OnboardingState>`              | Your server action.                     |
| `onToggle`       | `(key, done) => Promise<void>`                | Your server action.                     |
| `introText`      | `(firstName) => string` (optional)            | Greeting override.                      |
| `completionText` | `string` (optional)                           | Shown when all tasks done.              |
| `collapsedLabel` | `string` (optional)                           | Default "Test tasks".                   |

## Required Tailwind tokens

The widgets use these semantic classes. If your project doesn't define them,
add them to your CSS theme (or restyle):

`bg-background`, `text-foreground`, `text-muted`, `border-border`,
`bg-surface-2`, `bg-brand`, `bg-brand-dark`, `text-brand`, `text-brand-fg`,
`bg-brand/5`, `text-ok`, `text-danger`.

## Updating across projects

Fix the widget here, bump the version, and update the `#vX.Y.Z` ref in each
consuming project's `package.json`. No code copying.
