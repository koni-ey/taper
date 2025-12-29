/**
 * @fileoverview Playback Control
 * 
 * This module handles all playback operations:
 * - Starting/stopping specific tracks
 * - Play/pause toggle
 * - Next/previous navigation
 * - Progress bar updates
 * - UI synchronization
 */

import { Cell } from './types';
import { SONG_PROVIDERS } from './config';
import { spotifyToken, spotifyPlayer, spotifyDeviceId, spotifySdkReady } from './auth';
import {
    cells, currentIndex, isPlaying, playerInstances,
    setCurrentIndex, setIsPlaying
} from './state';
import {
    playerBar, playBtn, progressBar,
    currentTime, durationEl, hiddenEmbed
} from './dom';
import { updatePlayerBarDOM, updateCardDOM } from './renderer';
import { initYoutubePlayer, initSoundCloudPlayer, initAudioPlayer } from './players';

// ============================================================================
// PLAYBACK CONTROL
// ============================================================================

/**
 * Start playing a specific song cell
 * Stops any currently playing track and initializes the new one
 * 
 * @param index - Index of the cell in the cells array
 */
export function startPlayer(index: number): void {
    if (index < 0 || index >= cells.length) return;

    const cell = cells[index];
    if (cell.type !== 'song') return;

    // Stop current player
    stopCurrentPlayer();

    setCurrentIndex(index);
    setIsPlaying(true);

    // Update UI
    updateActiveCell();
    updatePlayerBarDOM(cell);
    showPlayerBar();

    // Start appropriate player
    switch (cell.provider) {
        case 'youtube':
            startYouTube(cell);
            break;
        case 'soundcloud':
            startSoundCloud(cell);
            break;
        case 'spotify':
            startSpotify(cell);
            break;
        case 'mp3':
            startMp3(cell);
            break;
        default:
            console.warn('Unknown provider:', cell.provider);
    }

    startProgressLoop();
}

/**
 * Stop the currently playing track
 */
export function stopCurrentPlayer(): void {
    stopProgressLoop();
    if (currentIndex < 0) return;

    const cell = cells[currentIndex];
    if (!cell) return;

    const player = playerInstances[cell.id];

    try {
        switch (cell.provider) {
            case 'youtube':
                (player as any)?.pauseVideo?.();
                break;
            case 'soundcloud':
                (player as any)?.pause?.();
                break;
            case 'spotify':
                pauseSpotifySdk();
                break;
            case 'mp3':
                (player as HTMLAudioElement)?.pause?.();
                break;
        }
    } catch (e) {
        console.warn('Error stopping player:', e);
    }
}

/**
 * Toggle play/pause state
 */
export function togglePlayPause(): void {
    if (currentIndex < 0) {
        // Nothing playing, start first song
        const firstSong = cells.findIndex(c => c.type === 'song');
        if (firstSong >= 0) startPlayer(firstSong);
        return;
    }

    const cell = cells[currentIndex];
    const player = playerInstances[cell.id];

    if (isPlaying) {
        stopProgressLoop();
        // Pause
        switch (cell.provider) {
            case 'youtube':
                (player as any)?.pauseVideo?.();
                break;
            case 'soundcloud':
                (player as any)?.pause?.();
                break;
            case 'spotify':
                pauseSpotifySdk();
                break;
            case 'mp3':
                (player as HTMLAudioElement)?.pause?.();
                break;
        }
        setIsPlaying(false);
    } else {
        // Resume
        switch (cell.provider) {
            case 'youtube':
                (player as any)?.playVideo?.();
                break;
            case 'soundcloud':
                (player as any)?.play?.();
                break;
            case 'spotify':
                resumeSpotifySdk();
                break;
            case 'mp3':
                (player as HTMLAudioElement)?.play?.();
                break;
        }
        setIsPlaying(true);
        startProgressLoop();
    }

    updatePlayButton();
}

/**
 * Skip to next song
 */
export function playNext(): void {
    const songIndices = cells
        .map((c, i) => c.type === 'song' ? i : -1)
        .filter(i => i >= 0);

    const currentSongPos = songIndices.indexOf(currentIndex);
    const nextPos = currentSongPos + 1;

    if (nextPos < songIndices.length) {
        startPlayer(songIndices[nextPos]);
    } else {
        // End of playlist
        stopCurrentPlayer();
        setIsPlaying(false);
        setCurrentIndex(-1);
        updatePlayButton();
    }
}

/**
 * Skip to previous song
 */
export function playPrev(): void {
    const songIndices = cells
        .map((c, i) => c.type === 'song' ? i : -1)
        .filter(i => i >= 0);

    const currentSongPos = songIndices.indexOf(currentIndex);
    const prevPos = currentSongPos - 1;

    if (prevPos >= 0) {
        startPlayer(songIndices[prevPos]);
    }
}

// ============================================================================
// PROVIDER-SPECIFIC PLAYBACK
// ============================================================================

