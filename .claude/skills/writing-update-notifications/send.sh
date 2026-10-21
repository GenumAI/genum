#!/usr/bin/env bash
# Upload one reviewed update post to the n8n cross-posting webhook (articles-crosspost),
# which publishes it at once to the Discourse community, prod and dev notifications.
#
#   bash .claude/skills/writing-update-notifications/send.sh "tmp/notifications/<Title>.md"
#
# The file name (minus .md) is the post title; the file body is the post content.
# Sent as multipart/form-data, field `file`, to $ARTICLE_URL with the $ARTICLE_AUTH header.
# Both are read from the environment, falling back to the repo-root .env (the main
# checkout's, so this also works from a worktree). ARTICLE_AUTH is either a full header
# line (`X-Api-Key: abc`) or just the value of the Authorization header (`Bearer abc`).
set -euo pipefail

if [ $# -ne 1 ]; then
	echo "usage: bash $0 <path/to/Title.md>" >&2
	exit 2
fi

path=$1
name=$(basename "$path")

if [ ! -f "$path" ]; then
	echo "no such file: $path" >&2
	exit 1
fi
case $name in
*.md) ;;
*)
	echo "not a .md file: $name — the file name is the title, e.g. 'Roles and LLM Whitelist.md'" >&2
	exit 1
	;;
esac
case $name in
*\"* | *\\*)
	echo "the title (file name) must not contain \" or \\: $name" >&2
	exit 1
	;;
esac

from_dotenv() {
	local common root
	common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 0
	root=$(dirname "$common")
	[ -f "$root/.env" ] || return 0
	{ grep -E "^$1=" "$root/.env" || true; } | tail -n 1 | cut -d= -f2- |
		sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

url=${ARTICLE_URL:-$(from_dotenv ARTICLE_URL)}
auth=${ARTICLE_AUTH:-$(from_dotenv ARTICLE_AUTH)}
if [ -z "$url" ] || [ -z "$auth" ]; then
	echo "ARTICLE_URL and ARTICLE_AUTH must be set (environment or repo-root .env)" >&2
	exit 1
fi

if [[ $auth =~ ^[A-Za-z0-9-]+:[[:space:]] ]]; then
	header=$auth
else
	header="Authorization: $auth"
fi

echo "title:  ${name%.md}"
echo "file:   $path ($(wc -c <"$path" | tr -d ' ') bytes, sha256 $(shasum -a 256 "$path" | cut -c1-12))"
echo "to:     $url"

# n8n's "webhook payload" node takes body.title first, then a leading "# H1" (stripped from
# the content), then the file name. Sending the title explicitly pins it to the file name.
body=$(mktemp)
trap 'rm -f "$body"' EXIT
status=$(curl -sS -X POST \
	-H "$header" \
	--form-string "title=${name%.md}" \
	-F "file=@\"$path\";filename=\"$name\";type=text/markdown" \
	-o "$body" -w '%{http_code}' \
	"$url") || status=000
cat "$body"
echo
echo "HTTP $status"

# Only the flow's "respond" node answers {"ok": true, ...}, after all three targets succeeded.
# A 200 without it (e.g. an empty body) means the run stopped part-way: some targets may
# have published, so this is not a success and must not be retried blindly.
if [[ $status != 2* ]] || ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$body"; then
	echo "NOT CONFIRMED: check the run in n8n Executions before sending again" >&2
	exit 3
fi
