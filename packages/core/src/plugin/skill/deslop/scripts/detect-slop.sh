#!/usr/bin/env bash
# detect-slop.sh
# Scans git status / git diff for AI slop:
# 1. Extra commentary & narration
# 2. Odd try/catches & swallowed errors
# 3. Lazy any types
# 4. Deeply nested logic

set -euo pipefail

echo "🔍 Scanning git status for AI slop (comments, odd try/catches, any types, deep nesting)..."

# Get modified and added files
files=$(git status --porcelain | awk '{print $NF}' | grep -E '\.(ts|tsx|js|jsx|vue|svelte|py|go|rs|php)$' || true)

if [ -z "$files" ]; then
    echo "✅ No changed source code files found in git status."
    exit 0
fi

found_count=0

for file in $files; do
    if [ ! -f "$file" ]; then
        continue
    fi

    # Check git diff for added lines
    diff_output=$(git diff -U0 HEAD -- "$file" 2>/dev/null || git diff -U0 -- "$file" 2>/dev/null || true)

    if [ -z "$diff_output" ]; then
        # For untracked newly added files, check the whole file
        if git status --porcelain "$file" | grep -q '^??'; then
            diff_output=$(cat "$file" | sed 's/^/+/')
        fi
    fi

    if [ -z "$diff_output" ]; then
        continue
    fi

    added_lines=$(echo "$diff_output" | grep -E '^\+[^\+]' || true)
    if [ -z "$added_lines" ]; then
        continue
    fi

    file_has_slop=0
    file_output=""

    # 1. Check for AI commentary
    comment_lines=$(echo "$added_lines" | grep -E '^\+[ ]*(//|/\*|\*|\{/\*)' || true)
    if [ -n "$comment_lines" ]; then
        ai_comments=$(echo "$comment_lines" | grep -Ei 'previously|lost internal state|fixed bug|now uses|note that|make sure to|step [0-9]|notice how|render |action buttons|loop through|check if|click delete|handle [a-z0-9]+ click|state for|helper to|modal backdrop|close modal|====|----' || true)
        if [ -n "$ai_comments" ]; then
            file_has_slop=1
            file_output+="\n  💬 [AI Comments / Narration]:\n"
            file_output+=$(echo "$ai_comments" | sed 's/^+/    ⚠️  /')$'\n'
        fi
    fi

    # 2. Check for empty catches / odd try-catches
    odd_catches=$(echo "$added_lines" | grep -Ei 'catch[ ]*\(.*?\)[ ]*\{[ ]*\}|catch[ ]*\{[ ]*\}|catch[ ]*\(.*?\)[ ]*\{[ ]*//|catch[ ]*\(.*?\)[ ]*\{[ ]*return (null|true|false|undefined|\{\}|\[\]);' || true)
    if [ -n "$odd_catches" ]; then
        file_has_slop=1
        file_output+="\n  🪤 [Odd Try/Catch or Swallowed Error]:\n"
        file_output+=$(echo "$odd_catches" | sed 's/^+/    ⚠️  /')$'\n'
    fi

    # 3. Check for lazy any types
    any_types=$(echo "$added_lines" | grep -E ':\s*any\b|\bas\s+any\b|<any>' || true)
    if [ -n "$any_types" ]; then
        file_has_slop=1
        file_output+="\n  🏷️  [Lazy any Type Cast]:\n"
        file_output+=$(echo "$any_types" | sed 's/^+/    ⚠️  /')$'\n'
    fi

    # 4. Check for deep nesting (e.g. 5+ indent levels of 2-spaces or 4-spaces with control flow)
    deep_nesting=$(echo "$added_lines" | grep -E '^\+\s{10,}(if|for|while|switch)\s*\(' || true)
    if [ -n "$deep_nesting" ]; then
        file_has_slop=1
        file_output+="\n  🌲 [Deep Nesting / Pyramid Control Flow]:\n"
        file_output+=$(echo "$deep_nesting" | sed 's/^+/    ⚠️  /')$'\n'
    fi

    if [ "$file_has_slop" -eq 1 ]; then
        echo ""
        echo "📄 File: $file"
        echo -e "$file_output"
        found_count=$((found_count + 1))
    fi
done

echo ""
if [ "$found_count" -gt 0 ]; then
    echo "⚠️  Found candidate AI slop in $found_count file(s)."
    echo "Run /deslop in Claude Code to review and clean them surgically."
else
    echo "✅ No obvious AI slop detected in modified files."
fi
