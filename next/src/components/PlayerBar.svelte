<script lang="ts">
    import { appState } from '../lib/state.svelte';
    import { togglePlayPause, playNext, playPrev, seekTo } from '../lib/playback';
    import { Play, Pause, SkipBack, SkipForward } from 'lucide-svelte';
    
    // Derived state
    let isVisible = $derived(appState.cells.some(c => c.type === 'song'));
    let currentCell = $derived(appState.currentIndex >= 0 ? appState.cells[appState.currentIndex] : null);
    
    function formatTime(seconds: number) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function handleSeek(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const time = parseFloat(input.value);
        seekTo(time);
    }
</script>

{#if isVisible}
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 pb-6 transition-transform duration-300 z-50">
        <div class="max-w-2xl mx-auto flex flex-col gap-3">
            
            <!-- Song Info -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 overflow-hidden">
                    {#if currentCell}
                        <div class="w-12 h-12 bg-gray-100 rounded flex-shrink-0 bg-cover bg-center" 
                             style="background-image: url({currentCell.cover || ''})">
                        </div>
                        <div class="truncate">
                            <div class="font-bold truncate">{currentCell.title || 'Select a song'}</div>
                            <div class="text-xs text-gray-500 uppercase">{currentCell.provider || 'Ready'}</div>
                        </div>
                    {:else}
                         <div class="text-gray-500">Ready to play</div>
                    {/if}
                </div>

                <!-- Controls -->
                <div class="flex items-center gap-4">
                    <button class="text-gray-600 hover:text-black" onclick={playPrev}>
                        <SkipBack size={24} />
                    </button>
                    
                    <button class="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center hover:scale-105 transition-transform"
                            onclick={togglePlayPause}>
                        {#if appState.isPlaying}
                            <Pause size={24} />
                        {:else}
                            <Play size={24} class="ml-1" />
                        {/if}
                    </button>
                    
                    <button class="text-gray-600 hover:text-black" onclick={playNext}>
                        <SkipForward size={24} />
                    </button>
                </div>
            </div>

            <!-- Progress -->
            <div class="flex items-center gap-3 text-xs text-gray-500 font-mono">
                <span class="w-10 text-right">{formatTime(appState.progress.current)}</span>
                
                <div class="relative flex-1 h-4 flex items-center group">
                    <input 
                        type="range"
                        min="0"
                        max={appState.progress.total || 100}
                        value={appState.progress.current}
                        oninput={handleSeek}
                        class="absolute w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-black transition-all duration-100"
                             style="width: {(appState.progress.current / (appState.progress.total || 1)) * 100}%">
                        </div>
                    </div>
                </div>

                <span class="w-10">{formatTime(appState.progress.total)}</span>
            </div>
        </div>
    </div>
{/if}