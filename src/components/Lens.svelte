<script lang="ts">
  import { onMount } from 'svelte';
  import { sim } from '../lib/planet/sim.svelte';
  import { stage } from '../lib/interactions';
  import { loggedCount, openAtlas } from '../lib/atlas.svelte';
  import { TYPES } from '../lib/planet/archetypes';

  const odds = $derived(TYPES.find((t) => t.id === sim.typeId)?.weight);
  const locked = $derived(sim.state === 'LOCKED');

  // the orbit follows the body the scene actually drew: `stage` is its centre and radius on screen, in CSS pixels
  let g = $state<SVGGElement>();
  let ring = $state<SVGEllipseElement>();
  let back = $state<SVGPathElement>();
  let front = $state<SVGPathElement>();
  let hole = $state<SVGCircleElement>();
  let probe = $state<SVGGElement>();
  let shown = $state(false);
  let hud = $state<HTMLDivElement>();

  onMount(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PERIOD = 48; // seconds per orbit
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // without a GPU the CSS stand-in sits in the middle of the lens at 0.4 of its short side
      let { x: cx, y: cy, r } = stage;
      if (sim.state === 'NO-GL' && hud) {
        const b = hud.getBoundingClientRect();
        [cx, cy, r] = [b.left + b.width / 2, b.top + b.height / 2, 0.4 * Math.min(b.width, b.height)];
      }
      shown = r > 0;
      if (!shown || !g) return;
      const rx = r * 1.9;
      const ry = r * 0.42;
      g.setAttribute('transform', `translate(${cx} ${cy}) rotate(-12)`);
      ring!.setAttribute('rx', `${rx}`);
      ring!.setAttribute('ry', `${ry}`);
      // the far half passes behind the body, the near half in front of it
      back!.setAttribute('d', `M${-rx} 0A${rx} ${ry} 0 0 1 ${rx} 0`);
      front!.setAttribute('d', `M${-rx} 0A${rx} ${ry} 0 0 0 ${rx} 0`);
      hole!.setAttribute('r', `${r}`);
      const t = reduced ? 2.3 : ((now / 1000) * Math.PI * 2) / PERIOD;
      const x = Math.cos(t) * rx;
      const y = Math.sin(t) * ry;
      probe!.setAttribute('transform', `translate(${x} ${y})`);
      // behind the body means on the far half and inside its disc
      probe!.style.opacity = y < 0 && Math.hypot(x, y) < r ? '0' : '1';
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<svg class="orbit" class:on={shown} aria-hidden="true">
  <defs>
    <mask id="behind" maskUnits="userSpaceOnUse" x="-9999" y="-9999" width="19998" height="19998">
      <rect x="-9999" y="-9999" width="19998" height="19998" fill="#fff" />
      <circle bind:this={hole} cx="0" cy="0" r="0" fill="#000" />
    </mask>
  </defs>
  <g bind:this={g}>
    <ellipse bind:this={ring} class="halo" rx="0" ry="0" mask="url(#behind)" />
    <path bind:this={back} class="far" mask="url(#behind)" />
    <path bind:this={front} class="near" />
    <g bind:this={probe}><circle r="11" class="probe-ring" /><circle r="4" class="probe" /></g>
  </g>
</svg>

<div class="hud" bind:this={hud}>
  <p class="top">
    <span class="k hi">Target · {locked ? sim.name : sim.state === 'NO-GL' ? 'stand-in, no GPU' : 'acquiring'}</span>
    {#if locked}<span class="k">{sim.rarity}{odds ? ` · ${odds}% of rolls` : ''}</span>{/if}
  </p>
  <button type="button" class="k hi corner left" onclick={openAtlas}>Atlas · {loggedCount()}/{TYPES.length} →</button>
  {#if locked}
    <button type="button" class="k hi corner right" disabled={sim.cool > 0} onclick={() => dispatchEvent(new Event('planet:reseed'))}>
      {sim.cool > 0 ? `Recalibrating ${sim.cool}s` : 'Roll a new world ↻'}
    </button>
  {:else if sim.state !== 'NO-GL'}
    <span class="k corner right" aria-live="polite">Surveying {Math.round(sim.progress * 100)}%</span>
  {/if}
</div>

<style>
  .orbit { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; overflow: visible; opacity: 0; transition: opacity 1.2s; }
  .orbit.on { opacity: 1; }
  .halo { fill: none; stroke: rgb(236 239 251 / 0.05); stroke-width: 10; }
  .far { fill: none; stroke: rgb(236 239 251 / 0.18); stroke-dasharray: 2 6; }
  .near { fill: none; stroke: rgb(236 239 251 / 0.4); }
  .probe { fill: var(--color-ink); }
  .probe-ring { fill: none; stroke: rgb(236 239 251 / 0.4); }

  .hud { position: absolute; inset: 0; }
  .top { position: absolute; left: 50px; top: 22px; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .corner { position: absolute; bottom: 22px; }
  .left { left: 50px; }
  .right { right: 50px; }
  button { background: none; border: 0; padding: 6px 0; cursor: pointer; }
  button:hover:not(:disabled) { color: var(--color-amber); }
  button:disabled { opacity: 0.55; cursor: default; }
  @media (max-width: 1023px), (max-height: 679px) {
    .top { left: 20px; top: 16px; }
    .left { left: 20px; bottom: 12px; }
    .right { right: 20px; bottom: 12px; }
  }
</style>
