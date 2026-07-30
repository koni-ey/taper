/**
 * Player Initializers.
 * Handles the creation and mounting of specific music player instances (YouTube, SoundCloud, Spotify, Audio).
 * These players are often mounted to a hidden container to allow unified control via the Taper UI.
 */

import type { Cell } from './types';
import { appState } from './state.svelte';
import { playNext } from './playback';

/**
 * Global reference to the hidden container where player elements (iframes, etc.) are mounted.
 */
let playerContainer: HTMLElement | null = null;

/**
 * Sets the element used for mounting player SDK components.
 */
export function setPlayerContainer(element: HTMLElement) {
    playerContainer = element;
}

/**
 * Returns true if the given cell is the one currently selected for playback.
 */
function isCurrentCell(cellId: string): boolean {
    return appState.cells[appState.currentIndex]?.id === cellId;
}

/**
 * Caches in-flight SoundCloud widget initializations by cell id. Overlapping
 * pre-initialization passes (or a tap that lands before the initial pass has
 * finished) reuse the same pending promise instead of creating duplicate widgets
 * or — worse — receiving a null instance and silently dropping playback.
 */
const soundcloudInitPromises = new Map<string, Promise<any>>();

/**
 * Initializes a YouTube IFrame Player for a specific cell.
 */
export function initYoutubePlayer(cell: Cell, videoId: string): Promise<any> {
    return new Promise((resolve) => {
        if (!playerContainer) return resolve(null);

        let div = document.getElementById(`yt-player-${cell.id}`);
        if (!div) {
            div = document.createElement('div');
            div.id = `yt-player-${cell.id}`;
            playerContainer.appendChild(div);
        }

        // @ts-ignore
        if (typeof YT === 'undefined' || !YT.Player) {
            console.warn('YouTube API not loaded yet');
            return resolve(null);
        }

        // @ts-ignore
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
                    // Auto-fetch metadata if missing
                    const data = event.target.getVideoData();
                    if (data && data.title && (!cell.title || cell.title === 'Loading...')) {
                        const idx = appState.cells.findIndex(c => c.id === cell.id);
                        if (idx !== -1) {
                            appState.cells[idx].title = data.title;
                            appState.cells[idx].cover = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                        }
                    }

                    appState.setPlayerInstance(cell.id, event.target);
                    resolve(event.target);
                },
                onStateChange: (event: any) => {
                    if (event.data === 0) { // 0 = YT.PlayerState.ENDED
                        playNext();
                    }
                }
            }
        });
    });
}

/**
 * Initializes a SoundCloud Widget Player for a specific cell.
 * Uses a hidden iframe and the SoundCloud Widget API.
 */
