<script lang="ts">
    import { onMount } from "svelte";
    import { appState } from "../lib/state.svelte";
    import { parseTape, serializeCells, generateId } from "../lib/parser";
    import CellComponent from "./Cell.svelte";
    import AddBar from "./AddBar.svelte";
    import {
        loginToSpotify,
        checkAuthCallback,
        logoutSpotify,
    } from "../lib/auth";
    import { fetchAllMetadata } from "../lib/metadata";

    const DEFAULT_TAPE = `song: https://www.youtube.com/watch?v=giF04C6cMHE

---

song: https://open.spotify.com/intl-de/track/2dje3ZBu1j1r0QfR7mtS0l?si=ddc9eb0165464ef1

---

Servus ;)

---

song: https://soundcloud.com/manndarin/leafar-legov-higher-power-1?in=manndarin/sets/various-2025-giegling

---

# Taper Demo 🎵

Create playlists by mixing text and song links.

---

Double-click any cell to edit it.`;

    onMount(async () => {
        // Auth check
        const savedHash = await checkAuthCallback();

        let hash = savedHash || window.location.hash.substring(1);

        if (hash) {
            try {
                const decoded = decodeURIComponent(escape(atob(hash)));
                appState.setCells(parseTape(decoded));
            } catch (e) {
                console.error(e);
                appState.setCells(parseTape(DEFAULT_TAPE));
            }
        } else {
            appState.setCells(parseTape(DEFAULT_TAPE));
        }

        // Fetch metadata for all songs
        fetchAllMetadata();
    });

    // Update hash when cells change
    $effect(() => {
        if (appState.cells.length > 0) {
            const serialized = serializeCells(appState.cells);
            const encoded = btoa(unescape(encodeURIComponent(serialized)));
            // Update hash without scrolling
            window.history.replaceState(null, "", "#" + encoded);
        }
    });

    // --- State & Operations ---

    let editingId = $state<string | null>(null);
    let isRawMode = $state(false);
    let rawContent = $state("");

    function addCell(index: number, type: "markdown" | "song") {
        const newCell = {
            id: generateId(),
            type,
            content: type === "song" ? "" : "New Text Block",
            provider: type === "song" ? "other" : undefined,
            title: type === "song" ? "Paste a Song URL" : undefined,
        };

        const newCells = [...appState.cells];
        newCells.splice(index, 0, newCell as any);
        appState.setCells(newCells);

        // Auto-edit new cell
        editingId = newCell.id;
    }

    function deleteCell(id: string) {
        appState.setCells(appState.cells.filter((c) => c.id !== id));
    }

    function toggleRawMode() {
        isRawMode = !isRawMode;
        if (isRawMode) {
            rawContent = serializeCells(appState.cells);
        } else {
            try {
                appState.setCells(parseTape(rawContent));
                fetchAllMetadata();
            } catch (e) {
                console.error("Failed to parse raw content", e);
            }
        }
    }

    // --- Drag and Drop ---

    let draggedIndex = $state<number | null>(null);
    let dragOverIndex = $state<number | null>(null);

    function handleDragStart(e: DragEvent, index: number) {
        draggedIndex = index;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", index.toString());
        }
    }

    function handleDragOver(e: DragEvent, index: number) {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }
        dragOverIndex = index;
    }

    function handleDragLeave(e: DragEvent) {
        // distinct from dragEnd, helpful for flickering prevention if needed
    }

    function handleDrop(e: DragEvent, index: number) {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) {
            dragOverIndex = null;
            return;
        }

        const newCells = [...appState.cells];
        const [movedItem] = newCells.splice(draggedIndex, 1);
        newCells.splice(index, 0, movedItem);

        appState.setCells(newCells);
        draggedIndex = null;
        dragOverIndex = null;
    }
</script>

