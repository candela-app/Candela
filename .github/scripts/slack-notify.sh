#!/usr/bin/env bash
# Post a plain-text message to a Slack Incoming Webhook.
# Usage: slack-notify.sh "$WEBHOOK_URL" "message text"
set -euo pipefail

WEBHOOK_URL="${1:-}"
MESSAGE="${2:-}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "Slack webhook URL not set; skipping notification."
  exit 0
fi

if [ -z "$MESSAGE" ]; then
  echo "Slack message empty; skipping notification."
  exit 0
fi

PAYLOAD=$(jq -n --arg text "$MESSAGE" '{text: $text}')
curl -fsS -X POST -H 'Content-type: application/json' --data "$PAYLOAD" "$WEBHOOK_URL"
