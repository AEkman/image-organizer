# Overview initial selection — 4 November 2026

The user requested that All selected open with no automatically selected images and focus on the first image. Every opening now clears the active selection and range anchor, refreshes selection totals and grid styling, and focuses the first comparison image. The comparison group and rejection, pinned and current states remain intact.

The new regression test first failed because all comparison images remained selected. It now checks opening from a later comparison image and reopening after manually selecting an image, retaining the full comparison group and rejection marks. Existing selection tests now explicitly establish their selections in the overview instead of depending on inherited selection.

Validation: make test passed Go tests and all 32 frontend tests. README and overview instructions describe the initial state. No Git repository was available for a comparison diff.

Independent review found no actionable findings and independently ran the new regression test successfully.
