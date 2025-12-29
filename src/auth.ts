/**
 * @fileoverview Spotify Authentication using PKCE
 * 
 * This module handles all Spotify OAuth authentication using the
 * PKCE (Proof Key for Code Exchange) flow, which is required for
 * public client applications without a backend secret.
 * 
 * Flow:
 * 1. User clicks "Connect Spotify" → loginToSpotify() generates PKCE challenge
 * 2. User authorizes on Spotify → redirected back with ?code= parameter
 * 3. checkAuthCallback() exchanges code for access token
 * 4. Token stored in localStorage for SDK use
 * 
 * @see https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from './config';

// ============================================================================
// MODULE STATE
// ============================================================================

/** Current Spotify access token (null if not authenticated) */
export let spotifyToken: string | null = null;

/** Spotify SDK Player instance (initialized after authentication) */
export let spotifyPlayer: any = null;

/** Spotify device ID for playback control */
export let spotifyDeviceId: string | null = null;

/** Flag indicating SDK is ready */
export let spotifySdkReady = false;

// State setters (for use by other modules)
export function setSpotifyToken(token: string | null) { spotifyToken = token; }
export function setSpotifyPlayer(player: any) { spotifyPlayer = player; }
export function setSpotifyDeviceId(id: string | null) { spotifyDeviceId = id; }
export function setSpotifySdkReady(ready: boolean) { spotifySdkReady = ready; }

// ============================================================================
// PKCE HELPERS
// ============================================================================

/**
 * Generate a cryptographically random string for PKCE
 * @param length - Desired length of the random string
 * @returns Random alphanumeric string
 */
function generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

/**
 * Generate PKCE code challenge from code verifier
 * Uses SHA-256 hash, base64url encoded
 * @param codeVerifier - The random code verifier string
 * @returns Promise resolving to the code challenge
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

// ============================================================================
// AUTH FLOW
// ============================================================================

/**
 * Check if we're returning from Spotify OAuth callback.
 * Exchanges authorization code for access token using PKCE.
 * 
 * @returns Promise<string | null> - The tape hash to restore, or null
 */
export async function checkAuthCallback(): Promise<string | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Not a callback - check for existing token
    if (!code) {
        spotifyToken = localStorage.getItem('spotify_access_token');
        return null;
    }

    // Exchange code for token
    const codeVerifier = localStorage.getItem('pkce_code_verifier');
    if (!codeVerifier) {
        console.error('PKCE verifier not found');
        return null;
    }

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: SPOTIFY_CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: SPOTIFY_REDIRECT_URI,
                code_verifier: codeVerifier
            })
        });

        const data = await response.json();

        if (data.access_token) {
            spotifyToken = data.access_token;
            localStorage.setItem('spotify_access_token', data.access_token);
            localStorage.removeItem('pkce_code_verifier');

            // Restore tape state that was saved before auth redirect
            const savedTapeState = localStorage.getItem('pre_auth_tape_state');
            localStorage.removeItem('pre_auth_tape_state');

            // Clean URL (remove ?code=...)
            window.history.replaceState({}, document.title, window.location.pathname);

            return savedTapeState;
        } else {
            console.error('Token exchange failed:', data);
        }
    } catch (error) {
        console.error('Auth callback error:', error);
    }

    return null;
}

/**
 * Initiate Spotify login flow with PKCE
 * Saves current tape state and redirects to Spotify authorization
 */
export async function loginToSpotify(): Promise<void> {
    // Save current tape state to restore after auth
    const currentHash = window.location.hash.substring(1);
    if (currentHash) {
        localStorage.setItem('pre_auth_tape_state', currentHash);
    }

    // Generate PKCE verifier and challenge
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('pkce_code_verifier', codeVerifier);

    // Build authorization URL
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        scope: SPOTIFY_SCOPES.join(' ')
    });

    // Redirect to Spotify
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Log out from Spotify
 * Clears stored tokens and reloads the page
 */
export function logoutSpotify(): void {
    localStorage.removeItem('spotify_access_token');
    spotifyToken = null;
    spotifyPlayer = null;
    spotifyDeviceId = null;
    spotifySdkReady = false;

    // Clear URL and reload
    window.location.hash = '';
    window.location.reload();
}
