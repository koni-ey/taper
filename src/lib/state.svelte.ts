import type { Cell, PlayerInstances } from './types';

class AppState {
    cells = $state<Cell[]>([]);
    currentIndex = $state<number>(-1);
    isPlaying = $state<boolean>(false);
    playerInstances = $state<PlayerInstances>({});
    youtubeApiReady = $state<boolean>(false);
    isEditMode = $state<boolean>(false);
    
    progress = $state({ current: 0, total: 0 });

    spotify = $state({
        token: null as string | null,
        deviceId: null as string | null,
        player: null as any,
        isReady: false
    });

    setCells(newCells: Cell[]) { this.cells = newCells; }
    setCurrentIndex(idx: number) { this.currentIndex = idx; }
    setIsPlaying(playing: boolean) { this.isPlaying = playing; }
    setPlayerInstance(id: string, player: any) { this.playerInstances[id] = player; }
    setYoutubeApiReady(ready: boolean) { this.youtubeApiReady = ready; }
    setIsEditMode(mode: boolean) { this.isEditMode = mode; }
}

export const appState = new AppState();
