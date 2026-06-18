# Workspace Rules

## Security Check Before Git Push
- **Mandatory Scan:** Before performing any `git push` or committing code meant for a remote repository, you must scan all modified or new files.
- **Sensitive Data Block:** Ensure that no API keys, Personal Access Tokens (PATs), Personally Identifiable Information (PII) (like absolute local paths, full names, or email addresses), or other credentials/sensitive information are being pushed.
- **Remediation:** If sensitive data is found, immediately halt the push, notify the user, and offer to anonymize or move the sensitive data to a gitignored environment file.
