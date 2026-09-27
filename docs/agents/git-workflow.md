# Git Workflow

## Branches

- **`main`**: the public/stable branch. Only fast-forwarded from `dev` when the user explicitly says to ship — never pushed to directly by an agent.
- **`dev`**: the working branch. All ticket implementations (`/implement`) commit and push here.

## Default behavior for agents

- Work happens on `dev`. Before implementing a ticket, make sure the current branch is `dev` (`git checkout dev`, creating it from `main` if it doesn't exist yet).
- Commit to `dev`, then `git push` (or `git push -u origin dev` if it isn't tracking a remote branch yet).
- **Never push to `main`** and never merge `dev` into `main` unless the user explicitly asks for it in that conversation. A prior approval to push `dev` does not extend to `main`.
- When the user does ask to ship: merge (or fast-forward) `dev` into `main` and push `main`, following the repo's standard git-safety rules (check `git status`/divergence first, no `--force`, no skipped hooks, confirm before anything destructive).

## Why

The user wants to keep iterating on `dev` — testing each ticket locally as it lands — without every commit going live on `main` immediately. `main` only moves when the user is ready to publish.
