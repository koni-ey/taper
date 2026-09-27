/**
 * Playback Controller.
 * Manages the logic for playing, pausing, seeking, and navigating between tracks
 * across different providers (YouTube, Spotify, SoundCloud).
 */

import type { Cell } from './types';
import { appState } from './state.svelte';
import { initYoutubePlayer, initSoundCloudPlayer, initAudioPlayer } from './players';

/**
 * Checks if a cell is a playable song.
 */
function isPlayable(cell: Cell): boolean {
    if (cell.type !== 'song') return false;
    if (cell.provider === 'spotify' && !appState.spotify.token) return false;
    return cell.provider === 'youtube' || cell.provider === 'soundcloud' || cell.provider === 'spotify' || cell.provider === 'mp3';
}

let startTimeout: number | undefined;
let requestId = 0;

function clearStart() {
    window.clearTimeout(startTimeout);
    startTimeout = undefined;
    appState.isStarting = false;
}

function beginStart(cell: Cell) {
    clearStart();
    appState.playbackError = null;
    appState.isStarting = true;
    appState.setIsPlaying(false);
    const attempt = ++requestId;
    startTimeout = window.setTimeout(() => {
        if (attempt === requestId) providerFailed(cell.id, 'Playback did not start. Tap Play to retry, or open the track directly.');
    }, 12000);
}

function isCurrent(id: string) {
    return appState.cells[appState.currentIndex]?.id === id;
}

function activateSpotify() {
    try {
        const activation = appState.spotify.player?.activateElement?.();
        void activation?.catch?.(() => {}); // Automatic transitions may not have a user gesture.
    } catch { /* The SDK reports autoplay_failed if activation is blocked. */ }
}

export function providerPlaying(id: string) {
    if (!isCurrent(id)) return;
    clearStart();
    appState.playbackError = null;
    if (!appState.isPlaying) {
        appState.setIsPlaying(true);
        startProgressLoop();
    }
}

export function providerPaused(id: string) {
    if (!isCurrent(id) || appState.isStarting) return;
    appState.setIsPlaying(false);
    stopProgressLoop();
}

export function providerFailed(id: string, message: string) {
    if (!isCurrent(id)) return;
    clearStart();
    appState.setIsPlaying(false);
    stopProgressLoop();
    appState.playbackError = message;
}

/**
 * Starts playback of a specific cell at the given index.
 */
export function startPlayer(index: number) {
    if (index < 0 || index >= appState.cells.length) return;
    const cell = appState.cells[index];
    if (!isPlayable(cell)) return;

    stopCurrentPlayer();
    appState.setCurrentIndex(index);
    appState.progress = { current: 0, total: 0 }; // Reset progress immediately

    beginStart(cell);

    // Spotify's iOS SDK needs activation directly inside the user's gesture.
    // On automatic transitions there may be no gesture; the SDK reports autoplay_failed.
    if (cell.provider === 'spotify') activateSpotify();

    switch (cell.provider) {
        case 'youtube': startYouTube(cell); break;
        case 'soundcloud': startSoundCloud(cell); break;
        case 'spotify': startSpotify(cell); break;
        case 'mp3': startMp3(cell); break;
    }

}

/**
 * Stops (pauses) the currently playing track.
 */
export function stopCurrentPlayer() {
    ++requestId;
    clearStart();
    appState.setIsPlaying(false);
    stopProgressLoop();
    if (appState.currentIndex < 0) return;
    
    const cell = appState.cells[appState.currentIndex];
    const player = appState.playerInstances[cell.id];

    try {
        if (cell.provider === 'youtube') (player as any)?.pauseVideo?.();
        else if (cell.provider === 'soundcloud') (player as any)?.pause?.();
        else if (cell.provider === 'spotify') void appState.spotify.player?.pause()?.catch?.(() => {});
        else if (cell.provider === 'mp3') (player as HTMLAudioElement)?.pause();
    } catch (e) { console.warn(e); }
}

/**
 * Toggles between play and pause states for the current track.
 */
