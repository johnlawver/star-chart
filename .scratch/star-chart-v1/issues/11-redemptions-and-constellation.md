# 11: Redemptions and Constellation

**What to build:** A grown-up records a **Redemption**, an amount and a note such as "ice cream", for a child. A Redemption larger than the Balance is refused. Each child's **Constellation**, every star earned and spent over time, appears on their Observatory view and in the Control Center.

**Blocked by:** 05 (Hand in and approve)

**Status:** done

- [x] A grown-up can record a Redemption with an amount and a note. It reduces the Balance.
- [x] A Redemption that would take the Balance below zero is refused.
- [x] The Constellation lists earnings (from approvals) and Redemptions over time, in both the Control Center and on the child's Observatory view (kept plain).
- [x] The Balance always equals earned minus spent (API test across several approvals and redemptions).

## Notes

- A redemption is a negative star movement with a note and the grown-up who recorded it. The child is locked while the balance is checked, so simultaneous redemptions can't overspend. The concurrency test fires ten one-star redemptions at a balance of five; the first version (two redemptions) didn't actually catch a missing lock, so it was strengthened until it did (5 of 5 runs fail without the lock).
- Added the missing test for ticket 06's claim that simultaneous approvals award stars once: ten approvals of one ticket at once. It fails without the lock and passes with it.
- The constellation is ordered by a sequence number on star movements, because two can share a timestamp (the same fix as ticket history in ticket 06).
- The observatory's constellation is a plain list under "My stars"; the star-jar look belongs to the observatory's design phase.
