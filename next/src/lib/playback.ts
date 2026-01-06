import type { Cell } from './types';
import { appState } from './state.svelte';
import { initYoutubePlayer, initSoundCloudPlayer, initAudioPlayer, initSpotifySdkPlayer } from './players';

export function startPlayer(index: number) {
    if (index < 0 || index >= appState.cells.length) return;
    const cell = appState.cells[index];
    if (cell.type !== 'song') return;

    stopCurrentPlayer();
    appState.setCurrentIndex(index);
    appState.setIsPlaying(true);

    switch (cell.provider) {
        case 'youtube': startYouTube(cell); break;
        case 'soundcloud': startSoundCloud(cell); break;
        case 'spotify': startSpotify(cell); break;
        case 'mp3': startMp3(cell); break;
    }

    startProgressLoop();
}

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

export function togglePlayPause() {
    if (appState.currentIndex < 0) {
        const firstSong = appState.cells.findIndex(c => c.type === 'song');
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

export function playNext() {
    const songIndices = appState.cells
        .map((c, i) => c.type === 'song' ? i : -1)
        .filter(i => i >= 0);
    
    const currentPos = songIndices.indexOf(appState.currentIndex);
    const nextPos = currentPos + 1;

    if (nextPos < songIndices.length) {
        startPlayer(songIndices[nextPos]);
    } else {
        stopCurrentPlayer();
        appState.setIsPlaying(false);
        appState.setCurrentIndex(-1);
    }
}

export function playPrev() {
    const songIndices = appState.cells
        .map((c, i) => c.type === 'song' ? i : -1)
        .filter(i => i >= 0);
    
    const currentPos = songIndices.indexOf(appState.currentIndex);
    const prevPos = currentPos - 1;

    if (prevPos >= 0) {
        startPlayer(songIndices[prevPos]);
    }
}

// Helpers
function startYouTube(cell: Cell) {
    let player = appState.playerInstances[cell.id];
    if (!player) {
        const match = cell.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (match) initYoutubePlayer(cell, match[1]);
    } else {
        (player as any).playVideo?.();
    }
}

function startSoundCloud(cell: Cell) {
    let player = appState.playerInstances[cell.id];
    if (!player) initSoundCloudPlayer(cell);
    else (player as any).play?.();
}

function startSpotify(cell: Cell) {
    if (!appState.spotify.token || !appState.spotify.isReady) return;
    const match = cell.content.match(/(?:track\/|track:)([\w]+)/);
    if (match) playSpotifySdk(`spotify:track:${match[1]}`);
}

function startMp3(cell: Cell) {
    let player = appState.playerInstances[cell.id] as HTMLAudioElement;
    if (!player) player = initAudioPlayer(cell);
    player.play();
}

async function playSpotifySdk(uri: string) {
    if (!appState.spotify.token || !appState.spotify.deviceId) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${appState.spotify.deviceId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${appState.spotify.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: [uri] })
    });
}

let progressFrame: number;
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
            }
             // SoundCloud
             else if (cell.provider === 'soundcloud') {
                 const sc = player as any;
                 // SC Widget getPosition is async. We can't really do it in a tight loop easily without callback hell.
                 // Ideally we bind to 'playProgress' event instead of polling.
                 // But for parity let's try a simple poll if possible or skip.
                 // SC widget api is event based mostly.
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

function stopProgressLoop() {
    cancelAnimationFrame(progressFrame);
}