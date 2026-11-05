<script lang="ts">
  import { onMount } from 'svelte';
  import { TYPES } from '../lib/planet/archetypes';
  import { atlas, CLASSES, dismissToast, revisit, seenCount, tune } from '../lib/atlas.svelte';
  import { startInteractions } from '../lib/interactions';

  let dlg = $state<HTMLDialogElement>();

  const code = (i: number) => `CL-${String(i + 1).padStart(2, '0')}`;

  const goTune = (id: string) => {
    tune(id);
    dlg?.close();
  };
  const goTo = (id: string) => {
    if (revisit(id)) dlg?.close();
  };
  const close = () => {
    dlg?.close();
    atlas.fresh = '';
  };

  onMount(() => {
    const open = () => { atlas.opened = true; dlg?.showModal(); };
    addEventListener('atlas:open', open);
    const stop = startInteractions();
    return () => {
      removeEventListener('atlas:open', open);
      stop();
    };
  });
</script>

<dialog bind:this={dlg} class="atlas" aria-labelledby="atlas-title" onclose={() => (atlas.fresh = '')} onclick={(e) => e.target === dlg && close()}>
  <div class="board">
    <header class="head">
      <h2 id="atlas-title">Atlas</h2>
      <p class="count"><b>{seenCount()}</b> / {TYPES.length} classes seen</p>
      <p class="intro">Every class you meet is kept here with the seed of the first world you saw it in, and a picture of it. Bring that world back, or tune the lens to any class.</p>
      <button type="button" class="k hi close" onclick={close}>Close ✕</button>
    </header>

    <ol class="grid">
      {#each TYPES as t, i (t.id)}
        {@const seen = !!atlas.seen[t.id]}
        {@const thumb = atlas.thumbs[t.id]}
        <li class="cell" data-rarity={t.rarity} class:seen class:here={atlas.current.id === t.id} class:fresh={atlas.fresh === t.id} style="--d: {i}">
          <p class="top"><span class="k">{code(i)}</span><span class="k rarity">{t.rarity}</span></p>
          <div class="pic">
            {#if thumb}<img src={thumb} alt="" width="160" height="160" />{:else}<span class="mark" aria-hidden="true"></span>{/if}
          </div>
          <h3>{seen ? t.label : 'Unsurveyed class'}</h3>
          {#if seen}<p class="note">{CLASSES[t.id]}</p>{/if}
          <p class="acts">
            {#if seen}
              <button type="button" class="k" onclick={() => goTo(t.id)} disabled={atlas.current.seed === atlas.seen[t.id]} title="Bring this world back">Seed {atlas.seen[t.id]} ↻</button>
            {/if}
            <button type="button" class="k hi" onclick={() => goTune(t.id)} aria-label={seen ? `Tune the lens to ${t.label}` : `Tune the lens to ${code(i)}`}>Tune →</button>
          </p>
        </li>
      {/each}
    </ol>

    <p class="k foot">Rolls since a new class: <b>{atlas.misses}</b>. The longer it runs, the likelier a roll finds one.</p>
  </div>
</dialog>

{#if atlas.toast}
  <div class="toast" role="status">
    <p class="k t-title">{atlas.toast.title}</p>
    <p class="t-name">{atlas.toast.name}</p>
    <p class="t-line">{atlas.toast.line}</p>
    <p class="t-actions">
      <button type="button" class="k hi" onclick={() => { dismissToast(); dlg?.showModal(); }}>Open the atlas →</button>
      <button type="button" class="k" onclick={dismissToast}>Dismiss</button>
    </p>
  </div>
{/if}

<style>
  .atlas {
    width: 100%; max-width: none; height: 100%; max-height: none; margin: 0; padding: 16px; box-sizing: border-box; border: 0;
    background: #04050b; color: var(--color-ink-2); overflow-y: auto;
  }
  .atlas::backdrop { background: rgb(4 5 11 / 0.6); }
  /* the same ruled sheet as the page: cells joined by hairlines, nothing floating */
  .board { min-height: 100%; display: grid; grid-template-rows: auto 1fr auto; }
  .head {
    display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 6px 28px;
    padding: 22px 26px; outline: 1px solid rgb(236 239 251 / 0.13); outline-offset: -0.5px;
  }
  h2 { margin: 0; font: 700 clamp(2rem, 3.4vw, 3rem)/1 var(--font-display); letter-spacing: -0.045em; color: var(--color-ink); }
  .count { margin: 0; font: 500 0.95rem/1.4 var(--font-display); color: var(--color-dim); }
  .count b { color: var(--color-amber); font-weight: 500; }
  .intro { grid-column: 1 / -1; margin: 0; max-width: 70ch; font-size: 0.9rem; line-height: 1.55; color: #a9aec6; }
  .close { grid-row: 1; grid-column: 3; }
  button { background: none; border: 0; padding: 6px 0; cursor: pointer; }
  button:hover:not(:disabled) { color: var(--color-amber); }
  button:disabled { opacity: 0.45; cursor: default; }

  .grid { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .cell {
    --r: #dfe3f7;
    position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0;
    padding: 18px 22px 16px; outline: 1px solid rgb(236 239 251 / 0.13); outline-offset: -0.5px; background: #05060d;
  }
  .cell[data-rarity='uncommon'] { --r: #6fdca0; }
  .cell[data-rarity='rare'] { --r: #8fc7ff; }
  .cell[data-rarity='epic'] { --r: #c39bff; }
  .cell[data-rarity='legendary'] { --r: #ffb84d; }
  .cell.here { outline: 1px solid var(--color-amber); z-index: 1; }
  .top { margin: 0; display: flex; justify-content: space-between; }
  .rarity { color: var(--r); }
  .pic { display: grid; place-items: center; height: clamp(88px, 13vh, 132px); }
  .pic img { height: 100%; width: auto; aspect-ratio: 1; border-radius: 50%; }
  /* no picture yet: a dotted ring for a class never met, a solid one in its rarity colour once met */
  .mark { width: clamp(56px, 8vh, 84px); aspect-ratio: 1; border-radius: 50%; border: 1px dashed rgb(236 239 251 / 0.3); }
  .seen .mark { border: 1px solid var(--r); background: radial-gradient(circle at 32% 30%, color-mix(in srgb, var(--r) 45%, transparent), transparent 70%); }
  h3 { margin: 0; font: 500 1rem/1.25 var(--font-display); letter-spacing: -0.02em; color: var(--color-ink); }
  .cell:not(.seen) h3 { color: var(--color-dim); }
  .note { margin: 0; font-size: 0.82rem; line-height: 1.45; color: #a9aec6; }
  .acts { margin: auto 0 0; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; }
  .foot { padding: 16px 26px; outline: 1px solid rgb(236 239 251 / 0.13); outline-offset: -0.5px; }
  .foot b { color: var(--color-amber); font-weight: 500; }

  /* opening: the cells come up in reading order; a class just met lands with a flash of its rarity colour */
  .atlas[open] .cell { animation: rise 0.6s var(--ease-out-expo) backwards; animation-delay: calc(var(--d) * 35ms); }
  .atlas[open] .cell.fresh .pic { animation: land 1.2s var(--ease-out-expo) 0.4s backwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  @keyframes land { from { opacity: 0; transform: scale(1.35); filter: drop-shadow(0 0 18px var(--r)); } }

  .toast {
    position: fixed; z-index: 20; top: 24px; right: 24px; width: min(22rem, calc(100% - 48px));
    padding: 18px 20px; box-sizing: border-box; background: #05060d; border: 1px solid var(--color-amber);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.5); animation: pop 0.7s var(--ease-out-expo);
  }
  .toast p { margin: 0; }
  .t-title { color: var(--color-amber); }
  .t-name { margin-top: 6px; font: 500 1.05rem/1.3 var(--font-display); color: var(--color-ink); }
  .t-line { margin-top: 8px; font-size: 0.88rem; line-height: 1.55; color: var(--color-ink-2); }
  .t-actions { display: flex; gap: 20px; margin-top: 12px; }
  @keyframes pop { from { opacity: 0; transform: translateY(-10px) scale(0.96); } }

  @media (max-width: 1023px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 520px) {
    .atlas { padding: 12px; }
    .head { grid-template-columns: 1fr auto; }
    .count { grid-column: 1 / -1; grid-row: 2; }
    .close { grid-column: 2; }
    .cell { padding: 14px 14px 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .atlas[open] .cell, .atlas[open] .cell.fresh .pic, .toast { animation: none; }
  }
</style>
