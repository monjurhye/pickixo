#!/usr/bin/env bash
#
# Interim origin certificate for pickixo.com, used by nginx until a real one is
# in place.
#
#   bash scripts/make-origin-cert.sh
#
# WHAT THIS IS FOR
#
# With Cloudflare proxying (the orange cloud), visitors never see this
# certificate — Cloudflare presents its own, which is publicly trusted. This one
# only protects the Cloudflare → origin hop, so a self-signed certificate is
# genuinely sufficient there, PROVIDED the Cloudflare SSL/TLS mode is set to
# "Full". It is not sufficient for "Full (strict)", which requires a certificate
# Cloudflare can verify.
#
# WHAT IT IS NOT
#
# Not a substitute for a real certificate. Replace it with either:
#   * a Cloudflare Origin Certificate (dashboard, free, 15 years, no renewal), or
#   * Let's Encrypt via the win-acme already installed on this machine,
# and then move Cloudflare to "Full (strict)".
#
# Anyone reaching the origin IP directly, bypassing Cloudflare, will get a
# warning from this certificate. That is correct: they should be going through
# Cloudflare.
set -euo pipefail

OUT="C:/tools/nginx-1.31.5/conf/pickixo-origin"
OUT_SH="/c/tools/nginx-1.31.5/conf/pickixo-origin"
DAYS=825

mkdir -p "$OUT_SH"

cat > "$OUT_SH/openssl.cnf" <<'CONF'
[req]
distinguished_name = dn
x509_extensions    = v3_req
prompt             = no

[dn]
C  = BD
O  = Pickixo
CN = pickixo.com

[v3_req]
basicConstraints = critical, CA:FALSE
keyUsage         = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[alt_names]
DNS.1 = pickixo.com
DNS.2 = www.pickixo.com
CONF

openssl req -x509 -nodes \
    -newkey rsa:2048 \
    -keyout "$OUT_SH/origin.key" \
    -out    "$OUT_SH/origin.crt" \
    -days   "$DAYS" \
    -sha256 \
    -config "$OUT_SH/openssl.cnf" 2>/dev/null

chmod 600 "$OUT_SH/origin.key" 2>/dev/null || true

echo "Wrote:"
echo "  $OUT/origin.crt"
echo "  $OUT/origin.key"
echo
openssl x509 -in "$OUT_SH/origin.crt" -noout -subject -dates -ext subjectAltName
