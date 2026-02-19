# OpenTax — Claude Code Instructions

## Commits

After making and verifying a change, commit it. Follow this workflow:

1. **Make the change** — implement the requested feature or fix.
2. **Verify** — run `npm run build` (or the relevant test command) to confirm the change is correct and the build is clean.
3. **Commit** — stage the relevant files and create a focused commit with a clear message.

If verification requires user input (e.g. visual UI review in the browser, or a runtime test that can't be automated), ask the user to confirm the change looks good **before** committing.

Do not commit broken builds, failing tests, or unverified UI changes.

## Parallel Agent Development with Git Worktrees

Use git worktrees when multiple agents need to work on the repo simultaneously. Each worktree is an isolated working directory on its own branch, sharing the same git history.

### Creating a worktree

```bash
# From the main repo root
git worktree add ../opentax-wt/<task> -b agent/<task>
cp opentax.db ../opentax-wt/<task>/opentax.db   # isolated DB copy
```

Worktrees live at `../opentax-wt/` (sibling to the main repo, outside git tracking).

### Running the dev server in a worktree

Each worktree needs its own ports to avoid conflicts:

```bash
cd ../opentax-wt/<task>
npm install
OPENTAX_PORT=7892 npx concurrently -n fe,be -c blue,green \
  "vite --port 5174" \
  "tsx --import ./server/resolve-hook.ts server/main.ts"
```

Increment ports for each additional worktree (7893/5175, 7894/5176, …).

### Finishing a task

```bash
# From the main repo
git worktree remove ../opentax-wt/<task>   # removes dir and ref
# Then open a PR from branch agent/<task> into main
```

### Key rules

- **Never nest worktrees inside the main repo directory.**
- Each worktree must have its own `opentax.db` — agents sharing a SQLite file will corrupt it.
- Treat `package-lock.json` as read-only in worktrees; run `npm install` only, never `npm update`.
- Branch naming: `agent/<short-task-name>` (e.g. `agent/w2-validation`).