export function togglePlayPause() {
    if (appState.currentIndex < 0) {
        const firstSong = appState.cells.findIndex(c => isPlayable(c));
        if (firstSong >= 0) startPlayer(firstSong);
        return;
    }

    const cell = appState.cells[appState.currentIndex];
    const player = appState.playerInstances[cell.id];

    if (appState.isPlaying || appState.isStarting) {
        stopCurrentPlayer();
    } else {
        beginStart(cell);

        if (cell.provider === 'youtube') {
            if (player) (player as any).playVideo();
            else startYouTube(cell);
        } else if (cell.provider === 'soundcloud') {
            if (player) (player as any).play();
            else startSoundCloud(cell);
        } else if (cell.provider === 'spotify') {
            if (appState.spotify.player) {
                activateSpotify();
                void appState.spotify.player.resume().catch(() => providerFailed(cell.id, 'Spotify could not resume playback.'));
            }
            else providerFailed(cell.id, 'Spotify is not ready. Try again in a moment.');
        } else if (cell.provider === 'mp3') {
            const audio = (player as HTMLAudioElement) || initAudioPlayer(cell);
            void audio.play().catch(() => providerFailed(cell.id, 'Safari blocked audio playback. Tap Play to retry.'));
        }
    }
}

/**
 * Seeks to a specific timestamp in the current track.
 */
export async function seekTo(seconds: number) {
    if (appState.currentIndex < 0) return;
    
    const cell = appState.cells[appState.currentIndex];
    const player = appState.playerInstances[cell.id];
    
    try {
        if (cell.provider === 'youtube') {
            (player as any)?.seekTo?.(seconds, true);
        } else if (cell.provider === 'spotify') {
            await appState.spotify.player?.seek(seconds * 1000);
        } else if (cell.provider === 'mp3') {
            (player as HTMLAudioElement).currentTime = seconds;
        } else if (cell.provider === 'soundcloud') {
             (player as any)?.seekTo?.(seconds * 1000);
        }
        
        // Optimistically update state
        appState.progress.current = seconds;
    } catch (e) { console.warn('Seek error:', e); }
}

/**
 * Skips to the next song in the tape.
 */
export function playNext() {
    const songIndices = appState.cells
        .map((c, i) => isPlayable(c) ? i : -1)
        .filter(i => i >= 0);
    
    const currentPos = songIndices.indexOf(appState.currentIndex);
    const nextPos = currentPos + 1;

    if (nextPos < songIndices.length) {
        startPlayer(songIndices[nextPos]);
    } else {
        // End of tape
        stopCurrentPlayer();
        appState.setCurrentIndex(-1);
    }
}

/**
 * Skips to the previous song in the tape.
 */
export function playPrev() {
    const songIndices = appState.cells
        .map((c, i) => isPlayable(c) ? i : -1)
        .filter(i => i >= 0);
    
    const currentPos = songIndices.indexOf(appState.currentIndex);
    const prevPos = currentPos - 1;

    if (prevPos >= 0) {
        startPlayer(songIndices[prevPos]);
    }
}

// Internal Provider Starters

function startYouTube(cell: Cell) {
    let player = appState.playerInstances[cell.id];
    if (!player) {
        const match = cell.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (match) {
            initYoutubePlayer(cell, match[1]).then(p => {
                if (appState.isStarting && isCurrent(cell.id) && p) {
                    p?.seekTo?.(0, true);
                    p?.playVideo?.();
                } else if (!p && appState.isStarting && isCurrent(cell.id)) {
                    providerFailed(cell.id, 'YouTube could not load. Tap Play to retry.');
                }
            });
        } else providerFailed(cell.id, 'Invalid YouTube URL.');
    } else {
        (player as any)?.seekTo?.(0, true);
        (player as any)?.playVideo?.();
    }
}

function startSoundCloud(cell: Cell) {
    let player = appState.playerInstances[cell.id];
    if (!player) {
        initSoundCloudPlayer(cell).then(p => {
            if (appState.isStarting && isCurrent(cell.id) && p) {
                p?.seekTo?.(0);
                p?.play?.();
            } else if (!p && appState.isStarting && isCurrent(cell.id)) {
                providerFailed(cell.id, 'SoundCloud could not load. Tap Play to retry.');
            }
        });
    } else {
        (player as any)?.seekTo?.(0);
        (player as any)?.play?.();
    }
}

function startSpotify(cell: Cell) {
    if (!appState.spotify.token || !appState.spotify.isReady) {
        providerFailed(cell.id, 'Spotify is not ready. Try again in a moment.');
        return;
    }
    const match = cell.content.match(/(?:track\/|track:)([\w]+)/);
    // Spotify API starts from the beginning by default unless position_ms is specified
    if (match) void playSpotifySdk(`spotify:track:${match[1]}`, cell.id);
    else providerFailed(cell.id, 'Invalid Spotify URL.');
}

