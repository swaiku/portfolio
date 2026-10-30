<script lang="ts">
    // legacy (non-runes) component: svelte-tweakpane-ui still emits Svelte 4 events (`on:click`)
    import { Button, FpsGraph, Folder, Monitor, Pane, Slider } from "svelte-tweakpane-ui";
    import type { Uniforms } from "../lib/planet/uniforms";
    import { sim } from "../lib/planet/sim.svelte";

    export let u: Uniforms;

    const go = (kind: string) => {
        const q = new URLSearchParams(location.search);
        q.delete("planet");
        if (kind) q.set("kind", kind);
        else q.delete("kind");
        location.search = q.toString();
    };
</script>

<Pane title="Debug" position="draggable" x={16} y={64} width={280}>
    <FpsGraph />
    <Monitor value={`${sim.name} · ${sim.kind}`} label="world" />
    <Monitor value={sim.state} label="state" />
    <Button title="Reseed" on:click={() => dispatchEvent(new Event("planet:reseed"))} />

    <Folder title="Load">
        <Button title="Random" on:click={() => go("")} />
        <Button title="Planet" on:click={() => go("planet")} />
        <Button title="Star" on:click={() => go("star")} />
        <Button title="Black hole" on:click={() => go("hole")} />
    </Folder>

    <Folder title="Black hole">
        <Slider bind:value={u.hole.exposure.value} label="exposure" min={0} max={4} step={0.01} />
        <Slider bind:value={u.hole.doppler.value} label="doppler" min={0} max={1.2} step={0.01} />
        <Slider bind:value={u.hole.diskIn.value} label="disk in" min={0.1} max={0.4} step={0.005} />
        <Slider bind:value={u.hole.diskOut.value} label="disk out" min={0.3} max={0.95} step={0.005} />
        <Slider bind:value={u.hole.ring.value} label="photon ring" min={0} max={2} step={0.01} />
    </Folder>
</Pane>
