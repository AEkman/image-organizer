# All selected rejection toggle — 4 November 2026

The user requested x as the keep/reject toggle for the focused image in the All selected overview. Previously x rejected every green-selected image in that view. The folder-grid batch rejection shortcut remains as before.

A regression test with three selected images first failed because x rejected all three. The overview shortcut now uses the existing focused rejection toggle, shared with r and the action button. The test verifies that the first press rejects only the focused middle image, the second restores it, and focus remains there.

The overview button label, shortcut help and README now describe x as the focused toggle. Validation: make test passed Go tests and all 29 frontend tests. Independent review requested for the scoped change; no Git repository was available for a comparison diff.

Independent review found no actionable issues and independently reran the focused regression test successfully.
