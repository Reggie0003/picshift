#!/usr/bin/env bash
# =============================================================================
# Pic Shift — restore a Postgres backup from S3.
# =============================================================================
# Usage:
#   ./restore.sh s3://picshift-backups/postgres/2026/05/10/picshift-...sql.gz.gpg
#
# IMPORTANT: this restores into the database referenced by $DATABASE_URL.
# Before running in production, take a fresh dump of the current DB first.
# =============================================================================

set -euo pipefail

: "${1:?usage: restore.sh <s3-uri-to-backup>}"
: "${DATABASE_URL:?required}"

S3_URI="$1"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
LOCAL="$TMP/$(basename "$S3_URI")"

echo "[restore] downloading $S3_URI"
aws s3 cp "$S3_URI" "$LOCAL" --only-show-errors

SHA_URI="${S3_URI}.sha256"
echo "[restore] verifying SHA-256"
aws s3 cp "$SHA_URI" "$LOCAL.sha256" --only-show-errors
EXPECTED=$(cat "$LOCAL.sha256")
ACTUAL=$(sha256sum "$LOCAL" | awk '{print $1}')
[[ "$EXPECTED" == "$ACTUAL" ]] || { echo "checksum mismatch"; exit 1; }

echo "[restore] decrypting"
gpg --batch --yes --output "$LOCAL.sql.gz" --decrypt "$LOCAL"

echo "[restore] restoring (this will overwrite existing data)"
gunzip -c "$LOCAL.sql.gz" | psql "$DATABASE_URL"

echo "[restore] done"
