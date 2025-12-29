/**
 * @fileoverview Global Application State
 * 
 * This module manages all mutable global state for the application.
 * Centralizing state makes it easier to track and debug.
 */

import { Cell, PlayerInstances } from './types';

// ============================================================================
// TAPE STATE
// ============================================================================

/** Array of all cells in the current tape */
export let cells: Cell[] = [];

/** Index of the currently playing song cell (-1 = none) */
export let currentIndex = -1;

/** Whether playback is active (UI state) */
export let isPlaying = false;

// ============================================================================
// PLAYER STATE
// ============================================================================

/** Map of cell ID to player instance (YouTube, SoundCloud, Audio, etc.) */
export let playerInstances: PlayerInstances = {};

/** Whether YouTube IFrame API is loaded and ready */
export let youtubeApiReady = false;

// ============================================================================
// EDITOR STATE
// ============================================================================

/** Whether edit mode is active */
export let isEditMode = false;

/** Whether raw markdown editor is active */
export let isRawMode = false;

/** ID of the cell currently being edited (null = none) */
export let editingCellId: string | null = null;

// ============================================================================
// STATE SETTERS
// ============================================================================

// These functions allow other modules to update state

export function setCells(newCells: Cell[]) { cells = newCells; }
export function setCurrentIndex(index: number) { currentIndex = index; }
export function setIsPlaying(playing: boolean) { isPlaying = playing; }
export function setPlayerInstance(cellId: string, player: any) { playerInstances[cellId] = player; }
export function clearPlayerInstances() { playerInstances = {}; }
export function setYoutubeApiReady(ready: boolean) { youtubeApiReady = ready; }
export function setIsEditMode(mode: boolean) { isEditMode = mode; }
export function setIsRawMode(mode: boolean) { isRawMode = mode; }
export function setEditingCellId(id: string | null) { editingCellId = id; }
