#!/usr/bin/env bash
#
# Generate the local development TLS certificate.
#
#   bash scripts/make-dev-cert.sh
#
# This produces a SELF-SIGNED certificate. Browsers will warn about it once,
# because nothing vouches for it — that is expected and is not a defect. It is
# for local development only and must never be used for pickixo.com, which needs
# a certificate from a real CA (Let's Encrypt) issued to the actual domain.
#
# The key never leaves this machine and is gitignored (certs/, *.key, *.crt).
set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/apps/web/certs"
DAYS=825   # the maximum a browser will accept for a leaf certificate

mkdir -p "$CERT_DIR"

# Subject Alternative Names matter more than the Common Name: every current
# browser ignores CN entirely and matches on SAN. All three spellings of "this
# machine" are listed, so https://localhost and https://127.0.0.1 both work
# without a name-mismatch error.
cat > "$CERT_DIR/openssl.cnf" <<'CONF'
[req]
distinguished_name = dn
x509_extensions    = v3_req
prompt             = no

[dn]
C  = BD
O  = Pickixo
CN = localhost

[v3_req]
basicConstraints = critical, CA:FALSE
keyUsage         = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[alt_names]
DNS.1 = localhost
IP.1  = 127.0.0.1
IP.2  = ::1
CONF

openssl req -x509 -nodes \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/localhost.key" \
    -out    "$CERT_DIR/localhost.crt" \
    -days   "$DAYS" \
    -sha256 \
    -config "$CERT_DIR/openssl.cnf" 2>/dev/null

# The private key should not be world readable. chmod is close to a no-op on
# Windows, so this is belt-and-braces for when the repo is cloned on Linux.
chmod 600 "$CERT_DIR/localhost.key" 2>/dev/null || true

echo "Wrote:"
echo "  $CERT_DIR/localhost.crt"
echo "  $CERT_DIR/localhost.key   (gitignored — never commit this)"
echo
openssl x509 -in "$CERT_DIR/localhost.crt" -noout -subject -dates -ext subjectAltName
