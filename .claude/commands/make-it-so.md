Run the following steps in order:

1. Run `npm run build` from the project root. If it fails, stop and report the error.
2. Run `firebase deploy --only hosting`. If it fails, stop and report the error.
3. Run `git status` and `git diff` to see what has changed, then `git log --oneline -5` to match the commit style.
4. Stage all modified tracked files (do not use `git add -A` — stage specific files by name to avoid accidentally including .env or other sensitive files).
5. Commit with a concise message summarizing the changes, following the style of recent commits. Always append: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
6. Push to the remote.

Report the final deployed URL and commit hash when done.
