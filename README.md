# Chronicles

Chronicles is a local-first solo RPG interface that uses a locally running Ollama model as the dungeon master.

## What This Solves

This project gives a single-player text RPG loop with:
- persistent campaign state
- model-driven narration and choices
- desktop packaging through Tauri

It is designed for users who want local model execution and simple campaign continuity, not a hosted multiplayer platform.

Assumptions:
- Ollama is available on the same machine
- at least one local model exists (default expected model name is `mistral`)
- the user is comfortable running Node and Rust tooling

## System Architecture

### High-level flow

```text
React UI (routes + GameContext)
  -> backend.ts bridge
    -> Tauri invoke/event bridge (desktop mode)
       -> Rust commands (ollama.rs, campaign.rs, config.rs)
          -> Ollama HTTP API (localhost:11434)
          -> local filesystem (campaign/config JSON)

    -> direct browser fallback (web mode)
       -> Ollama HTTP API (localhost:11434)
       -> localStorage
```

### Entry points

- Web entry: `src/main.tsx`
- UI composition and routing: `src/App.tsx`
- Desktop entry: `src-tauri/src/main.rs` and `src-tauri/src/lib.rs`

### Execution flow

1. Home screen checks Ollama status and loads saved campaigns/models.
2. User creates or loads a campaign.
3. Main game screen initializes a system prompt + first user message.
4. Chat is streamed token-by-token from Ollama.
5. Response parser extracts stats JSON and numbered choices.
6. Updated campaign state is saved after state changes.

### State and persistence

- In-memory state: React context in `src/GameContext.tsx`
- Desktop persistence:
  - campaigns in app data directory under `campaigns/*.json`
  - config in app data directory as `config.json`
- Web-mode fallback persistence:
  - campaign keys in `localStorage` prefixed with `chronicles:campaign:`
  - selected model key `chronicles:selected-model`

### Design tradeoffs

- Chosen: local inference path (`http://localhost:11434`) for gameplay requests.
- Chosen: dual-mode bridge (desktop invoke/events + browser fallback) to keep development simple.
- Not chosen: server-side orchestration, multiplayer state synchronization, cloud persistence.

## Operational Quickstart

Verified in this repository on February 24, 2026 with:
- Node `v22.19.0`
- Rust `1.92.0`

The release workflow uses Node 22. `package.json` does not enforce an engine range.

### 1. Install dependencies

```bash
npm install
```

### 2. Start Ollama locally

Chronicles expects Ollama at `http://localhost:11434`.

Example local setup:

```bash
ollama serve
ollama pull mistral
```

### 3. Run web mode

```bash
npm run dev
```

### 4. Run desktop mode (Tauri)

```bash
npm run tauri dev
```

### 5. Run checks

```bash
npm run lint
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Configuration Surface

- Runtime env vars: none required for local development (`.env.example`).
- Optional dev toggle: `DISABLE_HMR=true` disables Vite HMR.
- Model selection:
  - Desktop: persisted in Rust config (`selected_model`)
  - Web: persisted in browser localStorage
- Updater configuration lives in `src-tauri/tauri.conf.json` (`plugins.updater`).

## Release Process (GitHub Tags)

Release workflow file: `.github/workflows/release.yml`

Behavior:
- triggers on tags matching `v*`
- runs checks (`npm run lint`, `npm run test`)
- builds/publishes Tauri artifacts through `tauri-apps/tauri-action`

Required repository secrets:
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Example:

```bash
git tag v0.0.3
git push origin v0.0.3
```

## Limitations & Non-Goals

- No multiplayer or shared world state.
- No server-side persistence.
- No prompt/tool safety layer beyond local parsing and basic error handling.
- Choice parsing recognizes lines prefixed with `1.`, `2.`, or `3.`, but the app does not hard-enforce that the model always returns exactly three valid choices.
- Desktop updater/install path depends on signed GitHub release artifacts.
- UI assets currently load external resources (Google Fonts and Picsum background images).

## Where This Can Break

- Ollama is not running, unreachable, or returns malformed stream chunks.
- Selected/default model is missing locally.
- First-launch desktop setup can block waiting for Ollama CLI detection.
- Campaign writes can fail due filesystem permissions or invalid campaign names after sanitization.
- Parsing can degrade UX if model output diverges from expected numbered-choice + JSON pattern.
- Desktop updater checks/install fail if endpoint, signing key, or release metadata is invalid.

## Design Philosophy

Chronicles was built to keep the gameplay loop local and inspectable:
- local model calls
- explicit storage paths
- minimal backend surface

Intentional tradeoff: this keeps architecture simple for solo play and local development, while giving up hosted reliability features and cross-device synchronization.

## Measurable Design Constraint

Core gameplay inference is local-only by implementation:
- chat/status/model queries target `http://localhost:11434`
- no cloud LLM endpoint is used in the chat execution path

This constraint does not remove all network usage (for example updater endpoint checks and externally hosted UI assets).

## License

This project is currently distributed as source-available, all rights reserved.
See `LICENSE` for terms.
