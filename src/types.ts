/**
 * @fileoverview Type definitions for Taper
 * 
 * This module defines the core data structures used throughout the app.
 */

// ============================================================================
// CELL TYPES
// ============================================================================

/**
 * Types of content a cell can contain
 * - 'markdown': Rich text rendered from markdown
 * - 'song': A playable audio track from various providers
 */
export type CellType = 'markdown' | 'song';

/**
 * A Cell represents a single block of content in a Tape.
 * 
 * Tapes are composed of an ordered array of Cells, where each cell
 * can be either markdown text or a playable song.
 */
export interface Cell {
    /** Unique identifier for this cell */
    id: string;

    /** Type of content: 'markdown' or 'song' */
    type: CellType;

    /** 
     * Raw content:
     * - For markdown: the markdown source text
     * - For songs: the URL or URI of the track
     */
    content: string;

    /** Optional metadata (unused, reserved for future) */
    metadata?: any;

    /** 
     * For song cells: which provider hosts this track
     * Determined automatically from the URL pattern
     */
    provider?: 'youtube' | 'soundcloud' | 'spotify' | 'mp3' | 'other';

    /** 
     * For song cells: the track title
     * Auto-fetched from Spotify API, or extracted from YouTube/SoundCloud
     */
    title?: string;

    /** 
     * For song cells: URL to album/track artwork
     * Auto-fetched from Spotify API
     */
    cover?: string;
}

// ============================================================================
// PLAYER TYPES
// ============================================================================

/**
 * YouTube Player instance from the IFrame API
 * @see https://developers.google.com/youtube/iframe_api_reference
 */
export interface YouTubePlayer {
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
}

/**
 * SoundCloud Widget instance from the Widget API
 * @see https://developers.soundcloud.com/docs/api/html5-widget
 */
export interface SoundCloudWidget {
    play(): void;
    pause(): void;
    seekTo(milliseconds: number): void;
    getPosition(callback: (position: number) => void): void;
    getDuration(callback: (duration: number) => void): void;
    bind(event: string, callback: Function): void;
}

/**
 * Spotify Web Playback SDK Player instance
 * @see https://developer.spotify.com/documentation/web-playback-sdk
 */
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

/**
 * Collection of all active player instances, keyed by cell ID
 */
export type PlayerInstances = Record<string, YouTubePlayer | SoundCloudWidget | HTMLAudioElement | null>;
