<script lang="ts">
    import Tape from './components/Tape.svelte';
    import PlayerBar from './components/PlayerBar.svelte';
    import PlayerContainer from './components/PlayerContainer.svelte';
    import { onMount } from 'svelte';
    import { initSpotifySdkPlayer, preInitializePlayers } from './lib/players';
    import { appState } from './lib/state.svelte';

    onMount(() => {
        // Load external scripts
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

        // Global callbacks
        (window as any).onYouTubeIframeAPIReady = () => {
            appState.setYoutubeApiReady(true);
            preInitializePlayers();
        };

        (window as any).onSpotifyWebPlaybackSDKReady = () => {
            initSpotifySdkPlayer();
        };

        // Mobile audio context unlocker
        const unlockAudio = () => {
            const audio = new Audio();
            audio.play().then(() => {
                audio.pause();
            }).catch(() => {
                // Ignore errors if context was already unlocked or blocked
            });
            
            // Remove listeners once triggered
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('click', unlockAudio);
        };
        
        document.addEventListener('touchstart', unlockAudio, { once: true });
        document.addEventListener('click', unlockAudio, { once: true });
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