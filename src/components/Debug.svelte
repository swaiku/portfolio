<script lang="ts">
    // legacy (non-runes) component: svelte-tweakpane-ui still emits Svelte 4 events (`on:click`)
    import { Button, Color, FpsGraph, Folder, Monitor, Pane, Slider, Text } from "svelte-tweakpane-ui";
    import { Color as ThreeColor, type Vector3 } from "three";
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

    // `bake`: the value is read while the world is baked into a texture, so the world is baked again after an edit
    type Num = { t: "n"; label: string; o: any; key: string; min: number; max: number; step: number; bake?: boolean };
    type Col = { t: "c"; label: string; v: Vector3; bake?: boolean };
    type Ctl = Num | Col;
    type Group = { title: string; when?: () => boolean; ctl: Ctl[] };

    const n = (label: string, o: any, key: string, min: number, max: number, step: number, bake = false): Num => ({ t: "n", label, o, key, min, max, step, bake });
    const c = (label: string, v: Vector3, bake = false): Col => ({ t: "c", label, v, bake });

    // built per world: applyWorld swaps colour uniforms for new vectors, so references taken once would go stale
    const build = (): Record<string, Group[]> => {
        const { terrain: T, sky: S, hole: H } = u;
        return {
        all: [{ title: "Sky", ctl: [c("a", S.a.value, true), c("b", S.b.value, true), c("c", S.c.value, true)] }],
        planet: [
            { title: "Terrain", ctl: [
                n("freq", T.cfreq, "value", 0.3, 4, 0.01, true), n("amp", T.amp, "value", 0, 0.8, 0.005, true),
                n("ridge", T.ridge, "value", 0, 1, 0.01, true), n("warp", T.warp, "value", 0, 1.5, 0.01, true),
                n("terrace", T.terrace, "value", 0, 12, 1, true), n("dry", T.dry, "value", 0, 1, 1, true),
                n("bands", T.bands, "value", 0, 14, 1, true), n("swirl", T.swirl, "value", 0, 0.3, 0.005, true),
            ] },
            { title: "Ground", ctl: [
                ...u.ramp.map((r, i) => c(`ramp ${i}`, r.value, true)),
                n("strata", u.strata, "value", 0, 0.9, 0.01), n("strata freq", u.strataF, "value", 1, 15, 0.1),
                n("ice", u.ice, "value", 0, 1, 0.01), c("ice colour", u.iceCol.value), c("sun", u.sunCol.value),
            ] },
            { title: "Liquid", ctl: [
                n("present", u.hasLiq, "value", 0, 1, 1), n("sea level", u.sea, "value", -0.5, 1, 0.005),
                c("deep", u.liqDeep.value), c("shallow", u.liqShallow.value),
            ] },
            { title: "Gas giant", when: () => u.gas.value > 0.5, ctl: [c("band A", u.gasA.value), c("band B", u.gasB.value)] },
            { title: "Clouds", ctl: [n("amount", u.cloudAmt, "value", 0, 1, 0.01), c("tint", u.cloudTint.value)] },
            { title: "Atmosphere", ctl: [n("scatter", u.scatter, "value", 0, 1.5, 0.01), c("colour", u.atmoCol.value)] },
            { title: "Glow", ctl: [
                n("amount", u.glowAmt, "value", 0, 4, 0.01), n("mode", u.glowMode, "value", 0, 1, 1),
                n("day", u.glowDay, "value", 0, 1, 0.01), c("colour", u.glowCol.value),
            ] },
            { title: "Ring", when: () => sim.traits.includes("ringed"), ctl: [
                n("inner", u.ringIn, "value", 1, 3, 0.01), n("outer", u.ringOut, "value", 1, 3, 0.01),
                n("amount", u.ringAmt, "value", 0, 1, 0.01), n("freq 1", u.ringF1, "value", 0, 100, 0.5),
                n("freq 2", u.ringF2, "value", 0, 300, 1), c("colour A", u.ringA.value), c("colour B", u.ringB.value),
            ] },
        ],
        star: [
            { title: "Star", ctl: [
                n("activity", u.activity, "value", 0.2, 1.2, 0.01), n("spots", u.spots, "value", 0, 1, 0.01),
                n("storms", u.storms, "value", 0, 1, 0.01), n("twinkle", u.twinkle, "value", 0, 0.2, 0.002),
                n("twinkle rate", u.twinkleRate, "value", 0, 2, 0.01), n("flare size", u.flareAmt, "value", 0, 1, 0.01),
                n("flare rate", u.flareRate, "value", 0, 1, 0.01), n("scale", u.primaryScale, "value", 0.05, 2, 0.01),
                c("colour", u.sunCol.value), ...u.ramp.map((r, i) => c(`ramp ${i}`, r.value, true)),
            ] },
            { title: "Pulsar", when: () => sim.typeId.includes("pulsar"), ctl: [n("beam tilt", u.beamTilt, "value", 0, 1.57, 0.01)] },
        ],
        hole: [
            { title: "Black hole", ctl: [
                n("exposure", H.exposure, "value", 0, 4, 0.01), n("doppler", H.doppler, "value", 0, 1.2, 0.01),
                n("disk in", H.diskIn, "value", 0.1, 0.4, 0.005), n("disk out", H.diskOut, "value", 0.3, 0.95, 0.005),
                n("photon ring", H.ring, "value", 0, 2, 0.01),
            ] },
        ],
        nebula: [
            { title: "Nebula", ctl: [
                n("shape", u.nebShape, "value", 0, 5, 1, true),
                c("dust", u.nebA.value, true), c("middle", u.nebB.value, true), c("core", u.nebC.value, true),
            ] },
        ],
        comet: [
            { title: "Comet", ctl: [
                c("head", u.cometHead.value), c("tail tip", u.cometTip.value),
                n("length", u.cometA.value, "x", 0, 1.5, 0.01), n("ion", u.cometA.value, "y", 0, 2, 0.01),
                n("ion width", u.cometA.value, "z", 0, 2, 0.01), n("streaks", u.cometA.value, "w", 0, 1, 0.01),
                n("dust", u.cometB.value, "x", 0, 2, 0.01), n("bend", u.cometB.value, "y", -1.5, 1.5, 0.01),
                n("kink", u.cometB.value, "z", 0, 2, 0.01), n("head size", u.cometB.value, "w", 0, 2, 0.01),
            ] },
        ],
        };
    };

    const pick = (family: string) => { const g = build(); return [...g.all, ...(g[family] ?? [])]; };

    // colour uniforms live in linear space; the picker speaks sRGB
    const tmp = new ThreeColor();
    const hex = (v: Vector3) => "#" + tmp.setRGB(v.x, v.y, v.z).getHexString();
    const setHex = (v: Vector3, s: string) => { tmp.set(s); v.set(tmp.r, tmp.g, tmp.b); };

    let rebakeTimer: ReturnType<typeof setTimeout>;
    const edited = (e: CustomEvent, bake?: boolean) => {
        if (bake && e.detail.origin === "internal") {
            clearTimeout(rebakeTimer);
            rebakeTimer = setTimeout(() => dispatchEvent(new Event("planet:rebake")), 250);
        }
    };

    // a hand-edited world is not reproducible from its seed alone, so the export carries both
    let seedIn = sim.seed;
    $: if (sim.seed) seedIn = sim.seed;
    const applySeed = () => {
        const seed = parseInt(seedIn, 16);
        if (sim.args && Number.isFinite(seed)) dispatchEvent(new CustomEvent("planet:reseed", { detail: { replay: { ...sim.args, seed } } }));
    };
    const exportState = () => {
        const tweaks: Record<string, number | string> = {};
        for (const g of pick(sim.family))
            for (const k of g.ctl) tweaks[`${g.title}/${k.label}`] = k.t === "n" ? k.o[k.key] : hex(k.v);
        navigator.clipboard.writeText(JSON.stringify({ seed: sim.seed, args: sim.args, type: sim.typeId, tweaks }, null, 1));
    };
