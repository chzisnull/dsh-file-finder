# dsh-file-finder

A DSH plugin: `index.js` is the Node host, `client.js` is the browser bundle,
`preview/` is a Playwright harness, `test/` is `node:test`.

## Where things are

- **DSH's own contracts** — read `docs/native-integration.md` before touching a
  DSH seam. It names both installs on this machine (packaged desktop app vs the
  nvm CLI) and quotes the services, slots and shortcut rules this plugin uses.
- **Domain words** — `GLOSSARY.md` is the naming authority; copy, code, docs and
  test names all use its terms.
- **The additive boundary** — `docs/adr/0001-file-surfaces-stay-additive.md`.
  The session board's decisions are in
  `docs/adr/0002-session-board-inside-file-finder.md`.
- **Visual harness** — `preview/README.md` lists every capture state, the CLI
  flags (`--only`, `--thumb`, `--list`) and the three places a new state must be
  registered.
- **Checks** — `npm test` for the pure logic and contracts;
  `npm run check:{board,browse,find,intel,tokens,viewer,bot}` for the browser
  behaviour. `npm run hooks` points git at `.githooks/` so a push runs the unit gate.
- **Release** — `npm run release` bumps `package.json` + the preview badge, runs
  the gate, publishes with `$DSH_SECRET_NPM_TOKEN_BYPASS`, waits for `latest` and
  verifies the install. `--stage` stops before publishing, `--full` runs every
  browser check first.

## Rules no test can enforce

- **Commit before dispatching code review.** Hand reviewers a SHA
  (`git diff <base>..<sha>`); a tree that keeps changing produces stale findings
  and wasted review rounds.
- **No default key bindings** in `shortcuts.register`. A default that collides
  with another plugin's default breaks the whole Web boot;
  `test/boot-safety.test.mjs` pins this.
- **Pure logic gets a unit test, not a browser check.** Export the derivation the
  way `client.js` exposes `__test` and test it in `test/*.test.mjs`; save the
  browser checks for what only a browser can show.
- **Prefer the `edit`/`write` tools over scripted patches.** A scripted multi-hunk
  change bypasses the file version guard and is invisible in review.
