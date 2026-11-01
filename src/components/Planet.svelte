<script lang="ts">
    import { onMount } from "svelte";
    import { Canvas } from "@threlte/core/webgpu";
    import { NoToneMapping, WebGPURenderer } from "three/webgpu";
    import Scene from "./planet/Scene.svelte";
    import { sim } from "../lib/planet/sim.svelte";
    import { createUniforms } from "../lib/planet/uniforms";

    const u = createUniforms();
    // ?debug opens a tweak panel; loaded on demand so it stays out of the normal bundle
    let debug = $state(false);

    // WebGPU is opt-in (?gpu): TSL compiles to WGSL there, but the default WebGL2 backend is the path that is exercised daily.
    let backend: "pending" | "gpu" | "gl" = $state("pending");

    onMount(async () => {
        const wantGpu = new URLSearchParams(location.search).has("gpu");
        const adapter = wantGpu
            ? await navigator.gpu?.requestAdapter?.().catch(() => null)
            : null;
        backend = adapter ? "gpu" : "gl";
        debug = new URLSearchParams(location.search).has("debug");
    });

    const createRenderer = (canvas: HTMLCanvasElement) =>
        new WebGPURenderer({
            canvas,
            antialias: false,
            forceWebGL: backend === "gl",
            powerPreference: "high-performance",
        });
</script>

<div class="planet-host" aria-hidden="true">
    <div class="planet-fallback"></div>
    {#if backend !== "pending"}
        <Canvas
            {createRenderer}
            renderMode="manual"
            dpr={[1, 1.5]}
            toneMapping={NoToneMapping}
            shadows={false}
        >
            <Scene {u} />
        </Canvas>
    {/if}
</div>

{#if debug}
    {#await import("./Debug.svelte") then m}
        <m.default {u} />
    {/await}
{/if}

<p class="planet-readout" aria-label="Planet telemetry">
    alt {sim.alt} km · rot {sim.rot}°/s · seed {sim.seed} · {sim.rarity} ·
    <span class:live={sim.state === "LOCKED"}>{sim.state.toLowerCase()}</span>
</p>

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
        right: -12vmin;
        top: 12vh;
        width: 80vmin;
        height: 80vmin;
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

    .planet-readout {
        position: fixed;
        right: 20px;
        bottom: 16px;
        z-index: 5;
        margin: 0;
        font: 400 0.7rem/1.4 var(--font-mono);
        font-variant-numeric: tabular-nums;
        color: var(--color-dim);
        pointer-events: none;
    }
    .planet-readout .live {
        color: var(--color-amber);
    }
    @media (max-width: 760px) {
        .planet-readout {
            display: none;
        }
    }
</style>
