/**
 * Player Initializers.
 * Handles the creation and mounting of specific music player instances (YouTube, SoundCloud, Spotify, Audio).
 * Embeds are mounted in a shared container for unified control via the Taper UI.
 */

import type { Cell } from './types';
import { appState } from './state.svelte';
import { playNext, providerFailed, providerPaused, providerPlaying } from './playback';

/**
 * Global reference to the container where player elements are mounted.
 */
let playerContainer: HTMLElement | null = null;
const youtubePending = new Map<string, Promise<any>>();
const soundCloudPending = new Map<string, Promise<any>>();

function isCurrent(id: string) {
    return appState.cells[appState.currentIndex]?.id === id;
}

function waitForYouTubeApi(): Promise<boolean> {
    // @ts-ignore External script
    if (typeof YT !== 'undefined' && YT.Player) return Promise.resolve(true);
    return new Promise(resolve => {
        const ready = () => { clearTimeout(timeout); resolve(true); };
        const timeout = window.setTimeout(() => {
            window.removeEventListener('taper-youtube-ready', ready);
            resolve(false);
        }, 10000);
        window.addEventListener('taper-youtube-ready', ready, { once: true });
    });
}

/**
 * Sets the element used for mounting player SDK components.
 */
export function setPlayerContainer(element: HTMLElement) {
    playerContainer = element;
}

/**
 * Initializes a YouTube IFrame Player for a specific cell.
 */
export function initYoutubePlayer(cell: Cell, videoId: string): Promise<any> {
    if (appState.playerInstances[cell.id]) return Promise.resolve(appState.playerInstances[cell.id]);
    if (youtubePending.has(cell.id)) return youtubePending.get(cell.id)!;
    const pending = createYoutubePlayer(cell, videoId).catch(() => null).finally(() => youtubePending.delete(cell.id));
    youtubePending.set(cell.id, pending);
    return pending;
}

async function createYoutubePlayer(cell: Cell, videoId: string): Promise<any> {
    if (!playerContainer || !await waitForYouTubeApi()) return null;
    const container = playerContainer;
    return new Promise((resolve) => {
        let ready = false;
        const timeout = window.setTimeout(() => {
            if (ready) return;
            ready = true;
            player?.destroy?.();
            resolve(null);
        }, 10000);

        let div = document.getElementById(`yt-player-${cell.id}`);
        if (!div) {
            div = document.createElement('div');
            div.id = `yt-player-${cell.id}`;
            container.appendChild(div);
        }

        // @ts-ignore
        const player = new YT.Player(div.id, {
            height: '200',
            width: '200',
            videoId: videoId,
            playerVars: {
                controls: 1,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                playsinline: 1,
                origin: window.location.origin
            },
            events: {
                onReady: (event: any) => {
                    if (ready) return;
                    ready = true;
                    window.clearTimeout(timeout);
                    event.target.getIframe().setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
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
                    if (!isCurrent(cell.id)) return;
                    if (event.data === 1) providerPlaying(cell.id);
                    else if (event.data === 2) providerPaused(cell.id);
                    else if (event.data === 0) { // 0 = YT.PlayerState.ENDED
                        playNext();
                    }
                },
                onAutoplayBlocked: () => providerFailed(cell.id, 'Safari blocked YouTube playback. Tap Play again, or open the track in YouTube.'),
                onError: () => {
                    if (!ready) {
                        ready = true;
                        window.clearTimeout(timeout);
                        player?.destroy?.();
                        resolve(null);
                    }
                    providerFailed(cell.id, 'This YouTube video cannot play here. Open it in YouTube instead.');
                }
            }
        });
    });
}

/**
 * Initializes a SoundCloud Widget Player for a specific cell.
 * Uses an iframe and the SoundCloud Widget API.
 */
