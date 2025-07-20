---
description: Sync fork with upstream repository
allowed-tools: Bash
argument-hint: "[branch] (default: main)"
---

# Fork Sync

<objective>
Synchronize your GitHub fork with the upstream repository, ensuring all branches are aligned.
</objective>

<prerequisites>
Verify required tools and configuration before sync:
</prerequisites>

!# Check GitHub CLI
!which gh >/dev/null 2>&1 || (echo "Error: GitHub CLI not installed" && exit 1)

!# Check authentication
!gh auth status >/dev/null 2>&1 || (echo "Error: Not authenticated. Run 'gh auth login'" && exit 1)

!# Check upstream remote
!git remote get-url upstream >/dev/null 2>&1 || (echo "Error: No upstream remote. Add with 'git remote add upstream <url>'" && exit 1)

<state-management>
Save current state for restoration after sync:
</state-management>

!# Save current branch
!CURRENT_BRANCH=$(git branch --show-current)

!# Handle uncommitted changes
!if [ -n "$(git status --porcelain)" ]; then git stash push -q -m "fork-sync-$(date +%s)" && echo "STASHED" > /tmp/fork-sync-state; else echo "CLEAN" > /tmp/fork-sync-state; fi

<sync-operations>
Execute the synchronization steps:
</sync-operations>

!# Fetch all remotes
!git fetch --all --prune -q

!# Sync fork via GitHub API
!BRANCH="${ARGUMENTS:-main}"
!gh repo sync --branch "$BRANCH" 2>&1

!# Update local references
!git fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" -q

!# Update local branch
!if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then git checkout "$BRANCH" -q 2>/dev/null || exit 1; fi
!git pull origin "$BRANCH" --ff-only -q 2>&1

<validation>
Verify synchronization was successful:
</validation>

!# Get commit SHAs
!LOCAL=$(git rev-parse "$BRANCH" 2>/dev/null)
!ORIGIN=$(git rev-parse "origin/$BRANCH" 2>/dev/null)
!UPSTREAM=$(git rev-parse "upstream/$BRANCH" 2>/dev/null)

!# Check sync status
!if [ "$LOCAL" = "$ORIGIN" ] && [ "$ORIGIN" = "$UPSTREAM" ]; then echo "Success: All repositories synchronized at $LOCAL"; else echo "Error: Sync incomplete - Local: $LOCAL, Fork: $ORIGIN, Upstream: $UPSTREAM" && exit 1; fi

<restoration>
Restore original working state:
</restoration>

!# Return to original branch
!if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then git checkout "$CURRENT_BRANCH" -q; fi

!# Restore stashed changes
!if [ -f /tmp/fork-sync-state ] && grep -q "STASHED" /tmp/fork-sync-state; then git stash pop -q && rm /tmp/fork-sync-state; fi