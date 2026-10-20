# 02: Children

**What to build:** In the Control Center, a grown-up adds **Children** by nickname only, sets each child's **Display Style** (pictures or words), renames them, and removes them.

**Blocked by:** 01 (Walking skeleton)

**Status:** done

- [x] A grown-up can add a child with a nickname and a Display Style. No other personal details can be stored.
- [x] A grown-up can rename a child and change their Display Style.
- [x] A grown-up can remove a child. For now, full permanent deletion of the child's data is completed in ticket 14.
- [x] The Chart's children are listed in the Control Center.
- [x] Children from another Chart are never visible or editable (API test).

## Notes

- Requests with any field beyond a nickname and a display style are refused (400), rather than the extra fields being silently dropped. This applies to every endpoint with a request schema.
- Removing a child deletes the row; anything added later that belongs to a child must cascade from it (ticket 14 checks the full deletion).
