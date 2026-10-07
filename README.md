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

Searches are literal and use smart-case matching by default. Regular-expression
queries, case behavior, hidden files, ignore rules, result limits, and debounce
timing can be changed in the plugin settings.

## Development

Enter the Nix development shell and install dependencies:

```sh
nix develop
bun install
```

Available commands:

```sh
bun run dev       # watch and rebuild main.js
bun run test      # unit and ripgrep integration tests
bun run typecheck
bun run lint
bun run build     # production main.js
bun run check     # all verification steps
```

For manual installation, copy `main.js`, `manifest.json`, and `styles.css` to
`<vault>/.obsidian/plugins/reveal/`, then reload Obsidian and enable Reveal.

Reveal does not download or update ripgrep. Queries are passed as direct process
arguments without invoking a shell.
