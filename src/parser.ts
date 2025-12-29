/**
 * @fileoverview Tape Parser - Markdown to Cells
 * 
 * This module handles parsing the raw markdown tape format into
 * a structured array of Cell objects.
 * 
 * Tape Format:
 * - Regular markdown text becomes 'markdown' cells
 * - Lines starting with "song:" followed by a URL become 'song' cells
 * - Horizontal rules (---) separate cells visually but create empty cells
 * 
 * Example:
 * ```
 * # My Playlist
 * Some description text.
 * 
 * ---
 * 
 * song: https://open.spotify.com/track/abc123
 * song: https://www.youtube.com/watch?v=xyz
 * 
 * More text here.
 * ```
 */

import { Cell, CellType } from './types';
import { SONG_PROVIDERS } from './config';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a unique ID for cells
 * Uses random alphanumeric string
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * Check if a string is a valid URL
 * @param str - String to check
 * @returns true if valid URL
 */
export function isUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch { return false; }
}

/**
 * Detect which song provider a URL belongs to
 * @param url - The song URL to check
 * @returns Provider name ('youtube', 'spotify', etc.) or 'other'
 */
export function detectProvider(url: string): Cell['provider'] {
    for (const provider of SONG_PROVIDERS) {
        if (provider.pattern.test(url)) {
            return provider.name as Cell['provider'];
        }
    }
    return 'other';
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Parse a raw markdown tape string into an array of Cells
 * 
 * Processing:
 * 1. Split by horizontal rules (---)
 * 2. Within each section, identify song: lines vs markdown
 * 3. Create appropriate Cell objects with detected providers
 * 
 * @param raw - The raw markdown tape content
 * @returns Array of Cell objects
 */
export function parseTape(raw: string): Cell[] {
    const cells: Cell[] = [];

    // Split by horizontal rules first
    const sections = raw.split(/^---$/gm);

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        const lines = trimmed.split('\n');
        let currentMarkdown = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check for song: prefix
            if (trimmedLine.startsWith('song:')) {
                // Flush any accumulated markdown
                if (currentMarkdown.trim()) {
                    cells.push({
                        id: generateId(),
                        type: 'markdown',
                        content: currentMarkdown.trim()
                    });
                    currentMarkdown = '';
                }

                // Parse song URL
                const url = trimmedLine.substring(5).trim();
                if (url) {
                    const provider = detectProvider(url);
                    cells.push({
                        id: generateId(),
                        type: 'song',
                        content: url,
                        provider,
                        title: provider === 'spotify' ? 'Spotify Track' : 'Loading...'
                    });
                }
            } else if (isUrl(trimmedLine)) {
                // Bare URL (no song: prefix)
                if (currentMarkdown.trim()) {
                    cells.push({
                        id: generateId(),
                        type: 'markdown',
                        content: currentMarkdown.trim()
                    });
                    currentMarkdown = '';
                }

                const provider = detectProvider(trimmedLine);
                cells.push({
                    id: generateId(),
                    type: 'song',
                    content: trimmedLine,
                    provider,
                    title: provider === 'spotify' ? 'Spotify Track' : 'Loading...'
                });
            } else {
                // Regular markdown line
                currentMarkdown += line + '\n';
            }
        }

        // Flush remaining markdown
        if (currentMarkdown.trim()) {
            cells.push({
                id: generateId(),
                type: 'markdown',
                content: currentMarkdown.trim()
            });
        }
    }

    return cells;
}

/**
 * Serialize cells back into markdown format
 * Used for saving to URL hash and raw editor
 * 
 * @param cells - Array of Cell objects
 * @returns Markdown string representation
 */
export function serializeCells(cells: Cell[]): string {
    return cells.map(cell => {
        if (cell.type === 'song') {
            return `song: ${cell.content}`;
        }
        return cell.content;
    }).join('\n\n---\n\n');
}
