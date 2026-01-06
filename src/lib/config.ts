export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
export const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

export const SPOTIFY_SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state'
];

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
        pattern: /(?:open\.spotify\.com\/(?:intl-[\w]+\/)?track\/|spotify:track:)([\w]+)/,
        type: 'embed'
    },
    {
        name: 'mp3',
        pattern: /\.mp3$/,
        type: 'audio'
    }
] as const;

export type ProviderName = typeof SONG_PROVIDERS[number]['name'] | 'other';