<div class="max-w-2xl mx-auto px-4 py-12 pb-32">
    <!-- Header / Controls -->
    <div
        class="flex justify-between items-center mb-8 opacity-50 hover:opacity-100 transition-opacity"
    >
        <h1 class="font-bold tracking-widest uppercase text-xs">
            Taper / Playlist
        </h1>

        <div class="flex gap-4 items-center">
            <button
                class="text-xs uppercase font-bold hover:text-black transition-colors {isRawMode
                    ? 'text-black underline'
                    : ''}"
                onclick={toggleRawMode}
            >
                {isRawMode ? "Done" : "Raw Mode"}
            </button>

            <button
                class="text-xs uppercase font-bold hover:text-green-600 transition-colors"
                onclick={() =>
                    appState.spotify.token ? logoutSpotify() : loginToSpotify()}
            >
                {appState.spotify.token
                    ? "🟢 Spotify Connected"
                    : "🔗 Connect Spotify"}
            </button>
        </div>
    </div>

    {#if isRawMode}
        <textarea
            bind:value={rawContent}
            class="w-full h-[60vh] font-mono text-sm p-4 border rounded resize-none focus:outline-none focus:border-black transition-colors"
            placeholder="Edit your tape in raw markdown..."
        ></textarea>
    {:else}
        <!-- Drop zone for first position -->
        <div
            class="relative h-4"
            ondragover={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== 0) {
                    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                    dragOverIndex = -1; // Special: before first
                }
            }}
            ondrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex > 0) {
                    const newCells = [...appState.cells];
                    const [movedItem] = newCells.splice(draggedIndex, 1);
                    newCells.splice(0, 0, movedItem);
                    appState.setCells(newCells);
                }
                draggedIndex = null;
                dragOverIndex = null;
            }}
        >
            {#if draggedIndex !== null && dragOverIndex === -1}
                <div
                    class="absolute inset-x-0 top-0 h-20 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-medium animate-pulse"
                >
                    Place here
                </div>
            {/if}
        </div>

        <!-- Top Add Bar -->
        <AddBar onAdd={(type) => addCell(0, type)} />

        <!-- Cells -->
        {#each appState.cells as cell, i (cell.id)}
            <!-- Placeholder BEFORE if dragging UP -->
            {#if draggedIndex !== null && dragOverIndex === i && draggedIndex > i}
                <div
                    class="h-20 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 my-2 flex items-center justify-center text-gray-400 text-sm font-medium animate-pulse"
                >
                    Place here
                </div>
            {/if}

            <div
                role="listitem"
                draggable={true}
                ondragstart={(e) => handleDragStart(e, i)}
                ondragover={(e) => handleDragOver(e, i)}
                ondrop={(e) => handleDrop(e, i)}
                ondragend={() => {
                    draggedIndex = null;
                    dragOverIndex = null;
                }}
                ondragleave={handleDragLeave}
                class="relative transition-all duration-200 cursor-grab active:cursor-grabbing"
                class:opacity-50={draggedIndex === i}
            >
                <CellComponent
                    {cell}
                    index={i}
                    isEditing={editingId === cell.id}
                    onDelete={() => deleteCell(cell.id)}
                    onEditStart={() => (editingId = cell.id)}
                    onEditEnd={() => (editingId = null)}
                />
            </div>

            <!-- Placeholder AFTER if dragging DOWN -->
            {#if draggedIndex !== null && dragOverIndex === i && draggedIndex < i}
                <div
                    class="h-20 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 my-2 flex items-center justify-center text-gray-400 text-sm font-medium animate-pulse"
                >
                    Place here
                </div>
            {/if}

            <!-- Add Bar below each cell -->
            <AddBar onAdd={(type) => addCell(i + 1, type)} />
        {/each}

        <!-- Drop zone for last position -->
        <div
            class="relative h-8"
            ondragover={(e) => {
                e.preventDefault();
                if (
                    draggedIndex !== null &&
                    draggedIndex !== appState.cells.length - 1
                ) {
                    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                    dragOverIndex = -2; // Special: after last
                }
            }}
            ondrop={(e) => {
                e.preventDefault();
                if (
                    draggedIndex !== null &&
                    draggedIndex < appState.cells.length - 1
                ) {
                    const newCells = [...appState.cells];
                    const [movedItem] = newCells.splice(draggedIndex, 1);
                    newCells.push(movedItem);
                    appState.setCells(newCells);
                }
                draggedIndex = null;
                dragOverIndex = null;
            }}
        >
            {#if draggedIndex !== null && dragOverIndex === -2}
                <div
                    class="absolute inset-x-0 top-0 h-20 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-medium animate-pulse"
                >
                    Place here
                </div>
            {/if}
        </div>

        <!-- Empty State -->
        {#if appState.cells.length === 0}
            <div class="text-center py-12 text-gray-400">
                Tape is empty. Use the buttons above to add content.
            </div>
        {/if}
    {/if}
</div>
