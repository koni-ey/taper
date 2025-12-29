/**
 * @fileoverview Player Initialization
 * 
 * This module handles initializing player instances for different providers:
 * - YouTube IFrame API
 * - SoundCloud Widget API
 * - Spotify Web Playback SDK
 * - HTML5 Audio for MP3
 * 
 * Each provider has its own initialization function that creates a player
 * instance and stores it in the global playerInstances map.
 */

import { Cell } from './types';
import { spotifyToken, setSpotifyPlayer, setSpotifyDeviceId, setSpotifySdkReady } from './auth';
import { playerInstances, setPlayerInstance, cells, currentIndex, isPlaying, setIsPlaying, setCurrentIndex } from './state';
import { SPOTIFY_CLIENT_ID } from './config';
import { updateCardDOM, updatePlayerBarDOM } from './renderer';
import { hiddenEmbed } from './dom';

// ============================================================================
// YOUTUBE PLAYER
// ============================================================================

/**
 * Initialize a YouTube player for a song cell
 * Uses the YouTube IFrame API
 * 
 * @param cell - Cell containing YouTube video
 * @param videoId - YouTube video ID
 */
export function initYoutubePlayer(cell: Cell, videoId: string): void {
    // Create container in hidden embed area
    const div = document.createElement('div');
    div.id = `yt-player-${cell.id}`;
    hiddenEmbed.appendChild(div);

    // Check for YT global
    // @ts-ignore
    if (typeof YT === 'undefined' || !YT.Player) {
        console.warn('YouTube API not loaded yet');
        // Retry or handle gracefullly? For now just log
        return;
    }

    // @ts-ignore - YT is loaded globally
    const player = new YT.Player(div.id, {
        height: '200',
        width: '200',
        videoId: videoId,
        playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            origin: window.location.origin
        },
        events: {
            onReady: (event: any) => {
                console.log(`YouTube player ready for ${cell.id} (video: ${videoId})`);

                // Fallback metadata fetch (in case oEmbed failed)
                const data = event.target.getVideoData();
                if (data && data.title && (!cell.title || cell.title === 'Loading...')) {
                    cell.title = data.title;
                    cell.cover = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                    updateCardDOM(cell);

                    if (cells[currentIndex]?.id === cell.id) {
                        updatePlayerBarDOM(cell);
                    }
                }

                // Auto-play if this is the current song
                if (cells[currentIndex]?.id === cell.id && isPlaying) {
                    event.target.playVideo();
                }
            },
            onStateChange: (event: any) => {
                // YT.PlayerState.ENDED = 0
                if (event.data === 0) {
                    playNext();
                }
            },
            onError: (event: any) => {
                console.error('YouTube player error:', event.data);
            }
        }
    });

    setPlayerInstance(cell.id, player);
}

/**
 * Placeholder for playNext - will be imported from playback module
 * This is a forward reference resolved at runtime
 */
function playNext() {
    // Import dynamically to avoid circular dependency
    import('./playback').then(m => m.playNext());
}

// ============================================================================
// SOUNDCLOUD PLAYER
// ============================================================================

/**
 * Initialize a SoundCloud widget player
 * Uses the SoundCloud Widget API loaded via iframe
 * 
 * @param cell - Cell containing SoundCloud track
 * @param iframe - The SoundCloud embed iframe
 */
export function initSoundCloudPlayer(cell: Cell, iframe: HTMLIFrameElement): void {
    // @ts-ignore - SC is loaded globally
    if (typeof SC === 'undefined' || !SC.Widget) {
        console.warn('SoundCloud Widget API not loaded');
        return;
    }

    // @ts-ignore
    const widget = SC.Widget(iframe);

    widget.bind('ready', () => {
        console.log(`SoundCloud player ready for ${cell.id}`);

        // Get track info for metadata
        widget.getCurrentSound((sound: any) => {
            if (sound) {
                cell.title = `${sound.title} - ${sound.user?.username || 'Unknown'}`;
                cell.cover = sound.artwork_url || '';
                updateCardDOM(cell);
            }
        });
    });

    widget.bind('finish', () => {
        playNext();
    });

    setPlayerInstance(cell.id, widget);
}

// ============================================================================
// SPOTIFY SDK PLAYER
// ============================================================================

/**
 * Initialize the Spotify Web Playback SDK player
 * Called when Spotify SDK is ready and user is authenticated
 * 
 * This creates a single player instance for all Spotify tracks,
 * unlike YouTube/SoundCloud which have per-track instances.
 */
export function initSpotifySdkPlayer(): void {
    if (!spotifyToken) {
        console.warn('No Spotify token available');
        return;
    }

    // @ts-ignore - Spotify is loaded globally
    const player = new Spotify.Player({
        name: 'Taper Web Player',
        getOAuthToken: (cb: any) => { cb(spotifyToken); },
        volume: 0.5
    });

    // Error handling
    player.addListener('initialization_error', ({ message }: any) => {
        console.error('Spotify init error:', message);
    });

    player.addListener('authentication_error', ({ message }: any) => {
        console.error('Spotify auth error:', message);
    });

    player.addListener('account_error', ({ message }: any) => {
        console.error('Spotify account error:', message);
    });

    // Ready
    player.addListener('ready', ({ device_id }: any) => {
        console.log('Spotify player ready, device ID:', device_id);
        setSpotifyDeviceId(device_id);
        setSpotifySdkReady(true);
    });

    // Playback state changes
    player.addListener('player_state_changed', (state: any) => {
        if (!state) return;

        // Update current cell metadata from Spotify
        if (currentIndex >= 0 && cells[currentIndex]?.provider === 'spotify') {
            const cell = cells[currentIndex];
            const track = state.track_window?.current_track;

            if (track) {
                const newTitle = `${track.name} - ${track.artists.map((a: any) => a.name).join(', ')}`;
                if (cell.title !== newTitle) {
                    cell.title = newTitle;
                    cell.cover = track.album?.images?.[0]?.url || '';
                    updateCardDOM(cell);
                }
            }
        }

        // Detect end of track
        if (state.paused && state.position === 0 && state.track_window?.previous_tracks?.length > 0) {
            playNext();
        }
    });

    // Connect
    player.connect();
    setSpotifyPlayer(player);
}

// ============================================================================
// MP3/AUDIO PLAYER
// ============================================================================

/**
 * Initialize an HTML5 Audio player for MP3 files
 * 
 * @param cell - Cell containing MP3 URL
 * @returns HTMLAudioElement
 */
export function initAudioPlayer(cell: Cell): HTMLAudioElement {
    const audio = new Audio(cell.content);
    audio.preload = 'metadata';

    audio.onended = () => {
        playNext();
    };

    audio.onloadedmetadata = () => {
        // Could update duration display here
    };

    setPlayerInstance(cell.id, audio);
    return audio;
}
