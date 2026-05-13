#!/usr/bin/env bash
# =============================================================================
# Pic Shift — daily encrypted Postgres backup → AWS S3.
# =============================================================================
# Cron: 0 2 * * *   /opt/picshift/infra/scripts/backup.sh
#
# Strategy:
#   - pg_dump with --no-owner --no-acl (so restores work cleanly)
#   - GPG-encrypted with the public key listed in BACKUP_GPG_RECIPIENT
#   - Uploaded to s3://${S3_BUCKET_BACKUPS}/postgres/YYYY/MM/DD/picshift.sql.gz.gpg
#   - SHA-256 manifest emitted alongside for integrity verification
#   - 30 days retained on hot tier, lifecycle policy moves to Glacier
# =============================================================================

set -euo pipefail

: "${DATABASE_URL:?required}"
: "${S3_BUCKET_BACKUPS:?required}"
: "${BACKUP_GPG_RECIPIENT:?required (gpg key id or email)}"

DATE=$(date -u +%Y/%m/%d)
TS=$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

DUMP="$TMP/picshift-$TS.sql.gz"
ENC="$DUMP.gpg"
SHA="$ENC.sha256"

echo "[backup] dumping postgres → $DUMP"
pg_dump --no-owner --no-acl --format=plain "$DATABASE_URL" | gzip -9 > "$DUMP"

echo "[backup] encrypting with GPG recipient $BACKUP_GPG_RECIPIENT"
gpg --batch --yes --output "$ENC" --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$DUMP"

echo "[backup] hashing"
sha256sum "$ENC" | awk '{print $1}' > "$SHA"

echo "[backup] uploading to s3://$S3_BUCKET_BACKUPS/postgres/$DATE/"
aws s3 cp "$ENC" "s3://$S3_BUCKET_BACKUPS/postgres/$DATE/" --storage-class STANDARD_IA --only-show-errors
aws s3 cp "$SHA" "s3://$S3_BUCKET_BACKUPS/postgres/$DATE/" --only-show-errors

echo "[backup] done at $TS"
