<script lang="ts">
  import { onMount } from 'svelte';
  import Clock from './Clock.svelte';
  import { sim } from '../lib/planet/sim.svelte';
  import { atlas, openAtlas, seenCount, tune } from '../lib/atlas.svelte';
  import { TYPES } from '../lib/planet/archetypes';

  let { base, coords, tz }: { base: string; coords: string; tz: string } = $props();

  const odds = $derived(TYPES.find((t) => t.id === sim.typeId)?.weight);
  const locked = $derived(sim.state === 'LOCKED');

  // the tuning dial: one tick per class, taller the rarer it is, lit once seen
  const TALL = { common: 12, uncommon: 18, rare: 24, epic: 30, legendary: 36 };
  const code = (i: number) => `CL-${String(i + 1).padStart(2, '0')}`;
  const at = $derived(TYPES.findIndex((t) => t.id === sim.typeId));
  const ready = $derived(sim.state === 'LOCKED' || sim.state === 'SURVEY');
  // while a world is being made the lens shows static instead of the bake; it clears as the new world fades in
  const tuning = $derived(sim.state !== 'NO-GL' && sim.phase !== 'fadein' && sim.phase !== 'live');
  const pct = $derived(Math.round(sim.progress * 100));
  // tuning away tears the last frame apart for half a second before the static (the scene sends it: Scene.svelte)
  let tear = $state<HTMLCanvasElement>();
  let tearing = $state(false);
  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const DUR = 560;
    let raf = 0;
    const onFrame = (e: Event) => {
      const src = (e as CustomEvent<HTMLCanvasElement>).detail;
      const cv = tear;
      if (!cv) return;
      const b = cv.getBoundingClientRect();
      const k = src.width / innerWidth;
      const W = (cv.width = Math.max(1, Math.round(b.width / 2)));
      const H = (cv.height = Math.max(1, Math.round(b.height / 2)));
      const ctx = cv.getContext('2d')!;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-amber') || '#ff7a3d';
      const start = performance.now();
      tearing = true;
      cancelAnimationFrame(raf);
      const frame = (now: number) => {
        const t = (now - start) / DUR;
        if (t >= 1) { tearing = false; return; }
        raf = requestAnimationFrame(frame);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#04050b';
        ctx.fillRect(0, 0, W, H);
        if (t < 0.75) {
          ctx.drawImage(src, b.left * k, b.top * k, b.width * k, b.height * k, 0, 0, W, H);
          // bands of the picture slip sideways, more and further as the signal goes
          for (let n = 0; n < 3 + t * 18; n++) {
            const y = Math.random() * H;
            const h = 2 + Math.random() * 26;
            ctx.drawImage(cv, 0, y, W, h, (Math.random() - 0.5) * W * 0.3 * (0.3 + t), y, W, h);
          }
          // a colour fringe: a few thin bars inverted against the accent
          ctx.globalCompositeOperation = 'difference';
          ctx.fillStyle = accent;
          for (let n = 0; n < 2 + t * 6; n++) ctx.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3);
        } else {
          // lost: a few last streaks on black
          ctx.fillStyle = 'rgb(236 239 251 / 0.5)';
          for (let n = 0; n < 6; n++) ctx.fillRect(Math.random() * W * 0.5, Math.random() * H, Math.random() * W, 1);
        }
      };
      raf = requestAnimationFrame(frame);
    };
    addEventListener('planet:frame', onFrame);
    return () => { removeEventListener('planet:frame', onFrame); cancelAnimationFrame(raf); };
  });

  const step = (d: number) => tune(TYPES[(Math.max(at, 0) + d + TYPES.length) % TYPES.length].id);
</script>

<div class="static" class:on={tuning} aria-hidden="true">
  <div class="noise"></div>
  <p class="readout">
    <span class="k">Tuning in</span>
    <span class="k hi target">{at >= 0 ? `${code(at)} · ${TYPES[at].label}` : 'Searching the sky'}</span>
    <span class="bar"><i style="transform: scaleX({pct / 100})"></i></span>
  </p>
</div>

