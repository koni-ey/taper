/**
 * @fileoverview Editor Module - Edit Mode Logic
 * 
 * This module handles all editing functionality:
 * - Toggle between view/edit/raw modes
 * - Cell CRUD operations (add, delete, update)
 * - Drag and drop reordering
 * - Rendering cells with edit controls
 * 
 * The editor uses a "Colab-style" UX:
 * - Cells are displayed normally until double-clicked
 * - Add buttons appear on hover between cells
 * - Double-click enters edit mode for specific cell
 * - Alt+Enter exits cell editing
 */

import { Cell } from './types';
import {
    cells, isEditMode, isRawMode, editingCellId,
    setCells, setIsEditMode, setIsRawMode, setEditingCellId
} from './state';
import { tapeContent, tapeEditor, playerView, playerBar, rawView, editBtn, rawBtn } from './dom';
import { renderCell } from './renderer';
import { parseTape, serializeCells, generateId, isUrl, detectProvider } from './parser';
import { startPlayer, stopCurrentPlayer } from './playback';

// ============================================================================
// STATE PERSISTENCE
// ============================================================================

/**
 * Save the current tape state to the URL hash
 * This enables sharing and bookmarking tapes
 */
export function saveTapeState(): void {
    const markdown = serializeCells(cells);
    const encoded = btoa(unescape(encodeURIComponent(markdown)));
    window.location.hash = encoded;

    // Also update raw editor if in raw mode
    tapeEditor.value = markdown;
}

/**
 * Save raw editor content directly to hash
 * Used when editing in raw mode
 */
function saveRawState(): void {
    const markdown = tapeEditor.value;
    const encoded = btoa(unescape(encodeURIComponent(markdown)));
    window.location.hash = encoded;
}

// ============================================================================
// CELL OPERATIONS
// ============================================================================

/**
 * Update a cell's content
 * Auto-detects if content is a song URL and converts type accordingly
 * 
 * @param id - Cell ID to update
 * @param newContent - New content string
 */
export function updateCell(id: string, newContent: string): void {
    const cell = cells.find(c => c.id === id);
    if (!cell) return;

    cell.content = newContent;

    // Auto-detect type change
    const trimmed = newContent.trim();
    let url = trimmed;

    if (trimmed.startsWith('song:')) {
        url = trimmed.substring(5).trim();
    }

    if (isUrl(url)) {
        cell.type = 'song';
        cell.content = url;
        cell.provider = detectProvider(url);

        // Set appropriate loading title
        if (cell.provider === 'spotify') {
            cell.title = 'Spotify Track';
        } else {
            cell.title = 'Loading...';
        }
        cell.cover = '';
    } else if (!trimmed.startsWith('song:')) {
        cell.type = 'markdown';
    }

    saveTapeState();
    renderTape();
}

/**
 * Delete a cell by ID
 * @param id - Cell ID to delete
 */
export function deleteCell(id: string): void {
    setCells(cells.filter(c => c.id !== id));
    renderTape();
    saveTapeState();
}

/**
 * Add a new cell at a specific index
 * @param index - Position to insert at
 * @param type - 'markdown' or 'song'
 */
export function addCell(index: number, type: 'markdown' | 'song' = 'markdown'): void {
    const newCell: Cell = {
        id: generateId(),
        type: type,
        content: type === 'song' ? '' : 'New Text Block',
        provider: type === 'song' ? 'other' : undefined,
        title: type === 'song' ? 'Paste a Song URL' : undefined
    };

    cells.splice(index, 0, newCell);

    // Auto-focus the new cell
    setEditingCellId(newCell.id);
    renderTape();
    saveTapeState();
}

// ============================================================================
// DRAG & DROP
// ============================================================================

let draggedItemIndex: number | null = null;

function handleDragStart(e: DragEvent, index: number): void {
    draggedItemIndex = index;
    e.dataTransfer!.effectAllowed = 'move';
}

function handleDragOver(e: DragEvent, index: number): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
}

function handleDrop(e: DragEvent, index: number): void {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    // Move the item
    const item = cells.splice(draggedItemIndex, 1)[0];
    cells.splice(index, 0, item);

    draggedItemIndex = null;
    renderTape();
    saveTapeState();
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Render the entire tape
 * Handles both view mode and edit mode rendering
 */
export function renderTape(): void {
    tapeContent.innerHTML = '';

    if (isEditMode) {
        tapeContent.classList.add('editing-mode');
    } else {
        tapeContent.classList.remove('editing-mode');
    }

    cells.forEach((cell, index) => {
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = `cell-wrapper ${isEditMode ? 'editing' : ''} ${editingCellId === cell.id ? 'cell-editing' : ''}`;
        wrapper.id = `wrapper-${cell.id}`;

        // Add bar above first cell (edit mode)
        if (isEditMode && index === 0) {
            tapeContent.appendChild(createAddBar(0));
        }

        // Edit mode: add drag and controls
        if (isEditMode) {
            wrapper.draggable = true;
            wrapper.ondragstart = (e) => handleDragStart(e, index);
            wrapper.ondragover = (e) => handleDragOver(e, index);
            wrapper.ondrop = (e) => handleDrop(e, index);

            // Controls
            const controls = createCellControls(cell);
            wrapper.appendChild(controls);

            // Double-click to edit
            wrapper.ondblclick = (e) => {
                e.stopPropagation();
                setEditingCellId(cell.id);
                renderTape();
            };
        }

        // Render cell content
        if (editingCellId === cell.id) {
            // Editing this cell
            if (cell.type === 'markdown') {
                wrapper.appendChild(createTextEditor(cell));
            } else {
                wrapper.appendChild(renderCell(cell));
                wrapper.appendChild(createSongEditor(cell));
            }
        } else {
            // Normal view
            const content = renderCell(cell);

            // Prevent song cards from interfering with drag
            if (isEditMode && cell.type === 'song') {
                content.ondragstart = (e) => e.stopPropagation();
            }

            // Click to play (view mode)
            if (!isEditMode && cell.type === 'song') {
                content.onclick = () => startPlayer(cells.indexOf(cell));
            }

            wrapper.appendChild(content);
        }

        tapeContent.appendChild(wrapper);

        // Add bar below each cell (edit mode)
        if (isEditMode) {
            tapeContent.appendChild(createAddBar(index + 1));
        }
    });

    // Show player bar if there are songs
    if (cells.some(c => c.type === 'song')) {
        playerBar.classList.remove('hidden');
    }
}

/**
 * Create cell control buttons (drag handle, delete)
 */
function createCellControls(cell: Cell): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'cell-controls';

    const dragHandle = document.createElement('button');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Drag to reorder';
    dragHandle.innerHTML = '☰';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteCell(cell.id);
    };

    controls.appendChild(dragHandle);
    controls.appendChild(deleteBtn);
    return controls;
}

