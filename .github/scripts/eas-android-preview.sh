#!/usr/bin/env bash
# Try EAS Android preview builds on candelaapp → Satvik → Sri Sai when Free-plan quota is exhausted.
set -u

APP_JSON="app.json"
LOG="$RUNNER_TEMP/eas-build.log"
JSON_OUT="$RUNNER_TEMP/eas-build.json"

OWNER_CANDELA="candelaapp"
PROJECT_CANDELA="2a25b9ca-aac0-405e-9b75-a66272e692de"
OWNER_SATVIK="satvik-27s-team"
PROJECT_SATVIK="2fd57159-bb08-4692-90da-37e1b8d6c482"
OWNER_SRISAI="srisais-team"
PROJECT_SRISAI="5e4a8b11-479c-4d0c-9e40-1149d9a3289f"

quota_exhausted() {
  local file="$1"
  grep -qiE 'used its Android builds from the Free plan|eas billing:subscribe|Upgrade your plan for more builds' "$file"
}

point_app_json() {
  local owner="$1"
  local project_id="$2"
  node -e "
    const fs = require('fs');
    const p = process.argv[1];
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.expo.owner = process.argv[2];
    j.expo.extra = j.expo.extra || {};
    j.expo.extra.eas = j.expo.extra.eas || {};
    j.expo.extra.eas.projectId = process.argv[3];
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  " "$APP_JSON" "$owner" "$project_id"
}

try_account() {
  local label="$1"
  local token="$2"
  local owner="$3"
  local project_id="$4"

  if [ -z "$token" ]; then
    echo "Skipping $label: GitHub secret not set"
    return 2
  fi

  echo "EAS Android preview via $label (owner=$owner projectId=$project_id)"
  export EXPO_TOKEN="$token"
  point_app_json "$owner" "$project_id"

  : >"$JSON_OUT"
  : >"$LOG"
  set +e
  eas build --platform android --profile preview --non-interactive --wait --json >"$JSON_OUT" 2>"$LOG"
  local code=$?
  set -e
  if [ -s "$LOG" ]; then
    cat "$LOG" >&2
  fi

  if [ "$code" -eq 0 ]; then
    local build_id build_url
    build_id=$(jq -r '.[0].id // empty' "$JSON_OUT")
    build_url=$(jq -r '.[0].artifacts.buildUrl // empty' "$JSON_OUT")
    if [ -z "$build_id" ]; then
      echo "Could not parse EAS build output:"
      cat "$JSON_OUT"
      return 1
    fi
    {
      echo "eas_account=$label"
      echo "build_id=$build_id"
      echo "build_page=https://expo.dev/builds/$build_id"
      echo "apk_url=$build_url"
    } >> "$GITHUB_OUTPUT"
    return 0
  fi

  if quota_exhausted "$LOG" || quota_exhausted "$JSON_OUT"; then
    echo "Quota exhausted on $label — trying next Expo account"
    return 3
  fi

  echo "EAS build failed on $label (not a quota error)"
  cat "$JSON_OUT"
  return 1
}

set +e
try_account "candelaapp" "${EXPO_TOKEN_CANDELA:-}" "$OWNER_CANDELA" "$PROJECT_CANDELA"
code=$?
set -e
if [ "$code" -eq 0 ]; then exit 0; fi
if [ "$code" -eq 1 ]; then exit 1; fi

set +e
try_account "satvik-27s-team" "${EXPO_TOKEN_BACKUP1:-}" "$OWNER_SATVIK" "$PROJECT_SATVIK"
code=$?
set -e
if [ "$code" -eq 0 ]; then exit 0; fi
if [ "$code" -eq 1 ]; then exit 1; fi

set +e
try_account "srisais-team" "${EXPO_TOKEN_BACKUP2:-}" "$OWNER_SRISAI" "$PROJECT_SRISAI"
code=$?
set -e
if [ "$code" -eq 0 ]; then exit 0; fi
if [ "$code" -eq 1 ]; then exit 1; fi

echo "All Expo accounts skipped or out of Free Android builds. Set EXPO_TOKEN, EXPO_TOKEN_BACKUP1, EXPO_TOKEN_BACKUP2 and upload the shared Android keystore on each EAS project."
exit 1
