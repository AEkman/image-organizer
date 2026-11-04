# Shift selection inversion — 4 November 2026

The requested behavior is to invert the selection within the active Shift range: deselect previously selected images and select previously unselected images. Pressing Shift starts with the image under the pointer, falling back to the focused image. Navigation, clicking and folder-grid pointer movement extend the range. Moving backwards restores the original selection outside the range; releasing Shift commits it.

The regression test first failed because pressing Shift left the focused selected image unchanged. The implementation now restores the original selection snapshot and toggles membership within the active range. Repeated Shift keydown events do not toggle the image repeatedly.

Validation: `make test` passed the Go tests and all 28 frontend tests. Coverage includes mixed selected/unselected images, pressing Shift, repeated keydown, pointer extension, shrinking the range and releasing/repressing Shift. The existing overview release test was updated because a new range must now deselect its selected starting image. README and shortcut help describe the new behavior.

No Git repository was present, so a Git diff was unavailable. Independent review inspected the affected files and the described change scope.

Independent review found that an ordinary hover did not update the starting image. A second regression test reproduced that failure; tracking pointer entry and exit fixed it. Keyboard navigation and folder changes clear the tracked pointer target. The full suite passed again.
