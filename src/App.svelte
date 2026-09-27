<script lang="ts">
    import Tape from './components/Tape.svelte';
    import PlayerBar from './components/PlayerBar.svelte';
    import PlayerContainer from './components/PlayerContainer.svelte';
    import { onMount } from 'svelte';
    import { initSpotifySdkPlayer, preInitializePlayers } from './lib/players';
    import { appState } from './lib/state.svelte';
    import { syncPlaybackOnReturn } from './lib/playback';

    onMount(() => {
        // Load external scripts
        (window as any).onYouTubeIframeAPIReady = () => {
            appState.setYoutubeApiReady(true);
            window.dispatchEvent(new Event('taper-youtube-ready'));
            preInitializePlayers();
        };

        (window as any).onSpotifyWebPlaybackSDKReady = () => {
            initSpotifySdkPlayer();
        };

        const yt = document.createElement('script');
        yt.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(yt);

        const sc = document.createElement('script');
        sc.src = 'https://w.soundcloud.com/player/api.js';
        // Once the SoundCloud Widget API is available, eagerly create the widget
        // instances. This guarantees the player exists before the user's first tap
        // so playback can be started synchronously inside the gesture (mobile).
        sc.onload = () => preInitializePlayers();
        document.body.appendChild(sc);

        const sp = document.createElement('script');
        sp.src = 'https://sdk.scdn.co/spotify-player.js';
        document.body.appendChild(sp);

        document.addEventListener('visibilitychange', syncPlaybackOnReturn);
        window.addEventListener('pageshow', syncPlaybackOnReturn);
        return () => {
            document.removeEventListener('visibilitychange', syncPlaybackOnReturn);
            window.removeEventListener('pageshow', syncPlaybackOnReturn);
        };

    });

    $effect(() => {
        if (appState.spotify.token) {
            // @ts-ignore
            if (window.Spotify) {
                initSpotifySdkPlayer();
            }
        }
    });
</script>

<main class="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
    <Tape />
    <PlayerBar />
    <PlayerContainer />
</main>
