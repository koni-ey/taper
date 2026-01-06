<script lang="ts">
    let { onAdd } = $props<{ onAdd: (type: "markdown" | "song") => void }>();
</script>

<div class="group relative h-4 -my-2 flex items-center justify-center z-10">
    <!-- Hover Hit Area (Invisible but expands) -->
    <div
        class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 group-hover:h-12 w-full z-10 cursor-pointer"
    ></div>

    <!-- Visual Line -->
    <div
        class="absolute inset-x-0 h-px bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
    ></div>

    <!-- Buttons Container (Absolute to avoid flow) -->
    <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 flex gap-2 pointer-events-none group-hover:pointer-events-auto z-20"
    >
        <button
            class="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-white hover:bg-black hover:text-white rounded-full transition-colors shadow-sm border border-gray-200"
            onclick={() => onAdd("markdown")}
        >
            + Text
        </button>
        <button
            class="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-white hover:bg-black hover:text-white rounded-full transition-colors shadow-sm border border-gray-200"
            onclick={() => onAdd("song")}
        >
            + Song
        </button>
    </div>
</div>