export function initSoundCloudPlayer(cell: Cell): Promise<any> {
    // If the widget already exists, reuse it directly.
    if (appState.playerInstances[cell.id]) {
        return Promise.resolve(appState.playerInstances[cell.id]);
    }
    // If an initialization is already in flight, reuse its promise so callers
    // (e.g. a tap handler) await the real widget instead of getting null.
    const pending = soundcloudInitPromises.get(cell.id);
    if (pending) return pending;

    const promise = new Promise<any>((resolve) => {
        if (!playerContainer) return resolve(null);

        // Bail out early if the SoundCloud Widget API script has not loaded yet.
        // We intentionally avoid creating an orphaned iframe here so that a later
        // pre-initialization pass (triggered once the script loads) can create the
        // widget cleanly and store its instance for synchronous, in-gesture playback.
        // @ts-ignore
        if (typeof SC === 'undefined' || !SC.Widget) return resolve(null);

        let iframe = document.getElementById(`sc-player-${cell.id}`) as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = `sc-player-${cell.id}`;
            iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cell.content)}&auto_play=false`;
            iframe.allow = 'autoplay';
            iframe.style.display = 'none';
            playerContainer.appendChild(iframe);
        }

        // @ts-ignore
        const widget = SC.Widget(iframe);

        // Cache the track duration (seconds) once known so we can keep the
        // progress bar's total in sync as the track becomes current.
        let durationSec = 0;
        const syncTotal = () => {
            if (durationSec > 0 && isCurrentCell(cell.id)) {
                appState.progress.total = durationSec;
            }
        };

        // Bind event listeners
        // @ts-ignore
        widget.bind(SC.Widget.Events.READY, () => {
            widget.getCurrentSound((sound: any) => {
                if (sound) {
                    const idx = appState.cells.findIndex(c => c.id === cell.id);
                    if (idx !== -1) {
                        appState.cells[idx].title = `${sound.title} - ${sound.user?.username || 'Unknown'}`;
                        appState.cells[idx].cover = sound.artwork_url || '';
                    }
                }
            });

            widget.getDuration((duration: number) => {
                if (duration) {
                    durationSec = duration / 1000;
                    syncTotal();
                }
            });

            appState.setPlayerInstance(cell.id, widget);
            resolve(widget);
        });

        // When playback actually begins the duration is reliably available.
        // @ts-ignore
        widget.bind(SC.Widget.Events.PLAY, () => {
            widget.getDuration((duration: number) => {
                if (duration) {
                    durationSec = duration / 1000;
                    syncTotal();
                }
            });
        });

        // Drive progress from the widget's own event instead of polling the
        // cross-origin iframe every animation frame (which floods the postMessage
        // channel and yields stale/zero readings).
        // @ts-ignore
        widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
            if (isCurrentCell(cell.id)) {
                appState.progress.current = data.currentPosition / 1000;
                syncTotal();
            }
        });

        // @ts-ignore
        widget.bind(SC.Widget.Events.FINISH, () => {
            playNext();
        });
    });

    soundcloudInitPromises.set(cell.id, promise);
    // Clear the in-flight cache entry once settled. A successful widget is tracked
    // in playerInstances; a null result stays retryable on the next call.
    promise.then(
        () => soundcloudInitPromises.delete(cell.id),
        () => soundcloudInitPromises.delete(cell.id),
    );
    return promise;
}

/**
 * Initializes the Spotify Web Playback SDK.
 * Unlike other players, there is only one Spotify Player instance for the whole app.
 */
export function initSpotifySdkPlayer() {
    if (!appState.spotify.token) return;
    if (appState.spotify.player) return; // Idempotency check

    // @ts-ignore
    if (typeof Spotify === 'undefined') return;

    // @ts-ignore
    const player = new Spotify.Player({
        name: 'Taper Web Player',
        getOAuthToken: (cb: any) => { cb(appState.spotify.token); },
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }: any) => {
        appState.spotify.deviceId = device_id;
        appState.spotify.isReady = true;
    });

    player.addListener('player_state_changed', (state: any) => {
        if (!state) return;

        // Sync metadata from Spotify's current state
        if (appState.currentIndex >= 0 && appState.cells[appState.currentIndex]?.provider === 'spotify') {
            const track = state.track_window?.current_track;
            if (track) {
                const newTitle = `${track.name} - ${track.artists.map((a: any) => a.name).join(', ')}`;
                const currentTitle = appState.cells[appState.currentIndex].title;
                if (currentTitle !== newTitle) {
                    appState.cells[appState.currentIndex].title = newTitle;
                    appState.cells[appState.currentIndex].cover = track.album?.images?.[0]?.url || '';
                }
            }
        }

        // Detect end of track
        if (state.paused && state.position === 0 && state.track_window?.previous_tracks?.length > 0) {
            playNext();
        }
    });

    player.connect();
    appState.spotify.player = player;
}

/**
 * Simple HTML5 Audio player for direct MP3 links.
 */
export function initAudioPlayer(cell: Cell): HTMLAudioElement {
    const audio = new Audio(cell.content);
    audio.preload = 'metadata';
    audio.onended = () => playNext();
    appState.setPlayerInstance(cell.id, audio);
    return audio;
}

/**
 * Pre-initializes player instances for all currently available songs.
 * This helps circumvent mobile browser auto-play restrictions by ensuring
 * the iframe/audio context exists before the first user tap.
 */
export function preInitializePlayers() {
    if (!playerContainer) return;
    
    appState.cells.forEach(cell => {
        if (cell.type === 'song' && !appState.playerInstances[cell.id]) {
            if (cell.provider === 'youtube') {
                const match = cell.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
                if (match) initYoutubePlayer(cell, match[1]);
            } else if (cell.provider === 'soundcloud') {
                initSoundCloudPlayer(cell);
            } else if (cell.provider === 'mp3') {
                initAudioPlayer(cell);
            }
        }
    });
}