function startYouTube(cell: Cell): void {
    let player = playerInstances[cell.id];

    if (!player) {
        // Extract video ID and create player
        const match = cell.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (match) {
            initYoutubePlayer(cell, match[1]);
            // Player will auto-play when ready
        }
    } else {
        (player as any).playVideo?.();
    }
}

function startSoundCloud(cell: Cell): void {
    let player = playerInstances[cell.id];

    if (!player) {
        // Create iframe and initialize widget
        const iframe = document.createElement('iframe');
        iframe.id = `sc-player-${cell.id}`;
        iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cell.content)}&auto_play=true`;
        iframe.style.display = 'none';
        hiddenEmbed.appendChild(iframe);

        iframe.onload = () => {
            initSoundCloudPlayer(cell, iframe);
        };
    } else {
        (player as any).play?.();
    }
}

function startSpotify(cell: Cell): void {
    if (!spotifyToken || !spotifySdkReady) {
        console.warn('Spotify not ready');
        return;
    }

    const match = cell.content.match(/(?:track\/|track:)([\w]+)/);
    if (match) {
        playSpotifySdk(`spotify:track:${match[1]}`);
    }
}

function startMp3(cell: Cell): void {
    let player = playerInstances[cell.id] as HTMLAudioElement;

    if (!player) {
        player = initAudioPlayer(cell);
    }

    player.play();
}

// ============================================================================
// SPOTIFY SDK CONTROLS
// ============================================================================

/**
 * Play a Spotify track by URI
 */
export async function playSpotifySdk(uri: string): Promise<void> {
    if (!spotifyToken || !spotifyDeviceId) return;

    try {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${spotifyToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [uri] })
        });
    } catch (error) {
        console.error('Spotify play error:', error);
    }
}

/**
 * Pause Spotify playback
 */
export async function pauseSpotifySdk(): Promise<void> {
    try {
        await spotifyPlayer?.pause();
    } catch (error) {
        console.error('Spotify pause error:', error);
    }
}

/**
 * Resume Spotify playback
 */
export async function resumeSpotifySdk(): Promise<void> {
    try {
        await spotifyPlayer?.resume();
    } catch (error) {
        console.error('Spotify resume error:', error);
    }
}

/**
 * Seek Spotify playback position
 */
export async function seekSpotifySdk(positionMs: number): Promise<void> {
    try {
        await spotifyPlayer?.seek(positionMs);
    } catch (error) {
        console.error('Spotify seek error:', error);
    }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function showPlayerBar(): void {
    playerBar.classList.remove('hidden');
}



function updatePlayButton(): void {
    playBtn.innerHTML = isPlaying ? '⏸' : '▶';
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

let progressFrame: number;

function startProgressLoop(): void {
    cancelAnimationFrame(progressFrame);

    const update = async () => {
        if (!isPlaying || currentIndex < 0) return;

        const cell = cells[currentIndex];
        const player = playerInstances[cell.id];
        let current = 0;
        let total = 0;

        try {
            switch (cell.provider) {
                case 'youtube':
                    const ytPlayer = player as any; // Cast to any or YouTubePlayer if imported
                    if (ytPlayer && ytPlayer.getCurrentTime) {
                        current = ytPlayer.getCurrentTime();
                        total = ytPlayer.getDuration();
                    }
                    break;

                case 'soundcloud':
                    // SC Widget logic omitted for brevity/async complexity
                    break;

                case 'spotify':
                    if (spotifyPlayer) {
                        const state = await spotifyPlayer.getCurrentState();
                        if (state) {
                            current = state.position / 1000;
                            total = state.duration / 1000;
                        }
                    }
                    break;

                case 'mp3':
                    const audio = player as HTMLAudioElement;
                    if (audio) {
                        current = audio.currentTime;
                        total = audio.duration;
                    }
                    break;
            }

            if (total > 0) {
                // Update UI
                const progress = (current / total) * 100;
                (progressBar as HTMLInputElement).value = progress.toString();

                currentTime.textContent = formatTime(current);
                durationEl.textContent = formatTime(total);

                // Update progress bar background for visual fill
                progressBar.style.background = `linear-gradient(to right, var(--accent-color) ${progress}%, #e0e0e0 ${progress}%)`;
            }
        } catch (e) {
            // Ignore temporary errors
        }

        if (isPlaying) {
            progressFrame = requestAnimationFrame(update);
        }
    };

    update();
}

function stopProgressLoop(): void {
    cancelAnimationFrame(progressFrame);
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Update visual indicators for active cell
 */
export function updateActiveCell(): void {
    // Remove active class from all cards
    document.querySelectorAll('.song-card').forEach(card => {
        card.classList.remove('active');
    });

    // Add active class to current
    if (currentIndex >= 0) {
        const cell = cells[currentIndex];
        const card = document.querySelector(`#wrapper-${cell.id} .song-card`);
        card?.classList.add('active');
    }

    updatePlayButton();
}

