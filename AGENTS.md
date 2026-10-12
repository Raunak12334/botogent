<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Git

-Never create branches, Worktrees and Commits automatically. Only do so When the user explicitly asks for that Specific action in the current Request.
-Leave changes uncommitted In the working tree On the current branch And let the user decide when And how to commit the changes.

# Database

-Only perform a database push (`drizzle-kit push` or `npm run db:push`) and never perform database migrations (`drizzle-kit generate`, `drizzle-kit migrate`, etc.) or generate migration artifacts.
-This is a development project. There is no backward compatibility. And the data is worthless. Prefer data loss, never backfill, migrate or preserve existing rows and never spend effort on keeping old data working; every schema change means a clean slate.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

# Forms & Server Actions

- **Schema Definition**:
  - Derive Zod schemas directly from Drizzle tables using `drizzle-zod` (`createInsertSchema`, `createSelectSchema`) in `lib/db/schema.ts`.
  - Refine constraints (`.min()`, `.max()`, etc.) directly in schema factories.
  - Derive TypeScript types using `z.infer<typeof schema>`.
- **Client Form Composition**:
  - Compose client forms using `react-hook-form` paired with `@hookform/resolvers/zod`.
  - Use project UI primitives (`components/ui/*`) for consistent styling.
  - When wrapping dialog triggers with Base UI (`@base-ui/react`), `DialogTrigger` expects a `React.ReactElement` for the `render` prop (type `trigger?: React.ReactElement`). Avoid passing `React.ReactNode` directly to `render`.
  - Design dialog components to support both controlled (`open`, `onOpenChange`) and uncontrolled (`trigger` element) usage.
  - Implement quick template pills and randomized/shuffle controls by updating form fields via `form.setValue(field, value, { shouldValidate: true })`.
  - Handle async submission states gracefully using `isSubmitting` and dynamic button transitions (e.g., `DynamicButton`).
  - Clear errors and reset form values on successful submission or dialog dismissal.
- **Server Actions (`actions/*.ts`)**:
  - Mark action files with `'use server'`.
  - Resolve and verify authentication on the server using Clerk's `await auth()` from `@clerk/nextjs/server`. Never accept or trust a client-supplied `userId`.
  - Parse and validate payloads with the `insertBotSchema` on the server before database operations.
  - Trigger Next.js cache revalidation with `revalidatePath(...)` after mutations.
  - Return typed result objects (e.g. `{ success: true, data } | { success: false, error }`) instead of throwing uncaught exceptions to the client.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`.
<!-- TRIGGER.DEV SKILLS END -->
