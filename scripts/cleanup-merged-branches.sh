#!/bin/bash
#
# cleanup-merged-branches.sh
#
# Reusable script to delete merged-not-deleted branches in a GitHub repository.
# Safety rails: Only deletes branches that have merged PRs and zero commits ahead of main.
#
# Usage:
#   bash scripts/cleanup-merged-branches.sh        # Dry-run mode
#   bash scripts/cleanup-merged-branches.sh --apply # Actual deletion
#
# Exit codes:
#   0 - Success (no errors)
#   1 - Errors occurred

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
APPLY_MODE=false
if [[ "${1:-}" == "--apply" ]]; then
    APPLY_MODE=true
fi

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check gh is installed
    if ! command -v gh &> /dev/null; then
        log_error "gh CLI is not installed"
        exit 1
    fi

    # Check git is installed
    if ! command -v git &> /dev/null; then
        log_error "git is not installed"
        exit 1
    fi

    # Check we're in a git repo
    if ! git rev-parse --git-dir &> /dev/null; then
        log_error "Not a git repository"
        exit 1
    fi

    # Check origin remote exists
    if ! git remote get-url origin &> /dev/null; then
        log_error "No 'origin' remote configured"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Get repo info
get_repo_info() {
    REPO_JSON=$(gh repo view --json nameWithOwner)
    REPO_NAME=$(echo "$REPO_JSON" | jq -r '.nameWithOwner')
    DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef | jq -r '.defaultBranchRef.name')

    log_info "Repository: $REPO_NAME"
    log_info "Default branch: $DEFAULT_BRANCH"
}

# Fetch latest refs
fetch_latest() {
    log_info "Fetching latest refs from origin..."
    git fetch origin --prune 2>&1 || log_warn "Fetch had issues, continuing..."
    log_success "Fetch complete"
}

# Main execution
main() {
    echo "========================================"
    echo "  Cleanup Merged Branches Script"
    echo "========================================"
    echo ""

    if $APPLY_MODE; then
        log_warn "Running in APPLY MODE - branches will be deleted!"
    else
        log_info "Running in DRY-RUN mode - no changes will be made"
    fi
    echo ""

    check_prerequisites
    get_repo_info
    fetch_latest

    # Get merged and open PRs
    log_info "Fetching merged PRs..."
    MERGED_BRANCHES=$(gh pr list --state merged --limit 1000 --json headRefName -q '.[].headRefName')

    log_info "Fetching open PRs..."
    OPEN_BRANCHES=$(gh pr list --state open --limit 1000 --json headRefName -q '.[].headRefName')

    # Get all remote branches
    log_info "Analyzing branches..."
    echo ""
    printf "%-50s %-15s %s\n" "BRANCH" "STATUS" "REASON"
    echo "────────────────────────────────────────────────────────────────────────────────────"

    local candidates=()
    local skipped=0
    local errors=0

    while IFS= read -r branch; do
        [[ -z "$branch" ]] && continue
        
        # Skip main/master and default branch
        if [[ "$branch" == "main" ]] || [[ "$branch" == "master" ]] || [[ "$branch" == "$DEFAULT_BRANCH" ]]; then
            printf "%-50s %-15s %s\n" "$branch" "SKIPPED" "protected (default)"
            ((skipped++)) || true
            continue
        fi

        # Check if branch has open PR
        if echo "$OPEN_BRANCHES" | grep -Fxq "$branch"; then
            printf "%-50s %-15s %s\n" "$branch" "SKIPPED" "has open PR"
            ((skipped++)) || true
            continue
        fi

        # Check if branch has merged PR
        if ! echo "$MERGED_BRANCHES" | grep -Fxq "$branch"; then
            printf "%-50s %-15s %s\n" "$branch" "SKIPPED" "no merged PR"
            ((skipped++)) || true
            continue
        fi

        # Check if branch is ahead of main
        ahead=$(git rev-list "origin/main..origin/$branch" --count 2>/dev/null || echo "0")
        if [[ "$ahead" != "0" ]]; then
            printf "%-50s %-15s %s\n" "$branch" "SKIPPED" "$ahead commits ahead"
            ((skipped++)) || true
            continue
        fi

        # All criteria passed - this is a candidate for deletion
        printf "%-50s %-15s %s\n" "$branch" "CANDIDATE" "ready for deletion"
        candidates+=("$branch")

    done < <(git for-each-ref refs/remotes/origin/ --format='%(refname:short)' 2>/dev/null | sed 's|origin/||' | grep -v "^${DEFAULT_BRANCH}$")

    echo ""
    
    # Handle deletions
    if [[ ${#candidates[@]} -eq 0 ]]; then
        log_info "No branches to delete"
    elif $APPLY_MODE; then
        log_warn "APPLY MODE: About to delete ${#candidates[@]} branches"
        log_info "Waiting 3 seconds..."
        sleep 3

        for branch in "${candidates[@]}"; do
            log_info "Deleting branch: $branch"
            if gh api -X DELETE "repos/$REPO_NAME/git/refs/heads/$branch" 2>/dev/null; then
                log_success "Deleted: $branch"
            else
                log_error "Failed to delete: $branch"
                ((errors++)) || true
            fi
        done
    else
        log_info "Dry-run mode: would delete ${#candidates[@]} branches"
        log_info "Run with --apply to actually delete"
    fi

    echo ""
    local deleted_count
    deleted_count=$((${#candidates[@]} - errors))
    log_success "Summary: ${#candidates[@]} candidates, $deleted_count deleted, $skipped skipped, $errors errors"

    if [[ $errors -gt 0 ]]; then
        exit 1
    fi
}

# Run main
main "$@"