/**
 * Create the hover add bar with Text/Song buttons
 */
function createAddBar(insertIndex: number): HTMLElement {
    const container = document.createElement('div');
    container.className = 'add-bar-container';

    const bar = document.createElement('div');
    bar.className = 'add-cell-bar';

    const textBtn = document.createElement('button');
    textBtn.className = 'add-cell-option';
    textBtn.innerHTML = '+ Text';
    textBtn.onclick = (e) => {
        e.stopPropagation();
        addCell(insertIndex, 'markdown');
    };

    const songBtn = document.createElement('button');
    songBtn.className = 'add-cell-option';
    songBtn.innerHTML = '+ Song';
    songBtn.onclick = (e) => {
        e.stopPropagation();
        addCell(insertIndex, 'song');
    };

    bar.appendChild(textBtn);
    bar.appendChild(songBtn);
    container.appendChild(bar);
    return container;
}

/**
 * Create textarea editor for markdown cells
 */
function createTextEditor(cell: Cell): HTMLElement {
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = cell.content;

    // Auto-resize
    const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };

    textarea.oninput = autoResize;

    // Alt+Enter to exit
    textarea.onkeydown = (e) => {
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            updateCell(cell.id, textarea.value);
            setEditingCellId(null);
            renderTape();
        }
    };

    // Blur to save
    textarea.onblur = (e: any) => {
        if (editingCellId === cell.id) {
            updateCell(cell.id, e.target.value);
            setEditingCellId(null);
        }
    };

    // Auto-focus and resize
    setTimeout(() => {
        textarea.focus();
        autoResize();
    }, 0);

    return textarea;
}

/**
 * Create input editor for song cells
 */
function createSongEditor(cell: Cell): HTMLElement {
    const input = document.createElement('input');
    input.className = 'edit-input';
    input.value = cell.content;
    input.placeholder = 'Paste Song URL (YouTube, Spotify, SoundCloud)';

    // Alt+Enter to exit
    input.onkeydown = (e) => {
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            updateCell(cell.id, input.value);
            setEditingCellId(null);
            renderTape();
        }
    };

    // Blur to save
    input.onblur = (e: any) => {
        if (editingCellId === cell.id) {
            updateCell(cell.id, e.target.value);
            setEditingCellId(null);
        }
    };

    setTimeout(() => input.focus(), 0);

    return input;
}

// ============================================================================
// MODE TOGGLES
// ============================================================================

/**
 * Toggle edit mode on/off
 */
export function toggleEditMode(): void {
    if (isRawMode) toggleRawMode();

    setIsEditMode(!isEditMode);
    setEditingCellId(null);

    if (isEditMode) {
        editBtn.classList.add('active');
        editBtn.innerHTML = '👁️';
        stopCurrentPlayer();
    } else {
        editBtn.classList.remove('active');
        editBtn.innerHTML = '✎';
    }

    renderTape();
}

/**
 * Toggle raw markdown editor on/off
 */
export function toggleRawMode(): void {
    if (isEditMode) toggleEditMode();

    setIsRawMode(!isRawMode);

    if (isRawMode) {
        rawBtn.classList.add('active');
        playerView.classList.add('hidden');
        playerBar.classList.add('hidden');
        rawView.classList.remove('hidden');

        // Populate raw editor
        tapeEditor.value = serializeCells(cells);
        stopCurrentPlayer();
    } else {
        rawBtn.classList.remove('active');
        rawView.classList.add('hidden');
        playerView.classList.remove('hidden');

        // Parse raw content back to cells
        setCells(parseTape(tapeEditor.value));
        renderTape();
        saveTapeState();

        if (cells.some(c => c.type === 'song')) {
            playerBar.classList.remove('hidden');
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Set up editor event listeners
 * Called once on app initialization
 */
export function initEditor(): void {
    // Edit mode toggle
    editBtn.onclick = toggleEditMode;

    // Raw mode toggle
    rawBtn.onclick = toggleRawMode;

    // Raw editor input
    tapeEditor.oninput = () => {
        if (isRawMode) saveRawState();
    };
}
