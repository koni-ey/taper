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
 * Initializes a YouTube IFrame Player for a specific cell.
 */
export function initYoutubePlayer(cell: Cell, videoId: string) {
    if (!playerContainer) return;

    let div = document.getElementById(`yt-player-${cell.id}`);
    if (!div) {
        div = document.createElement('div');
        div.id = `yt-player-${cell.id}`;
        playerContainer.appendChild(div);
    }

    // @ts-ignore
    if (typeof YT === 'undefined' || !YT.Player) {
        console.warn('YouTube API not loaded yet');
        return;
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

                // Auto-play if this is the current active cell
                if (appState.cells[appState.currentIndex]?.id === cell.id && appState.isPlaying) {
                    event.target.playVideo();
                }
            },
            onStateChange: (event: any) => {
                if (event.data === 0) { // 0 = YT.PlayerState.ENDED
                    playNext();
                }
            }
        }
    });

    appState.setPlayerInstance(cell.id, player);
}

/**
 * Initializes a SoundCloud Widget Player for a specific cell.
 * Uses a hidden iframe and the SoundCloud Widget API.
 */
export function initSoundCloudPlayer(cell: Cell) {
    if (!playerContainer) return;

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
    if (typeof SC === 'undefined' || !SC.Widget) return;

    // @ts-ignore
    const widget = SC.Widget(iframe);

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
            if (appState.cells[appState.currentIndex]?.id === cell.id) {
                appState.progress.total = duration / 1000;
            }
        });

        widget.play();
    });

    // @ts-ignore
    widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
        if (appState.cells[appState.currentIndex]?.id === cell.id) {
            appState.progress.current = data.currentPosition / 1000;
        }
    });

    // @ts-ignore
    widget.bind(SC.Widget.Events.FINISH, () => {
        playNext();
    });

    appState.setPlayerInstance(cell.id, widget);
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