# 📼 Taper

**Taper** is a modern, markdown-based music playlist generator and player. It allows you to create rich, text-heavy playlists (or "tapes") that mix storytelling with music from **Spotify**, **YouTube**, and **SoundCloud**.

Built with **Svelte 5**, Taper is fast, lightweight, and entirely client-side. Your tapes are stored in the URL hash, making them easy to share without a backend.

## ✨ Features

- **Markdown First**: Create playlists by writing markdown and pasting song URLs.
- **Multi-Provider**: Unified playback for Spotify, YouTube, and SoundCloud.
- **Zero-Backend**: Tapes are serialized into the URL hash. Share your playlists by simply copying the URL.
- **Drag & Drop**: Intuitive interface for reordering your tape.
- **Raw Mode**: Edit the underlying markdown directly for power users.
- **Exportable**: Download your tapes as standard `.md` files.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- A Spotify Premium account (for Spotify playback integration)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/koni-ey/taper.git
   cd taper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env` and fill in your Spotify credentials.
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 🎵 Spotify Integration

To use Spotify playback, you'll need to create an application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).

1. Create a new App.
2. Add `http://localhost:3000/` (or your production URL) to the **Redirect URIs**.
3. Copy the **Client ID** into your `.env` file.

*Note: Spotify playback requires a Spotify Premium account due to SDK limitations.*

## 🛠️ Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide Svelte](https://lucide.dev/)
- **Markdown**: [Marked](https://marked.js.org/)

## 📜 Markdown Format

Taper uses a simple format where blocks are separated by `---`.

```markdown
# My Summer Tape
This is some introductory text about my playlist.

---
song: https://open.spotify.com/track/4omurqpm7aWH9VVz2Ii4yO
---

## Interlude
You can use any markdown here, including images and links.

---
song: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.