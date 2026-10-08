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

Reveal adds two commands:

- **Reveal: Search vault** searches every non-ignored Markdown file in the vault.
- **Reveal: Search current file** saves and searches the active Markdown note.

Results update as you type. Use the arrow keys to select a result, Enter to open
it, Ctrl/Cmd+Enter to open it in a new tab, or Alt+Enter to open it in a split.
Selected editor text is used as the initial query.

Searches are literal and use smart-case matching by default. If a literal search
has no exact matches, Reveal uses ripgrep to enumerate eligible lines and applies
a bounded, in-process fuzzy subsequence ranking pass. Fuzzy results preserve file
and line metadata without requiring `fzf` or another executable. The fallback can
be disabled in settings and is not applied to regular-expression searches.

Regular-expression queries, case behavior, hidden files, ignore rules, result
limits, and debounce timing can also be changed in the plugin settings.

## Configuration

Open **Settings → Community plugins → Reveal** to configure the plugin.

| Setting                  | Default    | Description                                                                                                                                                                                                                                               |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Executable**           | `rg`       | Command name or absolute path to ripgrep. Use **Test** to verify that Obsidian can run it. An absolute path may be necessary when Obsidian does not inherit your shell's `PATH`.                                                                          |
| **Regular expressions**  | Off        | When enabled, queries are interpreted as ripgrep regular expressions. When disabled, all query characters are matched literally. Invalid regular expressions are reported in an Obsidian notice.                                                            |
| **Fuzzy fallback**       | On         | When a literal search has no exact results, scan eligible lines and rank those containing the query characters in order. This is an internal subsequence matcher, not MiniSearch or the `fzf` executable. It is not used for regular-expression searches. |
| **Case sensitivity**     | Smart case | **Smart case** ignores case unless the query contains an uppercase letter. **Case insensitive** always ignores case. **Case sensitive** always requires matching case. The same choice is used by exact and fuzzy searches.                               |
| **Include hidden files** | Off        | Pass `--hidden` to ripgrep. For vault searches, this can include Markdown files in hidden directories such as `.obsidian`, subject to ignore rules.                                                                                                       |
| **Respect ignore files** | On         | Honor ripgrep's normal ignore behavior, including `.gitignore`, `.ignore`, and `.rgignore`. Disable this to pass `--no-ignore`.                                                                                                                           |
| **Maximum results**      | `200`      | Maximum number of matching lines shown by an exact or fuzzy search. Accepted range: 1–5000.                                                                                                                                                               |
| **Debounce delay**       | `150 ms`   | Time Reveal waits after the last keystroke before starting a search. Accepted range: 0–2000 ms. Increasing it reduces process launches while typing; decreasing it makes searches start sooner.                                                           |

### Search behavior

- Vault searches target Markdown files (`*.md`) only.
- Current-file searches save the active Markdown note before invoking ripgrep.
- An empty query does not start a search.
- Starting a new query cancels the previous ripgrep process and any fuzzy pass.
- Reveal passes `--no-config` to ripgrep, so `RIPGREP_CONFIG_PATH` does not
  silently change plugin behavior.
- Queries and paths are passed directly to ripgrep without invoking a shell.

For manual installation, copy `main.js`, `manifest.json`, and `styles.css` to
`<vault>/.obsidian/plugins/reveal/`, then reload Obsidian and enable Reveal.

Reveal does not download or update ripgrep. Queries are passed as direct process
arguments without invoking a shell.
