# Quiz & Chill: durable Codex instructions

## Continuity documentation

- For every non-trivial implementation, fix, configuration change, or release decision, update `docs/HANDOFF.md` before handing work back.
- Treat `docs/HANDOFF.md` as the detailed continuity record for future Codex sessions. Record architecture changes, game-flow decisions, provider/API behavior, environment variable names only, test/QA evidence, deployment behavior, known limits, and the current release state.
- Never record secrets, API keys, tokens, private URLs, credential values, or personal data that is unnecessary for operation.
- At the start of substantive work, read `docs/HANDOFF.md`, inspect `git status`, and use code/tests as the final authority if documentation conflicts with the repository.

## Publishing from Codex

- Do not publish, commit, or trigger deployment without explicit user authorization.
- Prefer the authenticated GitHub connector for publication from Codex. It is independent of the local `gh`/Windows keyring and can read or update `conradoch/quiz-and-chill` directly.
- Before a remote update, inspect the intended local diff, check it for secrets, run relevant validation, and verify the current remote version of affected files through the GitHub connector.
- When authorized, publish only the intentional paths with a clear commit message through the GitHub connector. Confirm the resulting remote state after the update.
- The Codex sandbox may not be able to write `.git` or use the local credential manager. Do not treat a failed `gh auth status` in Codex as a GitHub-connector failure, and do not expose or request a token as a workaround.
- A connector-based publication may leave a local VS Code checkout behind the remote. When the user has terminal access, they can synchronize it with `git pull --ff-only`; do not run destructive reset commands without explicit approval.