</script>

<Pane title="Debug" position="draggable" x={16} y={64} width={280}>
    <FpsGraph />
    <Monitor value={`${sim.name} · ${sim.kind}`} label="world" />
    <Monitor value={`${sim.family} / ${sim.typeId}`} label="type" />
    <Monitor value={sim.state} label="state" />
    <Button title="Reseed" on:click={() => dispatchEvent(new Event("planet:reseed"))} />

    <Folder title="Seed">
        <Text bind:value={seedIn} label="seed (hex)" />
        <Button title="Apply seed" on:click={applySeed} />
        <Button title="Copy seed + tweaks" on:click={exportState} />
        <Button title="Rebake" on:click={() => dispatchEvent(new Event("planet:rebake"))} />
    </Folder>

    <Folder title="Load">
        <Button title="Random" on:click={() => go("")} />
        <Button title="Planet" on:click={() => go("planet")} />
        <Button title="Star" on:click={() => go("star")} />
        <Button title="Nebula" on:click={() => go("nebula")} />
        <Button title="Comet" on:click={() => go("comet")} />
        <Button title="Black hole" on:click={() => go("hole")} />
    </Folder>

    <!-- keyed by seed: a new world rewrote the uniforms, so the controls are rebuilt to show them -->
    {#key sim.seed}
        {#each pick(sim.family) as g (g.title)}
            {#if !g.when || g.when()}
                <Folder title={g.title}>
                    {#each g.ctl as k (k.label)}
                        {#if k.t === "n"}
                            <Slider bind:value={k.o[k.key]} label={k.label} min={k.min} max={k.max} step={k.step} on:change={(e) => edited(e, k.bake)} />
                        {:else}
                            <Color value={hex(k.v)} label={k.label} on:change={(e) => { if (e.detail.origin === "internal") setHex(k.v, String(e.detail.value)); edited(e, k.bake); }} />
                        {/if}
                    {/each}
                </Folder>
            {/if}
        {/each}
    {/key}
</Pane>
