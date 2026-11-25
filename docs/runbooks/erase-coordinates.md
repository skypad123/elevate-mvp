# Erasing one learner's coordinates

When a learner checks in to a class, or tries to, their device may send a location reading. Its
latitude and longitude are a row in `attendance_event_locations`, beside the attendance event
([ADR 012](../adr/012-class-records-and-attendance.md)). A privacy request to delete a learner's
location data is met with one step in Support, which deletes those rows and records that it did.
Budget five minutes.

## What an erasure does and does not do

- It deletes the coordinates of **every** check-in and attempt the learner made, in every class.
  There is no erasure of one class or one block.
- It leaves every attendance event as it was: the learner's state, the distance from the venue,
  the accuracy and the location flag. Support's block view then shows "erased" where the reading
  was.
- It writes one `coordinates.erased` entry to the audit log, under the super admin who ran it,
  with the learner's user ID, the number of readings deleted and the reason.
- It is final. There is no undo in the product.
- **Database backups keep the deleted rows for up to 35 days after an erasure.** Production keeps
  automated RDS backups for 35 days (`db_backup_retention_days` in
  `infra/terraform/envs/production/main.tf`), so a backup taken before the erasure still holds the
  coordinates until it expires. A manual snapshot, and the final snapshot taken if the database is
  deleted, keep them until that snapshot is deleted. Say so when you answer the learner.

## Before you start

1. You need the `super_admin` role. A support agent does not see the step.
2. Confirm the request comes from the learner, from the address on their Elevate account.
3. Find the learner's account: Support → People → search by email → open the person. Check the
   email on the page is the one that asked. The erasure goes by that account, so the wrong person
   here erases the wrong learner's rows.

## The step

1. On the person's page, under **Location data**, choose **Erase location data**.
2. Read the name in the dialog's title again.
3. Type the reason, 3 to 500 characters, for example "Privacy request by email on 25 Nov 2026,
   ticket 1234". It is kept in the audit log.
4. Choose **Erase location data**. The card then says how many readings were erased. A count of 0
   means the learner had none left; the request is still recorded.

The same step without the portal, as a super admin's session:
`POST /api/support/learners/:userId/erase-coordinates` with `{ "reason": "…" }`, answered with
`{ "erased": <count> }`.

## Afterwards

1. Support → Audit log: the newest `coordinates.erased` entry shows your email, the learner's user
   ID as its entity, and `{ "erased": …, "reason": … }`.
2. Optionally open one of the learner's classes (Support → Classes → search by their email) and a
   block they checked in to: their row shows "erased" in place of coordinates. Opening a block
   writes a `coordinates.viewed` entry under your name whenever it shows any learner's
   coordinates.
3. Reply to the learner: their location data is deleted from Elevate, their attendance record is
   kept, and backups hold the deleted data for up to 35 days before it is gone.

Do not delete rows by hand with the owner's database credential: that leaves no audit entry, and an
ad-hoc query can reach the wrong learner's rows.
