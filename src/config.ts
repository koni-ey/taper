/**
 * @fileoverview Configuration constants for Taper
 * 
 * This module contains all configuration values used throughout the app:
 * - Spotify OAuth credentials and scopes
 * - Song provider detection patterns
 */

// ============================================================================
// SPOTIFY CONFIGURATION
// ============================================================================

/**
 * Spotify Developer App Client ID
 * Get yours at: https://developer.spotify.com/dashboard
 */
export const SPOTIFY_CLIENT_ID = '89be7a454358415ab1effc7dee2cf452';

/**
 * OAuth Redirect URI - Must match exactly what's registered in Spotify Dashboard
 * Note: Spotify requires 127.0.0.1, not "localhost"
 */
export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3000';

/**
 * Required Spotify API scopes for playback control
 */
export const SPOTIFY_SCOPES = [
    'streaming',              // Web Playback SDK
    'user-read-email',        // User profile access
    'user-read-private',      // User profile access
    'user-modify-playback-state',  // Play/pause/seek control
    'user-read-playback-state'     // Current playback info
];

// ============================================================================
// SONG PROVIDER PATTERNS
// ============================================================================

/**
 * Patterns to detect and extract song URLs from various providers.
 * Each provider has:
 * - name: Identifier used throughout the app
 * - pattern: Regex to match and extract IDs from URLs
 * - type: 'embed' for iframe players, 'audio' for HTML5 audio
 */
export const SONG_PROVIDERS = [
    {
        name: 'youtube',
        pattern: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
        type: 'embed'
    },
    {
        name: 'soundcloud',
        pattern: /soundcloud\.com\/[\w-]+\/[\w-]+/,
        type: 'embed'
    },
    {
        name: 'spotify',
        // Supports international URLs like open.spotify.com/intl-de/track/...
        pattern: /(?:open\.spotify\.com\/(?:intl-[\w]+\/)?track\/|spotify:track:)([\w]+)/,
        type: 'embed'
    },
    {
        name: 'mp3',
        pattern: /\.mp3$/,
        type: 'audio'
    }
] as const;

/**
 * Provider name type derived from SONG_PROVIDERS
 */
export type ProviderName = typeof SONG_PROVIDERS[number]['name'] | 'other';
