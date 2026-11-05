<script lang="ts">
    import { Canvas } from "@threlte/core/webgpu";
    import { NoToneMapping, WebGPURenderer } from "three/webgpu";
    import Scene from "./Scene.svelte";
    import { createUniforms, type Uniforms } from "../../lib/planet/uniforms";
    import { quality } from "../../lib/planet/quality.svelte";

    // the renderer and the world: Planet.svelte loads this only once a usable GPU is found. `u` goes back up for the debug panel
    let { backend, u = $bindable() }: { backend: "gpu" | "gl"; u?: Uniforms } = $props();
    u = createUniforms();

    const createRenderer = (canvas: HTMLCanvasElement) =>
        new WebGPURenderer({
            canvas,
            antialias: false,
            forceWebGL: backend === "gl",
            powerPreference: "high-performance",
        });
</script>

<Canvas {createRenderer} renderMode="manual" dpr={quality.dpr} toneMapping={NoToneMapping} shadows={false}>
    <Scene u={u!} />
</Canvas>
