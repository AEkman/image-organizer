# Initial GitHub publication review — 4 November 2026

The user requested a clearer README and a check for personal details and secrets before publishing to the specified GitHub repository. The remote was empty, so publication creates the initial source history.

The README was rewritten around installation, browsing, selection, comparison, collective rejection, deletion preview, keyboard shortcuts and current limitations. Outdated claims that no files could change were replaced with the explicit dry-run and macOS Trash workflow.

The detailed token ledger remains local and ignored because it includes private session identifiers and evidence locations. A separate aggregate AI usage snapshot preserves measured totals and counting limits. Hardware and keyboard preferences were removed from the requirements. Build output, temporary files, environment files, private-key formats and editor state are ignored. Commit identity uses the public GitHub username and GitHub no-reply email.

Validation: Go tests, all 32 frontend tests and the macOS build passed. Before publication, review the exact staged file list for personal paths, addresses and credentials, and scan the exported staged files with Gitleaks. No raw session logs or compiled binaries are included.

Publication checks completed: Gitleaks 8.30.1 scanned the exported staged files and found no leaks. All 25 staged text files passed checks for personal filesystem paths, email addresses, private session identifiers and common credential markers. README local links and git whitespace checks passed; the private ledger, binaries and representative credential files were confirmed ignored. These checks reduce the risk of accidental disclosure but are not a guarantee against every possible secret format.
