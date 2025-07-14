# Fork Management Guide

## Branch Strategy
- `main`: Clean mirror of upstream (NO modifications)
- `fork/main`: Fork development branch (all changes here)

## Workflow

### Initial Setup
```bash
# Create fork/main from current main
git checkout -b fork/main

# Push to origin
git push -u origin fork/main
```

### Sync Upstream
```bash
# Add upstream if not exists
git remote add upstream https://github.com/anthropics/gemini-cli.git

# Sync main with upstream
git checkout main
git fetch upstream
git merge upstream/main --ff-only
git push origin main
```

### Merge Upstream Changes to Fork
```bash
git checkout fork/main
git merge main
# Resolve conflicts if any
git push origin fork/main
```

### Development Flow
- All development on `fork/main`
- PRs target `fork/main`
- Never modify files in `main`

## GitHub Actions
- Workflows modified only in `fork/main`
- CI triggers on PRs to both `main` and `fork/main`
- Keep original workflows in `main` unchanged

## Quick Commands
```bash
# Daily upstream sync
git checkout main && git pull upstream main && git push

# Update fork with upstream
git checkout fork/main && git merge main

# New feature
git checkout -b feature/xyz fork/main
```