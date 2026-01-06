/**
 * Parser and Serializer for Taper's markdown format.
 * Taper format is a series of blocks separated by '---'.
 * Song URLs are identified by specific patterns or the 'song:' prefix.
 */

import type { Cell } from './types';
import { SONG_PROVIDERS } from './config';

/**
 * Generates a short unique identifier for cells.
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * Validates if a string is a valid URL.
 */
export function isUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch { return false; }
}

/**
 * Detects the music provider (Spotify, YouTube, SoundCloud) based on URL patterns.
 */
export function detectProvider(url: string): Cell['provider'] {
    for (const provider of SONG_PROVIDERS) {
        if (provider.pattern.test(url)) {
            return provider.name as Cell['provider'];
        }
    }
    return 'other';
}

/**
 * Parses a raw Taper string into an array of Cells.
 * Separates content by '---' and identifies song URLs.
 */
export function parseTape(raw: string): Cell[] {
    const cells: Cell[] = [];
    // Split by horizontal rule separator
    const sections = raw.split(/^---$/gm);

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        const lines = trimmed.split('\n');
        let currentMarkdown = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check for explicit song: prefix
            if (trimmedLine.startsWith('song:')) {
                if (currentMarkdown.trim()) {
                    cells.push({
                        id: generateId(),
                        type: 'markdown',
                        content: currentMarkdown.trim()
                    });
                    currentMarkdown = '';
                }

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
            } 
            // Check for implicit song URLs (lines that are just a URL)
            else if (isUrl(trimmedLine)) {
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
                currentMarkdown += line + '\n';
            }
        }

        // Add remaining markdown
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
 * Serializes an array of Cells back into a Taper markdown string.
 */
export function serializeCells(cells: Cell[]): string {
    return cells.map(cell => {
        if (cell.type === 'song') {
            return `song: ${cell.content}`;
        }
        return cell.content;
    }).join('\n\n---\n\n');
}