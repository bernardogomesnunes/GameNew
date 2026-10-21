# Repository workflow

- Commit coherent progress regularly while working. Preserve existing uncommitted work before integrating other branches.
- At the end of each task, run the relevant checks, commit and push the task branch, and open a pull request against `main`. Report the PR link and any remaining limitations.
- If PR creation is blocked by authentication or permissions, keep the pushed branch intact and report the blocker explicitly. Do not silently leave work only on this computer.
- Merge into `main` only when the user authorizes integration. Reconcile with current remote main and verify the combined result before pushing. Never force-push shared history or discard other work.
- Keep `docs/TASKS.md` as the single task list and update task status when work is integrated.
