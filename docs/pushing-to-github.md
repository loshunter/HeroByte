# Pushing the Local Repository to GitHub

Follow these steps to publish the local `HeroByte` repository to the remote `https://github.com/loshunter/HeroByte`.

## 1. Add the Remote

If the remote is not yet configured, add it and name it `origin`:

```bash
git remote add origin https://github.com/loshunter/HeroByte.git
```

To verify, run `git remote -v` and confirm the `origin` entry points to the GitHub URL.

## 2. Authenticate with GitHub

Log in with a personal access token that has `repo` scope. For example:

```bash
gh auth login --scopes repo
```

You can also export the token to `GIT_ASKPASS` or use a credential manager, depending on your environment.

## 3. Push the Branch

Push the current branch (e.g., `work`) and set the upstream tracking reference:

```bash
git push -u origin work
```

If you intend to publish a different branch, replace `work` with that branch name. Subsequent pushes only need `git push`.

## 4. Create a Pull Request (Optional)

If you use GitHub CLI:

```bash
gh pr create --fill
```

Or open the repository on GitHub and create the PR manually.

## Troubleshooting

- **Remote already exists:** Update it with `git remote set-url origin https://github.com/loshunter/HeroByte.git`.
- **Authentication failures:** Ensure the token is valid and has the necessary scopes.
- **Force pushing:** Avoid `--force` unless you are intentionally rewriting history; coordinate with collaborators before doing so.

