# site-widgets binding template

Copy these files into a consuming project and wire them up. They are the
per-project glue the shared `site-widgets` package deliberately does not include.

## Steps

1. **Database.** Open `0001_site_widgets.sql`, replace every `${SCHEMA}` with
   your schema (e.g. `public`, `uerc`, `lotfinder`), and run it. It creates
   `site_feedback`, `onboarding_progress`, `is_admin()` (skip if you already
   have one), and `user_gave_feedback()`. Assumes a `<schema>.profiles` table
   with an `is_admin boolean` column; edit the policies if your admin model differs.

2. **Actions.** Put `feedback.actions.ts` and `onboarding.actions.ts` at
   `src/components/feedback/actions.ts` and `src/components/onboarding/actions.ts`
   (or wherever you prefer). Fix the two imports at the top of each to your
   Supabase server client and session helper. Make sure the client targets the
   right schema (via `db.schema` in `createClient`, or `.schema("<schema>")`).
   Extend `getOnboardingState` with project-specific auto-detects where marked.

3. **Config.** Put `widgets.config.ts` at `src/config/widgets.ts`. Edit
   categories, severities, and the per-role onboarding tasks. Each task `key`
   must be stable; an `autoKey` ties a task to an auto-detect you added in step 2.

4. **Bindings.** Put `FeedbackWidget.binding.tsx` and
   `OnboardingWidget.binding.tsx` next to your actions (rename to
   `FeedbackWidget.tsx` / `OnboardingWidget.tsx`). Adjust the `draftKey` /
   `storageKey` prefixes to your app name.

5. **Mount** in your root layout, gated on auth + the master switch:
   ```tsx
   import { widgets } from "@/config/widgets";
   import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
   import { OnboardingWidget } from "@/components/onboarding/OnboardingWidget";

   {widgets.enabled && session.userId ? (
     <>
       {widgets.feedback.enabled ? (
         <FeedbackWidget
           userEmail={session.email}
           role={session.profile?.role ?? null}
           appVersion={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null}
         />
       ) : null}
       {widgets.onboarding.enabled ? (
         <OnboardingWidget
           role={session.profile?.role ?? null}
           userId={session.userId}
           userName={session.profile?.full_name ?? null}
         />
       ) : null}
     </>
   ) : null}
   ```

6. **Transpile.** Add `transpilePackages: ["site-widgets"]` to `next.config.ts`.

7. **(Tailwind v4) Source the package** in your `@import "tailwindcss"` CSS file,
   or the widgets render unstyled (Tailwind skips `node_modules`):
   ```css
   @source "../../node_modules/site-widgets/src";
   ```

## Triage feedback

```sql
select id, kind, severity, message, page_url, created_at
from <schema>.site_feedback
where status <> 'done'
order by created_at desc;
```
Screenshots are base64 data URLs in `screenshot`. Mark handled with
`update <schema>.site_feedback set status = 'done' where id = '...';`.
