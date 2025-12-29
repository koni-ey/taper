/**
 * @fileoverview Cell Renderer - Creates DOM for Cells
 * 
 * This module handles rendering Cell objects into DOM elements.
 * - Markdown cells are rendered using the 'marked' library
 * - Song cells get a unified card UI with cover art, title, and play button
 */

import { marked } from 'marked';
import { Cell } from './types';
import { spotifyToken } from './auth';
import { nowPlaying } from './dom';
import { cells, currentIndex } from './state';

// ============================================================================
// METADATA FETCHING
// ============================================================================

/**
 * Fetch track metadata from Spotify API
 * Updates the cell object and DOM with title/cover info
 * 
 * @param trackId - Spotify track ID
 * @param cell - Cell object to update
 */
export async function fetchSpotifyMetadata(trackId: string, cell: Cell): Promise<void> {
    if (!spotifyToken) return;

    try {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            cell.title = `${data.name} - ${data.artists.map((a: any) => a.name).join(', ')}`;
            cell.cover = data.album.images[0]?.url || '';

            // Update DOM if the card exists
            updateCardDOM(cell);
        }
    } catch (error) {
        console.error('Failed to fetch Spotify metadata:', error);
    }
}

/**
 * Update the player bar footer with the current song title
 * @param cell - Cell to display
 */
export function updatePlayerBarDOM(cell: Cell): void {
    if (nowPlaying) {
        nowPlaying.textContent = cell.title || 'Loading...';
    }
}

/**
 * Update an existing song card's DOM with new metadata
 * @param cell - Cell with updated title/cover
 */
export function updateCardDOM(cell: Cell): void {
    const titleEl = document.querySelector(`#wrapper-${cell.id} .sc-title`);
    const coverEl = document.querySelector(`#wrapper-${cell.id} .sc-cover`) as HTMLImageElement;

    if (titleEl) titleEl.textContent = cell.title || 'Unknown Track';
    if (coverEl && cell.cover) coverEl.src = cell.cover;
}

// ============================================================================
// CELL RENDERING
// ============================================================================

/**
 * Render a cell into a DOM element
 * Routes to appropriate renderer based on cell type
 * 
 * @param cell - Cell to render
 * @returns HTMLElement for the cell
 */
export function renderCell(cell: Cell): HTMLElement {
    if (cell.type === 'song') {
        return renderSong(cell);
    }
    return renderMarkdown(cell);
}

/**
 * Render a markdown cell
 * @param cell - Markdown cell to render
 * @returns HTMLElement with rendered markdown
 */
function renderMarkdown(cell: Cell): HTMLElement {
    const div = document.createElement('div');
    div.className = 'cell-markdown';
    div.innerHTML = marked.parse(cell.content) as string;
    return div;
}

/**
 * Render a song cell with unified card UI
 * Creates a card with cover art, title, provider badge, and play button
 * 
 * @param cell - Song cell to render
 * @returns HTMLElement for the song card
 */
function renderSong(cell: Cell): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cell-song';
    container.id = `song-${cell.id}`;

    // Create the song card
    const card = createSongCard(cell);
    container.appendChild(card);

    // For Spotify, fetch metadata if we have a token and title is placeholder
    if (cell.provider === 'spotify' && (!cell.title || cell.title === 'Spotify Track') && spotifyToken) {
        const match = cell.content.match(/(?:track\/|track:)([\w]+)/);
        if (match) {
            fetchSpotifyMetadata(match[1], cell);
        }
    }

    // For YouTube, fetch metadata via oEmbed
    if (cell.provider === 'youtube' && (!cell.title || cell.title === 'Loading...')) {
        const match = cell.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (match) {
            fetchYouTubeMetadata(match[1], cell);
        }
    }

    return container;
}

/**
 * Fetch YouTube metadata via noembed.com (oEmbed proxy)
 * @param videoId - YouTube video ID
 * @param cell - Cell object to update
 */
export async function fetchYouTubeMetadata(videoId: string, cell: Cell): Promise<void> {
    try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.title) {
                cell.title = data.title;
                cell.cover = data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

                updateCardDOM(cell);

                // Update footer if this is the active song
                if (cells[currentIndex]?.id === cell.id) {
                    updatePlayerBarDOM(cell);
                }
            }
        }
    } catch (error) {
        console.error('Failed to fetch YouTube metadata:', error);
    }
}

// ============================================================================
// SONG CARD
// ============================================================================

/**
 * Create the song card UI element
 * Unified design for all providers with:
 * - Cover art (or placeholder)
 * - Title and artist
 * - Provider badge
 * - Play button
 * - External link button
 * 
 * @param cell - Song cell to create card for
 * @returns HTMLElement for the card
 */
export function createSongCard(cell: Cell): HTMLElement {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.dataset.cellId = cell.id;

    // Cover art
    const cover = document.createElement('img');
    cover.className = 'sc-cover';
    cover.src = cell.cover || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="40">♪</text></svg>';
    cover.alt = 'Cover';

    // Info section
    const info = document.createElement('div');
    info.className = 'sc-info';

    const title = document.createElement('div');
    title.className = 'sc-title';
    title.textContent = cell.title || 'Loading...';

    const meta = document.createElement('div');
    meta.className = 'sc-meta';

    // Provider name badge
    const providerBadge = document.createElement('span');
    providerBadge.className = 'sc-provider';
    providerBadge.textContent = getProviderDisplayName(cell.provider);
    meta.appendChild(providerBadge);

    // External link button
    const linkBtn = document.createElement('a');
    linkBtn.className = 'sc-link-btn';
    linkBtn.href = cell.content;
    linkBtn.target = '_blank';
    linkBtn.rel = 'noopener noreferrer';
    linkBtn.innerHTML = '↗';
    linkBtn.title = 'Open in new tab';
    linkBtn.onclick = (e) => e.stopPropagation(); // Don't trigger card click
    meta.appendChild(linkBtn);

    info.appendChild(title);
    info.appendChild(meta);

    // Play button
    const playIcon = document.createElement('div');
    playIcon.className = 'sc-play-icon';
    playIcon.innerHTML = '▶';

    card.appendChild(cover);
    card.appendChild(info);
    card.appendChild(playIcon);

    return card;
}

/**
 * Get display name for a provider
 * @param provider - Provider identifier
 * @returns Human-readable provider name
 */
function getProviderDisplayName(provider?: string): string {
    switch (provider) {
        case 'youtube': return 'YouTube';
        case 'soundcloud': return 'SoundCloud';
        case 'spotify': return 'Spotify';
        case 'mp3': return 'MP3';
        default: return 'Audio';
    }
}
