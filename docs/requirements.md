# Image organizer — requirements

## Purpose

A simple local web application for manually reviewing pictures and removing unwanted files. This is the first iteration of a SweClockers AI competition project. The project directory was empty when work began on 3 November 2026.

## Confirmed requirements

- Open a local folder and show its images in a thumbnail overview.
- Support JPEG, PNG, WebP and GIF initially.
- Show only images directly inside the current folder. Show child folders as folder tiles that can be entered; do not recursively mix their images into the overview.
- Select two or more images, including a range, and explicitly invoke Compare.
- Review the comparison group one image at a time using the browser content area. Browser fullscreen is deferred.
- Manually reject unwanted images. Unmarked images remain kept; choosing a group does not authorize rejecting other images automatically.
- Only explicitly rejected files may be moved to Trash. Kept files remain untouched in their original locations; keeping does not copy or move files.
- Keep rejected images visible, slightly faded toward black with a small red border.
- Allow rejection to be toggled directly from the thumbnail overview as well as during comparison.
- Toggling rejection stays on the current image rather than automatically advancing.
- After sequential review, allow side-by-side comparison of the unrejected candidates. Begin with two image panes.
- Support pinning a reference image and cycling other candidates in the unpinned pane.
- Fit images into their viewing area. Interactive zoom and pan are deferred.
- Mark files for deletion without changing files immediately. Rejection should be reversible before deletion.
- Move marked files to macOS Trash only when the user explicitly invokes deletion.
- Rejection marks remain active across all visited folders during the current runtime session, until unmarked or successfully moved to Trash.
- Include a deletion preview / dry run covering marked files across all visited folders. Show filenames, thumbnails and a total count, allow individual files to be unmarked, then require an explicit Move to Trash command. Opening the preview changes no files.
- Open a starting folder by typing or pasting its path. A folder-picker button beside the path is a later addition.
- Provide a keyboard shortcut for every command. Use keyboard-driven navigation, including Vim-style movement and a shortcut help overlay.
- Keep the first iteration local and simple.
- Do not persist session state across reloads or application restarts in the first iteration.
- Target Chrome on macOS initially.
- Optimize the initial workflow for folders containing 1–100 images; larger collections are a later improvement.
- Use Go for the local server, with a browser interface.

## Technical direction

A local Go HTTP server with an HTML, CSS and JavaScript browser interface. Go handles local file operations; the browser handles selection, comparison and keyboard interaction. Frontend assets can be embedded in the executable.

## Incremental delivery

The initial implementation covered startup, thumbnail folder browsing, path suggestions and Tab completion. Later iterations added comparison, selection inversion and reviewed Trash operations. The dated development notes record subsequent decisions.

### Iteration 1: start the application

- Provide a Makefile with `make run` as the development entry point.
- Start a local Go HTTP server and serve a minimal application page in Chrome.
- Use Air for development rebuilds and process restarts. The Go application serves the app; Air supervises it.
- Air watches Go, HTML, CSS and JavaScript files. Its proxy is disabled because it binds all network interfaces; browser refresh is manual.
- Pin the Air development dependency when implementing, rather than resolving an unpinned version on every launch.
- Exclude generated files, token logs and build output from reload triggers.
- Document startup and the local URL in Markdown.
- Completion criterion: `make run` starts the page; editing watched source rebuilds the running app; refreshing Chrome shows the changes; Ctrl+C stops the development process.

Air reference: [official README](https://github.com/air-verse/air#readme).

Subsequent slices add folder browsing, image selection and sequential review, side-by-side comparison, then the deletion preview and Trash operations. These workflows are now implemented; see the README for current behavior.

## Proposed interaction defaults

- Initial shortcut mapping. Proposed defaults: h/j/k/l navigation, Space selection, Shift plus navigation for ranges, c to compare, x to toggle rejection, s for side-by-side mode, p to pin, d to review deletions, Escape to go back, and a shortcut help overlay.
- Proposed defaults: natural filename order and clearing green selections when returning from comparison while retaining rejection marks.

## Deferred features

See `../TODO.md`.

## Token evidence

See [AI usage](ai-usage.md) for aggregate measured usage. Detailed evidence references remain in the ignored local `spendage.md`. Run `python3 tools/record_spendage.py` locally to refresh it when the original session logs are available.
