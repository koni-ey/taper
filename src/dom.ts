/**
 * @fileoverview DOM Element References
 * 
 * This module provides cached references to DOM elements
 * used throughout the application.
 */

// ============================================================================
// MAIN CONTAINERS
// ============================================================================

/** Main player view container - shows rendered tape content */
export const playerView = document.getElementById('player-view')!;

/** Tape content area - where cells are rendered */
export const tapeContent = document.getElementById('tape-content')!;

/** Raw markdown editor view container */
export const rawView = document.getElementById('raw-view')!;

/** Raw markdown textarea */
export const tapeEditor = document.getElementById('tape-editor') as HTMLTextAreaElement;

// ============================================================================
// HEADER CONTROLS
// ============================================================================

/** Edit mode toggle button */
export const editBtn = document.getElementById('edit-btn')!;

/** Raw mode toggle button */
export const rawBtn = document.getElementById('raw-btn')!;

/** Share/copy URL button */
export const shareBtn = document.getElementById('share-btn')!;

// ============================================================================
// PLAYER BAR
// ============================================================================

/** Bottom player bar container */
export const playerBar = document.getElementById('player-bar')!;

/** Currently playing song title */
export const nowPlaying = document.getElementById('now-playing')!;

/** Play/pause button */
export const playBtn = document.getElementById('play-btn')!;

/** Previous track button */
export const prevBtn = document.getElementById('prev-btn')!;

/** Next track button */
export const nextBtn = document.getElementById('next-btn')!;

/** Progress bar element */
export const progressBar = document.getElementById('progress-bar')!;

/** Current time display */
export const currentTime = document.getElementById('current-time')!;

/** Duration display */
export const durationEl = document.getElementById('duration')!;

/** Hidden container for player iframes */
export const hiddenEmbed = document.getElementById('hidden-embed')!;

/** Spotify connect button container */
export const spotifyConnect = document.getElementById('spotify-connect')!;
