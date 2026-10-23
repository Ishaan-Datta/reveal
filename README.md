# Reveal

Reveal is a desktop-only Obsidian plugin that searches Markdown notes by running
[ripgrep](https://github.com/BurntSushi/ripgrep) directly against the vault. It
supports live vault-wide search and search within the active file.

## Requirements

- Obsidian 1.8.7 or newer on desktop.
- `rg` installed and available to Obsidian, or an absolute path configured in
  **Settings → Reveal → Executable**.

On macOS, applications launched from Finder may not inherit the same `PATH` as
your terminal. Configure the absolute path to `rg` if the test button cannot find
it.

## Usage

Reveal adds the following commands:

- **Reveal: Search vault** searches every non-ignored Markdown file in the vault.
- **Reveal: Search current file** saves and searches the active Markdown note.
- **Reveal: Toggle compact vault search** switches an open vault search between
  detailed matching-line results and one row per matching file. Assign a shortcut
  to this command in Obsidian's **Hotkeys** settings.

Results update as you type. Use the arrow keys to select a result, Enter to open
it, Ctrl/Cmd+Enter to open it in a new tab, or Alt+Enter to open it in a split.
Press Tab to cycle search modes or Shift+Tab to cycle backward. The active mode
is shown in the search bar. Selected editor text is used as the initial query.

Compact mode keeps the existing result-list appearance but removes line previews
and shows each file's matching-line count on the right. The overall count shows
the number of matching files. Compact searches scan all matches to provide exact
per-file counts, and the compact preference is remembered for future vault
searches.
The maximum-results setting limits the number of file rows rendered without
limiting the scan used to calculate those counts.

Each search starts in exact mode. Current-file searches cycle through **Exact**,
**Regex**, **All words: line**, and **Fuzzy**. Vault searches additionally include
**All words: file** before fuzzy mode.

- **Exact** matches the complete query as literal text, including word order.
- **Regex** interprets the query as a ripgrep regular expression.
- **All words: line** matches lines containing every whitespace-separated term in
  any order.
- **All words: file** matches vault files containing every term, even when the
  terms occur on different lines. Detailed mode shows matching lines from those
  files; compact mode shows one row per file.
- **Fuzzy** ranks lines containing the query characters in order. It is an
  explicit mode and is never used as a fallback for another mode.

Case behavior, hidden files, ignore rules, result limits, and debounce timing can
be changed in the plugin settings.

## Configuration

Open **Settings → Community plugins → Reveal** to configure the plugin.

| Setting                  | Default    | Description                                                                                                                                                                                                                                               |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Executable**           | `rg`       | Command name or absolute path to ripgrep. Use **Test** to verify that Obsidian can run it. An absolute path may be necessary when Obsidian does not inherit your shell's `PATH`.                                                                          |
| **Case sensitivity**     | Smart case | **Smart case** ignores case unless the query contains an uppercase letter. **Case insensitive** always ignores case. **Case sensitive** always requires matching case. The same choice is used by every search mode.                                    |
| **Include hidden files** | Off        | Pass `--hidden` to ripgrep. For vault searches, this can include Markdown files in hidden directories such as `.obsidian`, subject to ignore rules.                                                                                                       |
| **Respect ignore files** | On         | Honor ripgrep's normal ignore behavior, including `.gitignore`, `.ignore`, and `.rgignore`. Disable this to pass `--no-ignore`.                                                                                                                           |
| **Maximum results**      | `200`      | Maximum number of matching lines shown by a detailed search or matching files shown by a compact search. Accepted range: 1–5000.                                                                                                                          |
| **Debounce delay**       | `150 ms`   | Time Reveal waits after the last keystroke before starting a search. Accepted range: 0–2000 ms. Increasing it reduces process launches while typing; decreasing it makes searches start sooner.                                                           |

### Search behavior

- Vault searches target Markdown files (`*.md`) only.
- Current-file searches save the active Markdown note before invoking ripgrep.
- An empty query does not start a search.
- Starting a new query or changing modes cancels the previous search.
- Reveal passes `--no-config` to ripgrep, so `RIPGREP_CONFIG_PATH` does not
  silently change plugin behavior.
- Queries and paths are passed directly to ripgrep without invoking a shell.

For manual installation, copy `main.js`, `manifest.json`, and `styles.css` to
`<vault>/.obsidian/plugins/reveal/`, then reload Obsidian and enable Reveal.

Reveal does not download or update ripgrep. Queries are passed as direct process
arguments without invoking a shell.
