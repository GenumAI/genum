#!/bin/sh
set -e

TEMPLATE="/usr/share/nginx/html/env.template.js"
TARGET="/usr/share/nginx/html/env.js"

replace_or_remove() {
  placeholder="$1"
  value="$2"

  if [ -n "$value" ]; then
    sed -i "s|${placeholder}|${value}|g" "$TARGET"
  else
    sed -i "/${placeholder}/d" "$TARGET"
  fi
}

if [ ! -f "$TEMPLATE" ]; then
  echo "env.template.js not found, skipping runtime config"
else
  : "${API_URL:=http://localhost:3010}"
  : "${AUTH_MODE:=local}"

  cp "$TEMPLATE" "$TARGET"

  replace_or_remove "__API_URL__" "${API_URL}"
  replace_or_remove "__AUTH_MODE__" "${AUTH_MODE}"
  replace_or_remove "__AUTH0_DOMAIN__" "${AUTH0_DOMAIN}"
  replace_or_remove "__AUTH0_CLIENT_ID__" "${AUTH0_CLIENT_ID}"
  replace_or_remove "__AUTH0_AUDIENCE__" "${AUTH0_AUDIENCE}"
  replace_or_remove "__SENTRY_ENABLED__" "${SENTRY_ENABLED}"
  replace_or_remove "__SENTRY_DSN__" "${SENTRY_DSN}"
  replace_or_remove "__SENTRY_ENVIRONMENT__" "${SENTRY_ENVIRONMENT}"
  replace_or_remove "__RELEASE_VERSION__" "${RELEASE_VERSION}"
  replace_or_remove "__GA_TRACKING_ID__" "${GA_TRACKING_ID}"

  echo "Runtime env.js generated"
fi

exec "$@"
