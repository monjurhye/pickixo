#!/usr/bin/env bash
# Check that every store-listing page answers on a given host.
#
# Google Play (and the App Store) keep these addresses on file. A listing whose
# privacy-policy link stops working can be removed from the store, so run this
# against a new host BEFORE pointing pickixo.com at it, and again afterwards.
#
#   scripts/check-store-pages.sh                        # the live site
#   scripts/check-store-pages.sh https://xyz.pages.dev  # a candidate host
#
# A page passes when it answers 200 (redirects are followed), has the expected
# content type, and, for HTML, carries the same <title> as the file in
# apps/web/public. Comparing titles rather than bytes is deliberate: Cloudflare
# rewrites mailto: links on the way out, so the bytes never match exactly.
#
# Exit status is the number of failures.

set -u
BASE="${1:-https://pickixo.com}"
BASE="${BASE%/}"
PUBLIC="$(cd "$(dirname "$0")/../apps/web/public" && pwd)"

# address | file under apps/web/public ("-" = not in the repository) | type
PAGES='
/wifi-tv-remote/privacy-policy|wifi-tv-remote/privacy-policy.html|text/html
/khatian-sohayika/privacy-policy|khatian-sohayika/privacy-policy.html|text/html
/khamar-bondhu/privacy-policy|khamar-bondhu/privacy-policy.html|text/html
/archivex/privacy|archivex/privacy.html|text/html
/archivex/support|archivex/support.html|text/html
/archivex/samples|archivex/samples.html|text/html
/archivex/samples/Sample.zip|archivex/samples/Sample.zip|-
/wifi-detective/privacy|wifi-detective/privacy.html|text/html
/pickixo-vpn/privacy|pickixo-vpn/privacy.html|text/html
/pickixo-vpn/list/servers.txt|-|text/plain
/maaz-privacy-policy.html|maaz-bangla-keyboard/privacy.html|text/html
/polyscan/privacy|polyscan/privacy.html|text/html
/polyscan/support|polyscan/support.html|text/html
/app-ads.txt|app-ads.txt|text/plain
/google700d9b513a5db788.html|google700d9b513a5db788.html|text/html
'

title_of() { tr '\r\n' '  ' < "$1" | sed -n 's/.*<title[^>]*>\([^<]*\)<\/title>.*/\1/p'; }

failures=0
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

echo "Checking $BASE"
while IFS='|' read -r path file type; do
  [ -z "$path" ] && continue
  meta="$(curl -sL -m 20 -o "$body" -w '%{http_code}|%{content_type}' "$BASE$path")"
  code="${meta%%|*}"
  ctype="${meta#*|}"
  problem=""

  if [ "$code" != "200" ]; then
    problem="HTTP $code"
  elif [ "$type" != "-" ] && [ "${ctype#"$type"}" = "$ctype" ]; then
    problem="content type is '$ctype', expected $type"
  elif [ "$file" != "-" ] && [ "$type" = "text/html" ]; then
    want="$(title_of "$PUBLIC/$file")"
    got="$(title_of "$body")"
    if [ -n "$want" ] && [ "$want" != "$got" ]; then
      problem="wrong page: title is '$got'"
    fi
  elif [ ! -s "$body" ]; then
    problem="empty response"
  fi

  if [ -z "$problem" ]; then
    echo "  ok    $path"
  else
    echo "  FAIL  $path  ($problem)"
    failures=$((failures + 1))
  fi
done <<EOF
$PAGES
EOF

echo "$failures failure(s)"
exit "$failures"
