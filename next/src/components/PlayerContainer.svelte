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

<div bind:this={container} class="hidden-embed fixed top-[-9999px] left-[-9999px] w-0 h-0 overflow-hidden">
    <!-- Players will be injected here -->
</div>
