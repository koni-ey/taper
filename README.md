# Taper 🎵

A minimal, URL-based playlist player. Create mixtapes by combining markdown text with song links from YouTube, Spotify, and SoundCloud.

**No backend required** – the entire playlist is encoded in the URL, making it easy to share and bookmark.

![Taper Screenshot](https://via.placeholder.com/800x400?text=Taper+Playlist+Player)

## Features

- 🎵 **Multi-provider playback** - YouTube, Spotify, SoundCloud, MP3
- 📝 **Markdown support** - Add formatted text between songs
- 🔗 **Shareable URLs** - Entire playlist encoded in the URL hash
- ✏️ **Colab-style editing** - Double-click to edit, drag to reorder
- 🎨 **Unified card UI** - Consistent look across all providers
- ⚡ **No backend** - Pure client-side, static hosting

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (fast JavaScript runtime)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/taper.git
cd taper

# Install dependencies
bun install

# Start development server
bun run start
```

Open http://127.0.0.1:3000 in your browser.

### Building for Production

```bash
bun run build
```

This creates a minified `public/index.js` bundle.

## Usage

### Creating a Tape

1. Click the **✎ (edit)** button to enter edit mode
2. Double-click any cell to edit it
3. Hover between cells to see **+ Text** / **+ Song** buttons
4. Paste song URLs from YouTube, Spotify, or SoundCloud
5. Click **👁️ (view)** to return to playback mode
6. Click **🔗 Share** to copy the URL

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Enter` | Exit cell editing |
| Click song card | Play that song |
| Drag ☰ handle | Reorder cells |

### Supported Providers

| Provider | URL Format |
|----------|------------|
| YouTube | `https://www.youtube.com/watch?v=...` or `https://youtu.be/...` |
| Spotify | `https://open.spotify.com/track/...` |
| SoundCloud | `https://soundcloud.com/artist/track` |
| MP3 | Any URL ending in `.mp3` |

### Spotify Authentication

To play Spotify tracks, click the **Connect Spotify** button and authorize the app. This uses the secure PKCE OAuth flow (no secrets stored).

## Project Structure

```
taper/
├── src/
│   ├── index.ts      # Main entry point
│   ├── config.ts     # Constants (Spotify credentials, provider patterns)
│   ├── types.ts      # TypeScript interfaces
│   ├── auth.ts       # Spotify PKCE authentication
│   ├── parser.ts     # Markdown-to-cells parsing
│   ├── state.ts      # Global state management
│   ├── dom.ts        # DOM element references
│   ├── renderer.ts   # Cell rendering (cards, markdown)
│   ├── players.ts    # Player initialization (YT, SC, Spotify)
│   ├── playback.ts   # Playback controls
│   └── editor.ts     # Edit mode logic
├── public/
│   ├── index.html    # Main HTML page
│   ├── app.css       # Styles
│   └── index.js      # Built bundle (generated)
├── server.ts         # Simple Bun file server
└── package.json
```

## How It Works

1. **Tape Format**: Playlists are written in a simple markdown-like format:
   ```
   # My Playlist
   
   Some description text.
   
   ---
   
   song: https://open.spotify.com/track/abc123
   song: https://www.youtube.com/watch?v=xyz
   
   More text here.
   ```

2. **URL Encoding**: The tape is base64-encoded and stored in the URL hash:
   ```
   http://127.0.0.1:3000/#IyBNeSBQbGF5bGlzdA...
   ```

3. **Player APIs**: External player SDKs are loaded dynamically:
   - YouTube IFrame API
   - SoundCloud Widget API
   - Spotify Web Playback SDK

## Adding a New Provider

1. Add the provider pattern to `src/config.ts`:
   ```typescript
   { name: 'newprovider', pattern: /regex-here/, type: 'embed' }
   ```

2. Add initialization in `src/players.ts`

3. Add playback controls in `src/playback.ts`

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `bun run start` | Start development server |
| `bun run build` | Build production bundle |
| `bun run dev` | Build + watch + serve |

### Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Bundler**: Bun's built-in bundler
- **Markdown**: [marked](https://www.npmjs.com/package/marked)
- **Styling**: Vanilla CSS

## License

MIT