export function initSoundCloudPlayer(cell: Cell): Promise<any> {
    if (appState.playerInstances[cell.id]) return Promise.resolve(appState.playerInstances[cell.id]);
    if (soundCloudPending.has(cell.id)) return soundCloudPending.get(cell.id)!;
    const pending = new Promise<any>((resolve) => {
        if (!playerContainer) return resolve(null);

        // Bail out early if the SoundCloud Widget API script has not loaded yet.
        // We intentionally avoid creating an orphaned iframe here so that a later
        // pre-initialization pass (triggered once the script loads) can create the
        // widget cleanly and store its instance for synchronous, in-gesture playback.
        // @ts-ignore
        if (typeof SC === 'undefined' || !SC.Widget) return resolve(null);

        let ready = false;
        const timeout = window.setTimeout(() => { ready = true; resolve(null); }, 10000);

        let iframe = document.getElementById(`sc-player-${cell.id}`) as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = `sc-player-${cell.id}`;
            iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cell.content)}&auto_play=false`;
            iframe.allow = 'autoplay';
            iframe.style.width = '200px';
            iframe.style.height = '200px';
            playerContainer.appendChild(iframe);
        }

        // @ts-ignore
        const widget = SC.Widget(iframe);

        // Cache the track duration (seconds) once known so we can keep the
        // progress bar's total in sync as the track becomes current.
        let durationSec = 0;
        const syncTotal = () => {
            if (durationSec > 0 && isCurrent(cell.id)) {
                appState.progress.total = durationSec;
            }
        };

        // Bind event listeners
        // @ts-ignore
        widget.bind(SC.Widget.Events.READY, () => {
            if (ready) return;
            ready = true;
            window.clearTimeout(timeout);
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
            providerPlaying(cell.id);
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
            if (isCurrent(cell.id)) {
                appState.progress.current = data.currentPosition / 1000;
                syncTotal();
            }
        });

        // @ts-ignore External widget API
        widget.bind(SC.Widget.Events.PAUSE, () => providerPaused(cell.id));
        // @ts-ignore External widget API
        widget.bind(SC.Widget.Events.ERROR, () => providerFailed(cell.id, 'SoundCloud could not play this track.'));

        // @ts-ignore
        widget.bind(SC.Widget.Events.FINISH, () => {
            if (isCurrent(cell.id)) playNext();
        });
    });
    soundCloudPending.set(cell.id, pending);
    void pending.then(() => soundCloudPending.delete(cell.id), () => soundCloudPending.delete(cell.id));
    return pending;
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

    player.addListener('not_ready', () => {
        appState.spotify.isReady = false;
        if (appState.cells[appState.currentIndex]?.provider === 'spotify') {
            providerFailed(appState.cells[appState.currentIndex].id, 'Spotify disconnected. Tap Play to retry.');
        }
    });
    player.addListener('autoplay_failed', () => {
        if (appState.cells[appState.currentIndex]?.provider === 'spotify') {
            providerFailed(appState.cells[appState.currentIndex].id, 'Safari blocked Spotify playback. Tap Play to retry.');
        }
    });
    player.addListener('playback_error', () => {
        if (appState.cells[appState.currentIndex]?.provider === 'spotify') {
            providerFailed(appState.cells[appState.currentIndex].id, 'Spotify could not play this track.');
        }
    });

    let previousState: any = null;
    player.addListener('player_state_changed', (state: any) => {
        if (!state) return;

        // Sync metadata from Spotify's current state
        if (appState.currentIndex >= 0 && appState.cells[appState.currentIndex]?.provider === 'spotify') {
            if (!state.paused) providerPlaying(appState.cells[appState.currentIndex].id);
            else providerPaused(appState.cells[appState.currentIndex].id);
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
        if (state.paused && state.position === 0 && previousState && !previousState.paused &&
            previousState.position >= previousState.duration - 3000 &&
            state.track_window?.current_track?.uri === previousState.track_window?.current_track?.uri &&
            appState.cells[appState.currentIndex]?.provider === 'spotify') {
            playNext();
        }
        previousState = state;
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
    audio.onplaying = () => providerPlaying(cell.id);
    audio.onpause = () => providerPaused(cell.id);
    audio.onerror = () => providerFailed(cell.id, 'This audio file could not be played.');
    audio.onended = () => { if (isCurrent(cell.id)) playNext(); };
    appState.setPlayerInstance(cell.id, audio);
    return audio;
}

/**
 * Pre-initializes players so the iframe is ready when the user taps Play.
 * This does not bypass browser autoplay or background-playback restrictions.
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
