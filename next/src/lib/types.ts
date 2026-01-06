export type CellType = 'markdown' | 'song';

export interface Cell {
    id: string;
    type: CellType;
    content: string;
    metadata?: any;
    provider?: 'youtube' | 'soundcloud' | 'spotify' | 'mp3' | 'other';
    title?: string;
    cover?: string;
}

export interface YouTubePlayer {
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
}

export interface SoundCloudWidget {
    play(): void;
    pause(): void;
    seekTo(milliseconds: number): void;
    getPosition(callback: (position: number) => void): void;
    getDuration(callback: (duration: number) => void): void;
    bind(event: string, callback: Function): void;
}

export interface SpotifyPlayer {
    connect(): Promise<boolean>;
    disconnect(): void;
    getCurrentState(): Promise<any>;
    resume(): Promise<void>;
    pause(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    addListener(event: string, callback: Function): void;
    _options: { id: string };
}

export type PlayerInstances = Record<string, YouTubePlayer | SoundCloudWidget | HTMLAudioElement | null>;
