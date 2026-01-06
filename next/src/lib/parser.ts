import type { Cell } from './types';
import { SONG_PROVIDERS } from './config';

export function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

export function isUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch { return false; }
}

export function detectProvider(url: string): Cell['provider'] {
    for (const provider of SONG_PROVIDERS) {
        if (provider.pattern.test(url)) {
            return provider.name as Cell['provider'];
        }
    }
    return 'other';
}

export function parseTape(raw: string): Cell[] {
    const cells: Cell[] = [];
    const sections = raw.split(/^---$/gm);

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        const lines = trimmed.split('\n');
        let currentMarkdown = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

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
            } else if (isUrl(trimmedLine)) {
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

export function serializeCells(cells: Cell[]): string {
    return cells.map(cell => {
        if (cell.type === 'song') {
            return `song: ${cell.content}`;
        }
        return cell.content;
    }).join('\n\n---\n\n');
}
