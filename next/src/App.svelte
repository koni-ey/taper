<script lang="ts">
    import Tape from './components/Tape.svelte';
    import PlayerBar from './components/PlayerBar.svelte';
    import PlayerContainer from './components/PlayerContainer.svelte';
    import { onMount } from 'svelte';
    import { initSpotifySdkPlayer } from './lib/players';
    import { appState } from './lib/state.svelte';

    onMount(() => {
        // Load external scripts
        const yt = document.createElement('script');
        yt.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(yt);

        const sc = document.createElement('script');
        sc.src = 'https://w.soundcloud.com/player/api.js';
        document.body.appendChild(sc);

        const sp = document.createElement('script');
        sp.src = 'https://sdk.scdn.co/spotify-player.js';
        document.body.appendChild(sp);

        // Global callbacks
        (window as any).onYouTubeIframeAPIReady = () => {
            appState.setYoutubeApiReady(true);
        };

        (window as any).onSpotifyWebPlaybackSDKReady = () => {
            initSpotifySdkPlayer();
        };
    });
</script>

<main class="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
    <Tape />
    <PlayerBar />
    <PlayerContainer />
</main>