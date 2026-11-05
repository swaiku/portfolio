<script lang="ts">
    import { onMount } from "svelte";
    import type { Uniforms } from "../lib/planet/uniforms";
    import { probe, quality, setTier } from "../lib/planet/quality.svelte";
    import { sim } from "../lib/planet/sim.svelte";
    import { track } from "../lib/track";

    // filled by the viewport once it is loaded; only the debug panel reads it here
    let u = $state<Uniforms>();
    // ?debug opens a tweak panel; loaded on demand so it stays out of the normal bundle
    let debug = $state(false);

    // WebGPU first (TSL compiles to WGSL), WebGL2 when there is no real adapter; ?gl forces the WebGL2 backend.
    let backend: "pending" | "gpu" | "gl" = $state("pending");
    // three.js and the scene are most of the page's weight: fetched only once a usable GPU is found

    onMount(async () => {
        const params = new URLSearchParams(location.search);
        // WebGPU first; a software adapter would crawl, so WebGL2 is the better fallback there
        const adapter = params.has("gl")
            ? null
            : await navigator.gpu?.requestAdapter?.().catch(() => null);
        const gpu = !!adapter && !adapter.isFallbackAdapter;
        const tier = probe(gpu);
        setTier(tier);
        track("render", { backend: tier === "off" ? "none" : gpu ? "webgpu" : "webgl2", tier });
        if (tier === "off") {
            // no usable GPU: the CSS planet stands in, nothing heavy is mounted
            document.documentElement.dataset.gl = "off";
            sim.state = "NO-GL";
            return;
        }
        backend = gpu ? "gpu" : "gl";
        debug = params.has("debug");
    });
</script>

<div class="planet-host" aria-hidden="true">
    <div class="planet-fallback"></div>
    {#if backend !== "pending" && quality.tier !== "off"}
        {#await import("./planet/Viewport.svelte") then m}
            <m.default {backend} bind:u />
        {/await}
    {/if}
</div>

{#if debug && u}
    {#await import("./Debug.svelte") then m}
        <m.default {u} />
    {/await}
{/if}


<style>
    .planet-host {
        position: fixed;
        inset: 0;
        z-index: 0;
        background: #03040c;
    }
    .planet-fallback {
        display: none;
        position: absolute;
        /* the page may aim it with --lens-*; otherwise it sits right of centre */
        left: var(--lens-l, auto);
        right: var(--lens-r, -12vmin);
        top: var(--lens-t, 12vh);
        width: var(--lens-d, 80vmin);
        height: var(--lens-d, 80vmin);
        border-radius: 50%;
        background: radial-gradient(
            circle at 28% 32%,
            #4f86c0 0%,
            #1d4a7e 38%,
            #0a1b3a 66%,
            #040816 100%
        );
        box-shadow: 0 0 6vmin #3b78c466;
    }
    :global(html[data-gl="off"]) .planet-fallback {
        display: block;
    }
</style>
