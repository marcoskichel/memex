#!/bin/bash

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ -z "$file_path" ]]; then
  exit 0
fi

if echo "$file_path" | grep -qE '(eslint\.config\.[^/]+$|packages/eslint-config/)'; then
  echo '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "ask",
      "permissionDecisionReason": "Modifying ESLint config — approve?"
    }
  }'
  exit 0
fi

exit 0
