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
    return true;
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
    appState.setIsPlaying(true);
    appState.progress = { current: 0, total: 0 }; // Reset progress immediately

    switch (cell.provider) {
        case 'youtube': startYouTube(cell); break;
        case 'soundcloud': startSoundCloud(cell); break;
        case 'spotify': startSpotify(cell); break;
        case 'mp3': startMp3(cell); break;
    }

    startProgressLoop();
}

/**
 * Stops (pauses) the currently playing track.
 */
export function stopCurrentPlayer() {
    stopProgressLoop();
    if (appState.currentIndex < 0) return;
    
    const cell = appState.cells[appState.currentIndex];
    const player = appState.playerInstances[cell.id];

    try {
        if (cell.provider === 'youtube') (player as any)?.pauseVideo?.();
        else if (cell.provider === 'soundcloud') (player as any)?.pause?.();
        else if (cell.provider === 'spotify') appState.spotify.player?.pause();
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

    if (appState.isPlaying) {
        stopProgressLoop();
        if (cell.provider === 'youtube') (player as any)?.pauseVideo?.();
        else if (cell.provider === 'soundcloud') (player as any)?.pause?.();
        else if (cell.provider === 'spotify') appState.spotify.player?.pause();
        else if (cell.provider === 'mp3') (player as HTMLAudioElement)?.pause();
        appState.setIsPlaying(false);
    } else {
        if (cell.provider === 'youtube') (player as any)?.playVideo?.();
        else if (cell.provider === 'soundcloud') (player as any)?.play?.();
        else if (cell.provider === 'spotify') appState.spotify.player?.resume();
        else if (cell.provider === 'mp3') (player as HTMLAudioElement)?.play();
        appState.setIsPlaying(true);
        startProgressLoop();
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
        appState.setIsPlaying(false);
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
                if (appState.isPlaying && appState.currentIndex === appState.cells.findIndex(c => c.id === cell.id)) {
                    p?.seekTo?.(0, true);
                    p?.playVideo?.();
                }
            });
        }
    } else {
        (player as any)?.seekTo?.(0, true);
        (player as any)?.playVideo?.();
    }
}

function startSoundCloud(cell: Cell) {
    let player = appState.playerInstances[cell.id];
    if (!player) {
        initSoundCloudPlayer(cell).then(p => {
            if (appState.isPlaying && appState.currentIndex === appState.cells.findIndex(c => c.id === cell.id)) {
                p?.seekTo?.(0);
                p?.play?.();
            }
        });
    } else {
        (player as any)?.seekTo?.(0);
        (player as any)?.play?.();
    }
}

function startSpotify(cell: Cell) {
    if (!appState.spotify.token || !appState.spotify.isReady) return;
    const match = cell.content.match(/(?:track\/|track:)([\w]+)/);
    // Spotify API starts from the beginning by default unless position_ms is specified
    if (match) playSpotifySdk(`spotify:track:${match[1]}`);
}

function startMp3(cell: Cell) {
    let player = appState.playerInstances[cell.id] as HTMLAudioElement;
    if (!player) player = initAudioPlayer(cell);
    player.currentTime = 0;
    player.play();
}

/**
 * Internal helper to command the Spotify Web Playback SDK via the Web API.
 * The SDK itself doesn't have a direct 'load track' method that works for all devices,
 * so we use the 'play' endpoint with the specific device ID.
 */
async function playSpotifySdk(uri: string) {
    if (!appState.spotify.token || !appState.spotify.deviceId) return;
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
}

let progressFrame: number;

/**
 * High-frequency loop using requestAnimationFrame to update playback progress (current time/total time).
 * Polling is used because not all player APIs provide consistent progress events.
 */
function startProgressLoop() {
    cancelAnimationFrame(progressFrame);
    const update = async () => {
        if (!appState.isPlaying || appState.currentIndex < 0) return;
        
        const cell = appState.cells[appState.currentIndex];
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
                const sc = player as any;
                if (sc && sc.getPosition && sc.getDuration) {
                    // SoundCloud widget methods are async with callbacks
                    sc.getPosition((pos: number) => {
                        sc.getDuration((dur: number) => {
                            if (pos !== null && dur !== null) {
                                appState.progress.current = pos / 1000;
                                appState.progress.total = dur / 1000;
                            }
                        });
                    });
                    // We don't update current/total synchronously here, the callback will do it
                    current = appState.progress.current;
                    total = appState.progress.total;
                }
            }
        } catch(e) {}

        if (total > 0) {
            appState.progress.current = current;
            appState.progress.total = total;
        }

        if (appState.isPlaying) {
            progressFrame = requestAnimationFrame(update);
        }
    };
    update();
}

/**
 * Stops the progress polling loop.
 */
function stopProgressLoop() {
    cancelAnimationFrame(progressFrame);
}
