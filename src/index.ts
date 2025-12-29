/**
 * @fileoverview Taper - URL-Based Playlist Player
 * 
 * Main entry point for the Taper application.
 * 
 * Taper is a simple web app that lets you create and share playlists
 * by combining markdown text with song links from various providers
 * (YouTube, Spotify, SoundCloud, MP3).
 * 
 * The entire playlist ("tape") is encoded in the URL hash, making
 * it easy to share and bookmark without needing a backend.
 * 
 * ## Architecture
 * 
 * The app is split into focused modules:
 * - config.ts    - Configuration constants
 * - types.ts     - TypeScript interfaces
 * - auth.ts      - Spotify PKCE authentication
 * - parser.ts    - Markdown-to-cells parsing
 * - state.ts     - Global state management
 * - dom.ts       - DOM element references
 * - renderer.ts  - Cell rendering (cards, markdown)
 * - players.ts   - Player initialization
 * - playback.ts  - Playback controls
 * - editor.ts    - Edit mode functionality
 * 
 * ## How It Works
 * 
 * 1. On load, the app checks for Spotify auth callback
 * 2. URL hash is decoded and parsed into Cell objects
 * 3. Cells are rendered into the DOM
 * 4. User can play songs, edit content, or share the URL
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { parseTape } from './parser';
import { setCells, cells, setYoutubeApiReady } from './state';
import { checkAuthCallback, spotifyToken, loginToSpotify, logoutSpotify } from './auth';
import { initSpotifySdkPlayer } from './players';
import { togglePlayPause, playNext, playPrev, updateActiveCell } from './playback';
import { renderTape, initEditor, saveTapeState } from './editor';
import { playBtn, prevBtn, nextBtn, shareBtn, playerBar, spotifyConnect } from './dom';

// ============================================================================
// EXTERNAL API SETUP
// ============================================================================

/**
 * YouTube IFrame API callback
 * Called automatically when the YouTube API script loads
 */
(window as any).onYouTubeIframeAPIReady = function () {
    console.log('YouTube IFrame API ready');
    setYoutubeApiReady(true);
};

/**
 * Spotify Web Playback SDK callback
 * Called automatically when the Spotify SDK loads
 */
(window as any).onSpotifyWebPlaybackSDKReady = function () {
    console.log('Spotify SDK ready');
    initSpotifySdkPlayer();
};

// Load external scripts
function loadExternalScripts(): void {
    // YouTube IFrame API
    const ytTag = document.createElement('script');
    ytTag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(ytTag);

    // SoundCloud Widget API
    const scTag = document.createElement('script');
    scTag.src = 'https://w.soundcloud.com/player/api.js';
    document.body.appendChild(scTag);

    // Spotify Web Playback SDK
    const spTag = document.createElement('script');
    spTag.src = 'https://sdk.scdn.co/spotify-player.js';
    document.body.appendChild(spTag);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Default tape content shown when no hash is present
 */
const DEFAULT_TAPE = `# Taper Demo 🎵

Create playlists by mixing text and song links.

---

song: https://www.youtube.com/watch?v=giF04C6cMHE

---

song: https://open.spotify.com/intl-de/track/2dje3ZBu1j1r0QfR7mtS0l?si=ddc9eb0165464ef1

---

Double-click any cell to edit it. 
Click the ✎ button to toggle edit mode.
`;

/**
 * Load and render the tape from URL hash or default
 */
async function loadState(): Promise<void> {
    // Check for Spotify OAuth callback
    const savedHash = await checkAuthCallback();

    // Determine which hash to use
    let hash = savedHash || window.location.hash.substring(1);

    if (hash) {
        try {
            // Decode base64 hash to markdown
            const decoded = decodeURIComponent(escape(atob(hash)));
            setCells(parseTape(decoded));
        } catch (e) {
            console.error('Failed to decode tape:', e);
            setCells(parseTape(DEFAULT_TAPE));
        }
    } else {
        setCells(parseTape(DEFAULT_TAPE));
    }

    // Render the tape
    renderTape();

    // Show player bar if there are songs
    if (cells.some(c => c.type === 'song')) {
        playerBar.classList.remove('hidden');
    }

    // Save initial state to hash (ensures hash exists for default tape)
    if (!window.location.hash) {
        saveTapeState();
    }
}

/**
 * Set up event listeners for playback controls
 */
function initPlaybackControls(): void {
    playBtn.onclick = togglePlayPause;
    prevBtn.onclick = playPrev;
    nextBtn.onclick = playNext;

    shareBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            shareBtn.innerHTML = '✓ Copied!';
            setTimeout(() => { shareBtn.innerHTML = '🔗 Share'; }, 2000);
        } catch (e) {
            prompt('Copy this URL:', window.location.href);
        }
    };
}

/**
 * Create and update the Spotify connect button
 */
/**
 * Create and update the Spotify connect button
 */
function updateSpotifyButton(): void {
    spotifyConnect.innerHTML = '';

    const btn = document.createElement('button');
    btn.className = 'connect-btn' + (spotifyToken ? ' connected' : '');
    btn.innerHTML = spotifyToken ? '🟢 Spotify' : '🔗 Connect Spotify';
    btn.onclick = () => {
        if (spotifyToken) {
            if (confirm('Disconnect from Spotify?')) {
                logoutSpotify();
            }
        } else {
            loginToSpotify();
        }
    };

    spotifyConnect.appendChild(btn);
}

/**
 * Main initialization
 * Called when the DOM is ready
 */
function init(): void {
    console.log('Taper initializing...');

    // Load external player APIs
    loadExternalScripts();

    // Set up event listeners
    initEditor();
    initPlaybackControls();

    // Load and render tape
    loadState();

    // Update Spotify button
    updateSpotifyButton();

    console.log('Taper ready!');
}

// ============================================================================
// START
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
