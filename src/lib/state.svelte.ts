/**
 * Global application state managed with Svelte 5 runes.
 * Provides a reactive store for cells, playback status, and player instances.
 */

import type { Cell, PlayerInstances } from './types';

class AppState {
    /** The collection of cells (text or songs) in the current tape */
    cells = $state<Cell[]>([]);
    
    /** Index of the currently playing song cell. -1 if none. */
    currentIndex = $state<number>(-1);
    
    /** Whether music is currently playing */
    isPlaying = $state<boolean>(false);
    
    /** Dictionary of player API instances (YouTube Widget, SC Widget, etc.) keyed by cell ID */
    playerInstances = $state<PlayerInstances>({});
    
    /** Whether the YouTube Iframe API script has loaded and is ready */
    youtubeApiReady = $state<boolean>(false);
    
    /** Whether the app is in 'raw mode' (direct markdown editing) */
    isEditMode = $state<boolean>(false);
    
    /** Playback progress in seconds */
    progress = $state({ current: 0, total: 0 });

    /** Spotify-specific state including auth token and SDK player instance */
    spotify = $state({
        token: null as string | null,
        deviceId: null as string | null,
        player: null as any,
        isReady: false
    });

    /** Batch update the entire collection of cells */
    setCells(newCells: Cell[]) { this.cells = newCells; }
    
    /** Change the current playing index */
    setCurrentIndex(idx: number) { this.currentIndex = idx; }
    
    /** Toggle the playing status */
    setIsPlaying(playing: boolean) { this.isPlaying = playing; }
    
    /** Store a player API instance for a specific cell */
    setPlayerInstance(id: string, player: any) { this.playerInstances[id] = player; }
    
    /** Mark the YouTube API as ready to be used */
    setYoutubeApiReady(ready: boolean) { this.youtubeApiReady = ready; }
    
    /** Toggle raw markdown edit mode */
    setIsEditMode(mode: boolean) { this.isEditMode = mode; }
}

/**
 * Singleton instance of the application state.
 */
export const appState = new AppState();