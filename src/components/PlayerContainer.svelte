<script lang="ts">
    import { onMount } from 'svelte';
    import { setPlayerContainer } from '../lib/players';
    import { appState } from '../lib/state.svelte';

    let container: HTMLElement;
    let currentCell = $derived(appState.cells[appState.currentIndex]);

    function showCurrentEmbed() {
        if (!container) return;
        const activeId = currentCell?.provider === 'youtube' ? `yt-player-${currentCell.id}`
            : currentCell?.provider === 'soundcloud' ? `sc-player-${currentCell.id}` : '';
        for (const child of container.children) {
            (child as HTMLElement).style.display = child.id === activeId ? '' : 'none';
        }
    }

    onMount(() => {
        if (container) {
            setPlayerContainer(container);
            const observer = new MutationObserver(showCurrentEmbed);
            observer.observe(container, { childList: true });
            return () => observer.disconnect();
        }
    });

    $effect(() => {
        currentCell;
        showCurrentEmbed();
    });
</script>

<!-- Visible, tappable embeds let iOS users start the actual player when API playback is blocked. -->
<div bind:this={container} class="fixed bottom-40 right-2 w-[200px] h-[200px] z-40 rounded-lg overflow-hidden shadow-lg"
     class:invisible={currentCell?.provider !== 'youtube' && currentCell?.provider !== 'soundcloud'}
     class:pointer-events-none={currentCell?.provider !== 'youtube' && currentCell?.provider !== 'soundcloud'}>
    <!-- Players will be injected here -->
</div>
