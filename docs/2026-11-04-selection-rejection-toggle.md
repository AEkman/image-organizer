# Collective selection rejection toggle — 4 November 2026

The user clarified that rejection should apply to all selected images. When their states differ, the first action rejects all. Subsequent actions alternate between restoring all and rejecting all. With no selection, toggle the focused image.

A shared toggle now determines whether every target is already rejected and passes the opposite state to the existing batch setter. The folder-grid x shortcut and the All selected x shortcut and button use it. The r shortcut still toggles only the focused image; u restores the selection. Single-candidate comparison behavior is unchanged.

Test-first evidence: the updated overview regression failed because the prior focused toggle restored only the focused image instead of rejecting the mixed selection. After fixing overview, a grid regression failed because the second x still left all images rejected. Both passed after their respective changes. Additional passing coverage checks the overview button and focused fallback with no selection. The grid regression also verifies that an unselected rejected image remains unchanged.

Validation: make test passed the Go tests and all 31 frontend tests. Help, button label and README describe collective toggling and mixed-state behavior. No Git repository was available for a comparison diff.

Independent review found no actionable findings and independently ran all three focused regression tests successfully.
