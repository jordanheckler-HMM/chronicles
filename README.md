# Chronicles

Chronicles is a solo AI RPG desktop app built with React + Tauri.

## What runs today

- Frontend flow: Home -> World -> Character -> Main game
- Local Ollama chat as the dungeon master
- Streaming responses with 3 choices per turn
- Campaign save/load via Tauri backend file storage
- In-app updater check/install (desktop builds)

## Prerequisites

- Node.js 20+
- Rust toolchain
- Ollama running locally (`http://localhost:11434`)
- At least one local Ollama model (default fallback is `mistral`)

## Development

Install dependencies:

```bash
npm install
```

Run web mode:

```bash
npm run dev
```

Run Tauri desktop mode:

```bash
npm run tauri dev
```

## Tests and checks

```bash
npm run lint
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Release (GitHub)

- A GitHub Actions workflow is configured at `.github/workflows/release.yml`.
- Pushing a tag like `v0.0.3` builds and publishes Tauri artifacts to GitHub Releases.
- Updater artifacts are enabled through `src-tauri/tauri.conf.json` (`bundle.createUpdaterArtifacts`).
- The workflow uses these repo secrets:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Create and push a release tag:

```bash
git tag v0.0.3
git push origin v0.0.3
```
