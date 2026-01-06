import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from './config';
import { appState } from './state.svelte';

function generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

export async function checkAuthCallback(): Promise<string | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
        const token = localStorage.getItem('spotify_access_token');
        if (token) {
            appState.spotify.token = token;
        }
        return null;
    }

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
            appState.spotify.token = data.access_token;
            localStorage.setItem('spotify_access_token', data.access_token);
            localStorage.removeItem('pkce_code_verifier');

            const savedTapeState = localStorage.getItem('pre_auth_tape_state');
            localStorage.removeItem('pre_auth_tape_state');

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

export async function loginToSpotify(): Promise<void> {
    const currentHash = window.location.hash.substring(1);
    if (currentHash) {
        localStorage.setItem('pre_auth_tape_state', currentHash);
    }

    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('pkce_code_verifier', codeVerifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        scope: SPOTIFY_SCOPES.join(' ')
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function logoutSpotify(): void {
    localStorage.removeItem('spotify_access_token');
    appState.spotify.token = null;
    appState.spotify.player = null;
    appState.spotify.deviceId = null;
    appState.spotify.isReady = false;

    window.location.hash = '';
    window.location.reload();
}
