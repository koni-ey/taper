# Operational Guidelines for Taper Project

## Development Environment
- **Server Command:** Do not use `bun run dev` directly as it terminates with SIGHUP in this CLI environment.
- **Preferred Method:** `nohup node node_modules/.bin/vite > <log_file> 2>&1 &` to run the server persistently.
- **Port:** ALWAYS use port `3000`.
- **Process Management:** strictly enforce port availability. Use `fuser -k 3000/tcp` to kill existing processes before starting a new server.

## Spotify Integration
- **Playback Initialization:**
  - **Race Condition:** The Spotify SDK script may load before the auth token is available.
  - **Solution:** Use a reactive `$effect` in `App.svelte` to call `initSpotifySdkPlayer` once `appState.spotify.token` is set.
  - **Idempotency:** Ensure `initSpotifySdkPlayer` in `players.ts` checks if a player instance already exists to prevent duplicate initialization.
- **Metadata (Artist Name):**
  - **Problem:** The public Spotify oEmbed endpoint (`open.spotify.com/oembed`) *does not* return the artist name, only the track title.
  - **Solution:** Use `api.song.link` as the primary metadata source for unauthenticated users. It provides rich data including `artistName`. Authenticated users continue to use the Spotify Web API.
- **Unconnected State:**
  - Visual cues (grayscale, opacity) and a hover overlay ("Connect Spotify to play") are implemented in `Cell.svelte` to indicate when Spotify playback is unavailable.

## UI/UX Implementation Details
- **Drag and Drop:**
  - **Placeholders:** Visual placeholder divs (rendered during drag operations) *must* have their own `ondragover` and `ondrop` handlers. Without them, dropping an item onto the placeholder cancels the action.
- **Typography & Spacing:**
  - **Prose Defaults:** Tailwind's `prose` class adds significant default vertical margins.
  - **Tuning:** To ensure compact layouts for text cells, explicitly override these margins (e.g., `prose-p:my-1`, `prose-headings:mt-3`, `[&>:first-child]:mt-0`).
- **Features:**
  - **Download:** The app supports downloading the current playlist as a `tape.md` file via client-side blob generation.
  - **External Links:** Song cards include an icon to open the source URL in a new tab.

## Verification
- **Tools:** Use Playwright MCP tools (`init-browser`, `get-text-snapshot`) to verify rendering and content changes.
- **Base URL:** `http://127.0.0.1:3000/`