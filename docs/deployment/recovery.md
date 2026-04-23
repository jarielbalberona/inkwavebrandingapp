# Backup, Restore, And Recovery Notes

This app stores orders, inventory movements, customer data, pricing, and cost data. Treat backup and restore as sensitive operational work, not admin trivia.

## Baseline Assumptions

- the app uses its own database on a shared Render PostgreSQL instance
- backups and restores must target the Ink Wave database only
- schema sharing with another app is prohibited

If someone restores the wrong database, the incident gets worse immediately.

## What Render Likely Provides

Render PostgreSQL typically provides managed backups and point-in-time recovery options depending on plan/features. This repo does not prove the exact retention window or restore workflow configured in the live environment.

Operators must verify the actual Render backup capability in the dashboard before assuming recovery objectives.

## Sensitive Data Warning

Backups contain:

- customer records
- order history
- prices
- costs
- invoice snapshots
- inventory history

That means backups are confidential data. Handle exports, snapshots, and restored copies like production data, not like throwaway fixtures.

## Restore Rules

1. Verify the target database is the Ink Wave database before restoring anything.
2. Prefer restore into a separate verification database first if Render supports it.
3. Never restore over another app database on the shared instance.
4. If production must be restored in place, stop app writes first or accept that you are restoring into a moving target.
5. After restore, verify schema state against the checked-in Drizzle migrations.

## Post-Restore Verification Checklist

Minimum checks after restore:

- API can connect to the restored database
- admin login still works
- cups and lids load
- inventory balances load
- inventory movement history exists and looks plausible
- orders load
- at least one invoice record can be fetched if invoices exist

Manual data sanity checks:

- compare recent order counts against expected business activity
- inspect a recent inventory item for believable `stock_in`, `reserve`, `consume`, and adjustment history
- confirm customer data is present but not exposed incorrectly to staff APIs

## Migration Caveat

Restore does not remove the need to understand migration drift.

If a restore lands on an older schema state:

- inspect `apps/api/drizzle`
- inspect the target database state carefully
- do not blindly rerun every migration without confirming what already exists

Blind migration retries after restore are how you turn a recoverable incident into permanent damage.

## Honest Gaps

- this repo does not automate backup verification
- this repo does not prove the live Render backup schedule
- this repo does not provide automated restore drills

Internal MVP is not an excuse to skip writing this down. It is also not an excuse to pretend recovery is tested when it is not.
