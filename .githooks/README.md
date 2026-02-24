# Git hooks

This repo uses `.githooks/` for lightweight local protections.

Install hooks for your clone:

```bash
npm run hooks:install
```

Current hooks:
- `pre-commit`: blocks committing local datastore/SQLite files (`opentax.db*`, `*.sqlite`, `*.sqlite3`, `*.db`).