<canvas bind:this={tear} class="tear" class:on={tearing} aria-hidden="true"></canvas>
{#if sim.downlink > 0}<span class="scan" style="top: {sim.downlink * 100}%" aria-hidden="true"></span>{/if}

<div class="hud">
  <p class="corner tl">
    <span class="k hi">Target · {locked ? sim.name : sim.state === 'NO-GL' ? 'stand-in, no GPU' : 'acquiring'}</span>
    {#if locked}<span class="k">{sim.rarity}{odds ? ` · ${odds}% of rolls` : ''}</span>{/if}
    {#if sim.state !== 'NO-GL'}<span class="k" data-seed>Seed {sim.seed}</span>{/if}
  </p>
  <p class="corner tr">
    <span class="k hi">Ground station · {base}</span>
    <span class="k">{coords} · <Clock {tz} /></span>
  </p>
  <button type="button" class="k hi corner bl" onclick={openAtlas}>Atlas · {seenCount()}/{TYPES.length} →</button>
  {#if sim.state !== 'NO-GL'}
    <div class="dial" role="group" aria-label="Tune the lens to a class of world">
      <p class="k hi now" aria-live="polite">{locked && at >= 0 ? `${code(at)} · ${TYPES[at].label}` : 'Tuning…'}</p>
      <div class="scale">
        {#if at >= 0}<span class="needle" class:busy={!locked} style="--i: {at}" aria-hidden="true"></span>{/if}
        <button type="button" class="step" disabled={!ready} onclick={() => step(-1)} aria-label="Previous class">‹</button>
        {#each TYPES as t, i (t.id)}
          {@const seen = !!atlas.seen[t.id]}
          <button
            type="button"
            class="tick"
            class:seen
            class:on={i === at}
            style="--h: {TALL[t.rarity]}px"
            disabled={!ready}
            onclick={() => tune(t.id)}
            title={seen ? `${code(i)} · ${t.label}` : `${code(i)} · unsurveyed`}
            aria-label={seen ? `Tune to ${t.label}` : `Tune to ${code(i)}, a class not seen yet`}
          ><i></i></button>
        {/each}
        <button type="button" class="step" disabled={!ready} onclick={() => step(1)} aria-label="Next class">›</button>
      </div>
    </div>
  {/if}
  {#if locked}
    <button type="button" class="k hi corner br" disabled={sim.cool > 0} onclick={() => dispatchEvent(new Event('planet:reseed'))}>
      {sim.cool > 0 ? `Recalibrating ${sim.cool}s` : 'Roll a new world ↻'}
    </button>
  {:else if sim.state !== 'NO-GL'}
    <span class="k corner br" aria-live="polite">Signal <span class="num">{pct}%</span></span>
  {/if}
</div>

<style>
  /* the tuning screen: dark static, the class being tuned to, and the signal filling */
  .static {
    position: absolute; inset: 0; overflow: hidden; display: grid; place-items: center;
    background: #04050b; opacity: 0; pointer-events: none; transition: opacity 1.1s ease;
  }
  .static.on { opacity: 1; transition-duration: 0.35s; }
  .noise {
    position: absolute; inset: -40px; opacity: 0.16;
    background:
      repeating-linear-gradient(0deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    animation: flicker 0.5s steps(5) infinite;
  }
  .readout { position: relative; margin: 0; display: grid; justify-items: center; gap: 10px; text-align: center; }
  .target { font-size: 0.8rem; }
  .bar { display: block; width: 220px; height: 2px; background: rgb(236 239 251 / 0.15); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--color-amber); transform-origin: left; transition: transform 0.4s ease; }
  @keyframes flicker { to { background-position: 0 7px, 63px -41px; } }
  @media (prefers-reduced-motion: reduce) { .noise { animation: none; } }

  .tear { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; opacity: 0; pointer-events: none; }
  .tear.on { opacity: 1; }
  /* the downlink's receiving line: it steps down the lens with each sharper block of the picture */
  .scan {
    position: absolute; left: 0; right: 0; height: 1px; pointer-events: none;
    background: var(--color-amber); box-shadow: 0 0 12px 1px var(--color-amber);
    transition: top 0.26s steps(4);
  }

  .hud { position: absolute; inset: 0; }
  .corner { position: absolute; margin: 0; display: flex; flex-direction: column; gap: 5px; }
  .tl { left: 50px; top: 24px; }
  .tr { right: 50px; top: 24px; align-items: flex-end; text-align: right; }
  .bl { left: 50px; bottom: 22px; }
  .br { right: 50px; bottom: 22px; }
  /* the bottom corners swap a button for a readout while a world bakes: same box, so nothing jumps */
  .bl, .br { display: block; padding: 6px 0; line-height: 1.5; }
  /* a fixed slot for the percentage: the label must not shuffle as the digits change */
  .num { display: inline-block; min-width: 4.2ch; text-align: right; }
  button { background: none; border: 0; padding: 6px 0; cursor: pointer; color: inherit; }

  .dial { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .now { margin: 0; white-space: nowrap; }
  .scale { --tick: 26px; --step: 34px; position: relative; display: flex; align-items: flex-end; }
  /* the needle glides to the tick the lens is tuned to, and breathes while the new world bakes */
  .needle {
    position: absolute; bottom: -7px; width: 14px; height: 3px; border-radius: 2px; background: var(--color-amber);
    left: calc(var(--step) + var(--i) * var(--tick) + var(--tick) / 2 - 7px);
    box-shadow: 0 0 10px var(--color-amber);
    transition: left 0.8s var(--ease-out-expo), background-color 0.8s;
  }
  .needle.busy { animation: breathe 1.1s ease-in-out infinite alternate; }
  @keyframes breathe { from { opacity: 1; } to { opacity: 0.25; } }
  @media (prefers-reduced-motion: reduce) { .needle { transition: none; } .needle.busy { animation: none; } }
  .tick { width: var(--tick); height: 46px; padding: 0; display: flex; align-items: flex-end; justify-content: center; }
  .tick i { display: block; width: 2px; height: var(--h); border-left: 2px dotted rgb(236 239 251 / 0.35); }
  .tick.seen i { border-left-style: solid; border-color: rgb(236 239 251 / 0.75); }
  .tick.on i { border-color: var(--color-amber); height: calc(var(--h) + 8px); }
  .tick:hover:not(:disabled) i { border-color: var(--color-amber); }
  .tick:focus-visible { outline-offset: -2px; }
  .step { width: var(--step); height: 46px; font: 400 1.4rem/1 var(--font-display); color: var(--color-ink); }
  .step:hover:not(:disabled) { color: var(--color-amber); }
  button:hover:not(:disabled) { color: var(--color-amber); }
  button:disabled { opacity: 0.55; cursor: default; }
  @media (max-width: 1023px), (max-height: 679px) {
    .tl { left: 20px; top: 16px; }
    .tr { display: none; }
    .bl { left: 20px; bottom: 96px; }
    .br { right: 20px; bottom: 96px; }
    .scale { --tick: 21px; --step: 28px; }
  }
</style>