function startMp3(cell: Cell) {
    let player = appState.playerInstances[cell.id] as HTMLAudioElement;
    if (!player) player = initAudioPlayer(cell);
    player.currentTime = 0;
    void player.play().catch(() => providerFailed(cell.id, 'Safari blocked audio playback. Tap Play to retry.'));
}

/**
 * Internal helper to command the Spotify Web Playback SDK via the Web API.
 * The SDK itself doesn't have a direct 'load track' method that works for all devices,
 * so we use the 'play' endpoint with the specific device ID.
 */
async function playSpotifySdk(uri: string, id: string) {
    if (!appState.spotify.token || !appState.spotify.deviceId) return;
    try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${appState.spotify.deviceId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${appState.spotify.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: [uri] })
    });
    
    if (response.status === 401) {
        appState.spotify.token = null;
        localStorage.removeItem('spotify_access_token');
        console.error('Spotify token expired during playback');
    }
    if (!response.ok) providerFailed(id, `Spotify could not play this track (${response.status}).`);
    } catch {
        providerFailed(id, 'Spotify could not connect. Tap Play to retry.');
    }
}

let progressTimer: number | undefined;

/**
 * Poll at a modest rate; requestAnimationFrame stops in background Safari tabs.
 * Polling is used because not all player APIs provide consistent progress events.
 */
function startProgressLoop() {
    stopProgressLoop();
    const update = async () => {
        if (!appState.isPlaying || appState.currentIndex < 0) return;
        
        const cell = appState.cells[appState.currentIndex];
        const id = cell.id;
        const player = appState.playerInstances[cell.id];
        
        let current = 0;
        let total = 0;

        try {
            if (cell.provider === 'youtube') {
                const yt = player as any;
                if (yt && yt.getCurrentTime) {
                    current = yt.getCurrentTime();
                    total = yt.getDuration();
                }
            } else if (cell.provider === 'spotify') {
                if (appState.spotify.player) {
                    const state = await appState.spotify.player.getCurrentState();
                    if (!isCurrent(id) || !appState.isPlaying) return;
                    if (state) {
                        current = state.position / 1000;
                        total = state.duration / 1000;
                    }
                }
            } else if (cell.provider === 'mp3') {
                const audio = player as HTMLAudioElement;
                if (audio) {
                    current = audio.currentTime;
                    total = audio.duration;
                }
            } else if (cell.provider === 'soundcloud') {
                // SoundCloud progress is driven by the widget's PLAY_PROGRESS /
                // PLAY events. Polling the cross-origin iframe floods postMessage.
            }
        } catch(e) {}

        if (total > 0 && isCurrent(id) && appState.isPlaying) {
            appState.progress.current = current;
            appState.progress.total = total;
        }

    };
    void update();
    progressTimer = window.setInterval(() => { void update(); }, 1000);
}

/**
 * Stops the progress polling loop.
 */
function stopProgressLoop() {
    window.clearInterval(progressTimer);
    progressTimer = undefined;
}

let youtubeWasBackgrounded = false;

/** Safari may suspend embedded media without delivering an iframe event while hidden. */
export function syncPlaybackOnReturn() {
    if (document.hidden) {
        youtubeWasBackgrounded = appState.isPlaying && appState.cells[appState.currentIndex]?.provider === 'youtube';
        return;
    }
    if (appState.currentIndex < 0) return;
    const cell = appState.cells[appState.currentIndex];
    const player = appState.playerInstances[cell.id];
    if (cell.provider === 'youtube') {
        try {
            const state = (player as any)?.getPlayerState?.();
            if (state === 0 && appState.isPlaying) playNext();
            else if (state === 2 || state === -1) {
                if (appState.isPlaying) providerPaused(cell.id);
                if (youtubeWasBackgrounded && !appState.isStarting) {
                    appState.playbackError = 'Safari stopped YouTube in the background. Tap Play to resume, or open in YouTube.';
                }
            }
        } catch { /* The iframe may have been unloaded while Safari was suspended. */ }
    }
    youtubeWasBackgrounded = false;
    if (cell.provider === 'mp3' && appState.isPlaying && (player as HTMLAudioElement)?.paused) providerPaused(cell.id);
}
