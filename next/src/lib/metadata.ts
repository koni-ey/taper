import type { Cell } from './types';
import { appState } from './state.svelte';

export async function fetchMetadata(cell: Cell) {
    if (cell.type !== 'song') return;

    // Don't re-fetch if we already have a specific title
    if (cell.title && cell.title !== 'Loading...' && cell.title !== 'Spotify Track') return;

    try {
        if (cell.provider === 'youtube') {
            const match = cell.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
            if (match) {
                // Use noembed for CORS-friendly oEmbed
                const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${match[1]}`);
                const data = await res.json();
                if (data.title) {
                    updateCell(cell.id, {
                        title: data.title,
                        cover: data.thumbnail_url
                    });
                }
            }
        } else if (cell.provider === 'soundcloud') {
            const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(cell.content)}`);
            const data = await res.json();
            if (data.title) {
                updateCell(cell.id, {
                    title: data.title,
                    cover: data.thumbnail_url
                });
            }
        } else if (cell.provider === 'spotify') {
            // If logged in, use API
            if (appState.spotify.token) {
                const match = cell.content.match(/(?:track\/|track:)([\w]+)/);
                if (match) {
                    const res = await fetch(`https://api.spotify.com/v1/tracks/${match[1]}`, {
                        headers: { 'Authorization': `Bearer ${appState.spotify.token}` }
                    });
                    const data = await res.json();
                    if (data.name) {
                        const title = `${data.name} - ${data.artists.map((a: any) => a.name).join(', ')}`;
                        const cover = data.album.images[0]?.url;
                        updateCell(cell.id, { title, cover });
                    }
                }
            } else {
                // Use oEmbed for public info
                const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(cell.content)}`);
                const data = await res.json();
                if (data.title) {
                    updateCell(cell.id, {
                        title: data.title,
                        cover: data.thumbnail_url
                    });
                }
            }
        }
    } catch (e) {
        console.warn('Metadata fetch failed for', cell.content, e);
        updateCell(cell.id, { title: 'Unknown Track' });
    }
}

function updateCell(id: string, updates: Partial<Cell>) {
    const idx = appState.cells.findIndex(c => c.id === id);
    if (idx !== -1) {
        Object.assign(appState.cells[idx], updates);
    }
}

export function fetchAllMetadata() {
    appState.cells.forEach(cell => {
        if (cell.type === 'song') fetchMetadata(cell);
    });
}
