<script lang="ts">
    import { marked } from "marked";
    import type { Cell } from "../lib/types";
    import { appState } from "../lib/state.svelte";
    import { startPlayer, togglePlayPause } from "../lib/playback";
    import { fetchMetadata } from "../lib/metadata";
    import { Play, Pause, Trash2, ExternalLink } from "lucide-svelte";

    let {
        cell,
        index,
        isEditing = false,
        onDelete,
        onEditStart,
        onEditEnd,
    } = $props<{
        cell: Cell;
        index: number;
        isEditing?: boolean;
        onDelete: () => void;
        onEditStart: () => void;
        onEditEnd: () => void;
    }>();

    let editContent = $state(cell.content);

    let isCurrent = $derived(appState.currentIndex === index);
    let isPlaying = $derived(isCurrent && appState.isPlaying);
    let isSpotifyDisabled = $derived(
        cell.provider === "spotify" && !appState.spotify.token,
    );

    $effect(() => {
        if (!isEditing) {
            editContent = cell.content;
        } else {
            // Focus textarea when entering edit mode?
            // Handled via autofocus on element currently
        }
    });

    function handlePlay() {
        if (isSpotifyDisabled) return;

        if (isCurrent) {
            togglePlayPause();
        } else {
            startPlayer(index);
        }
    }

    function save() {
        const idx = appState.cells.findIndex((c) => c.id === cell.id);
        if (idx !== -1) {
            appState.cells[idx].content = editContent;
            // Re-fetch metadata if it's a song
            if (appState.cells[idx].type === "song") {
                appState.cells[idx].title = "Loading...";
                fetchMetadata(appState.cells[idx]);
            }
        }
        onEditEnd();
    }

    function cancel() {
        editContent = cell.content;
        onEditEnd();
    }

    // Svelte action for autoresizing textarea
    function autoresize(node: HTMLTextAreaElement) {
        function resize() {
            node.style.height = "auto";
            node.style.height = node.scrollHeight + "px";
        }
        node.addEventListener("input", resize);
        // Initial resize in case content is pre-filled
        // Use a timeout to ensure it runs after initial render
        setTimeout(resize, 0);
        return {
            destroy() {
                node.removeEventListener("input", resize);
            },
        };
    }
</script>

<div
    class="group relative mb-1 hover:bg-gray-50/50 p-2 -mx-2 rounded transition-colors duration-200"
    ondblclick={() => {
        if (!isEditing) onEditStart();
    }}
>
    <div class="relative">
        <!-- Content -->
        <div>
            {#if isEditing}
                <div class="flex flex-col gap-2">
                    {#if cell.type === "song"}
                        <!-- Distinct Song Input -->
                        <div class="relative">
                            <div
                                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"
                            >
                                🎵
                            </div>
                            <input
                                bind:value={editContent}
                                class="w-full pl-10 pr-3 py-3 border border-black rounded font-mono text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black shadow-sm"
                                placeholder="Paste Song URL (YouTube, Spotify, SoundCloud)..."
                                autofocus
                                onblur={save}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        save();
                                    }
                                }}
                            />
                        </div>
                    {:else}
                        <!-- Auto-resize Text Area -->
                        <textarea
                            bind:value={editContent}
                            class="w-full p-3 border border-black rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-black shadow-sm overflow-hidden resize-none"
                            style="min-height: 100px;"
                            use:autoresize
                            autofocus
                            onblur={save}
                            onkeydown={(e) => {
                                if (e.key === "Enter" && e.altKey) {
                                    save();
                                }
                            }}
                        ></textarea>
                    {/if}
                    <!-- Delete button in edit mode -->
                    <button
                        class="self-start flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        onclick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            {:else if cell.type === "markdown"}
                <div
                    class="prose prose-slate max-w-none prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1 prose-h1:text-2xl prose-h2:text-xl prose-img:rounded-lg [&>:first-child]:mt-0 [&>:last-child]:mb-0"
                >
                    {@html marked.parse(cell.content)}
                </div>
            {:else}
                <!-- Song Card -->
                <div
                    class="group flex items-center gap-4 p-4 border border-border rounded-xl bg-white transition-all duration-300 cursor-pointer relative
                            {isCurrent
                        ? 'border-green-500 ring-1 ring-green-500/50 shadow-md scale-[1.01] bg-green-50/10'
                        : 'hover:border-gray-300 hover:shadow-sm'}
                            {isSpotifyDisabled ? 'grayscale opacity-60' : ''}"
                    onclick={handlePlay}
                >
                    {#if isSpotifyDisabled}
                        <div
                            class="absolute inset-0 z-20 bg-gray-100/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"
                        >
                            <span
                                class="text-xs font-bold uppercase tracking-widest text-gray-800"
                                >Connect Spotify to play</span
                            >
                        </div>
                    {/if}

                    <!-- Cover -->
                    <div
                        class="w-16 h-16 bg-gray-100 border border-gray-200 rounded-lg flex-shrink-0 bg-cover bg-center relative overflow-hidden group/cover"
                        style="background-image: url({cell.cover || ''})"
                    >
                        <div
                            class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 {isPlaying
                                ? 'opacity-100'
                                : ''} transition-opacity duration-200"
                        >
                            {#if isPlaying}
                                <Pause
                                    size={20}
                                    class="text-white drop-shadow-md"
                                />
                            {:else}
                                <Play
                                    size={20}
                                    class="text-white drop-shadow-md pl-1"
                                />
                            {/if}
                        </div>
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                        <div
                            class="font-bold text-base truncate text-gray-900 leading-tight mb-1"
                        >
                            {cell.title || "Loading..."}
                        </div>
                        <div
                            class="text-xs text-gray-500 uppercase tracking-widest flex items-center gap-2 font-medium"
                        >
                            {#if cell.provider === "spotify"}
                                <span class="text-[#1DB954]">Spotify</span>
                            {:else if cell.provider === "youtube"}
                                <span class="text-[#FF0000]">YouTube</span>
                            {:else if cell.provider === "soundcloud"}
                                <span class="text-[#FF5500]">SoundCloud</span>
                            {:else}
                                <span>{cell.provider}</span>
                            {/if}

                            <a
                                href={cell.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-gray-400 hover:text-black transition-colors"
                                onclick={(e) => e.stopPropagation()}
                                title="Open in new tab"
                            >
                                <ExternalLink size={12} />
                            </a>

                            <span class="opacity-30">•</span>
                            <span
                                class="truncate opacity-50 font-mono text-[10px]"
                                >{cell.content}</span
                            >
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>
