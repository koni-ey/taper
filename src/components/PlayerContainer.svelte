<script lang="ts">
    import { onMount } from 'svelte';
    import { setPlayerContainer } from '../lib/players';

    let container: HTMLElement;

    onMount(() => {
        if (container) {
            setPlayerContainer(container);
        }
    });
</script>

<div bind:this={container} class="hidden-embed fixed bottom-0 right-0 w-1 h-1 opacity-0 pointer-events-none -z-10">
    <!-- Players will be injected here -->
</div>
