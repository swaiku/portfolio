<script lang="ts">
  import Probe from './Probe.svelte';
  import { onMount } from 'svelte';
  import { TYPES, type Rarity } from '../lib/planet/archetypes';
  import { atlas, CLASSES, TASKS, TASK_HINTS, dismissToast, launchProbe, loggedCount, probeTargets, revisit } from '../lib/atlas.svelte';
  import { startInteractions } from '../lib/interactions';

  let { tz }: { tz: string } = $props();
  let dlg = $state<HTMLDialogElement>();

  const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const groups = RARITIES.map((r) => ({ rarity: r, types: TYPES.filter((t) => t.rarity === r) }));
  const designation = (id: string) => `CL-${String(TYPES.findIndex((t) => t.id === id) + 1).padStart(2, '0')}`;
  const stateOf = (id: string) => (atlas.logged[id] ? 'logged' : atlas.seen[id] ? 'observed' : 'unsurveyed');
  const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const tasks = Object.entries(TASKS).filter(([, t]) => t.probe);

  const launch = () => {
    if (launchProbe()) dlg?.close();
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
    const stop = startInteractions(tz);
    return () => {
      removeEventListener('atlas:open', open);
      stop();
    };
  });
</script>

<dialog bind:this={dlg} class="atlas" aria-labelledby="atlas-title" onclose={() => (atlas.fresh = '')} onclick={(e) => e.target === dlg && close()}>
  <div class="sheet">
    <header class="head">
      <div>
        <h2 id="atlas-title">Star atlas</h2>
        <p class="count"><b>{loggedCount()}</b> / {TYPES.length} classes logged</p>
      </div>
      <div class="tools">
        <button type="button" class="probe" disabled={!atlas.probes || !probeTargets().length} onclick={launch}>
          Launch probe <b>×{atlas.probes}</b>
        </button>
        <button type="button" class="close" onclick={close} aria-label="Close the atlas">Close</button>
      </div>
    </header>
    <p class="intro">Seeing a world only notes it. A class is logged when you do what it asks while it is on screen. A probe sends the next survey to a class you have not logged, picked at random. Legendary classes open up once their collection is done.</p>

    {#each groups as g (g.rarity)}
      <section class="group" data-rarity={g.rarity} aria-label={g.rarity}>
        <h3>{g.rarity}</h3>
        <ul>
          {#each g.types as t (t.id)}
            {@const st = stateOf(t.id)}
            <li class="row" data-state={st}>
              <span class="id">{designation(t.id)}</span>
              <span class="body">
                <span class="name">{st === 'unsurveyed' ? 'Unsurveyed class' : t.label}</span>
                {#if st === 'observed'}<span class="line">{CLASSES[t.id].hint}</span>{/if}
                {#if st === 'logged'}<span class="line">{CLASSES[t.id].note}</span>{/if}
                {#if st !== 'unsurveyed'}
                  <button type="button" class="seed" onclick={() => goTo(t.id)} disabled={atlas.current.seed === atlas.seen[t.id]} title="Bring this world back">
                    Seed {atlas.seen[t.id]} ↻
                  </button>
                {/if}
              </span>
              <span class="state" class:stamp={atlas.fresh === t.id}>
                {st === 'logged' ? `Logged ${day(atlas.logged[t.id].at)}` : st}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    <section class="group notes" aria-label="Field notes">
      <h3>Field notes</h3>
      <ul>
        {#each tasks as [id, t] (id)}
          {@const done = !!atlas.tasks[id]}
          <li class="row" data-state={done ? 'logged' : 'unsurveyed'}>
            <span class="id"><Probe /></span>
            <span class="body">
              <span class="name">{done || !t.hidden ? t.label : '???'}</span>
              <span class="line">{done ? 'Probe recovered.' : t.hidden ? '' : TASK_HINTS[id]}</span>
            </span>
            <span class="state">{done ? `Done ${day(atlas.tasks[id])}` : 'open'}</span>
          </li>
        {/each}
      </ul>
    </section>

    <p class="intro rolls">Rolls since a new class: <b>{atlas.misses}</b>. The longer it runs, the likelier an unseen class turns up.</p>
  </div>
</dialog>

{#if atlas.toast}
  <div class="toast" role="status">
    <p class="t-title">{atlas.toast.title}</p>
    <p class="t-name">{atlas.toast.name}</p>
    <p class="t-line">{atlas.toast.line}</p>
    <p class="t-actions">
      <button type="button" onclick={() => { dismissToast(); dlg?.showModal(); }}>Open the atlas</button>
      <button type="button" onclick={dismissToast}>Dismiss</button>
    </p>
  </div>
{/if}

<style>
  .atlas {
    width: 100%; max-width: none; height: 100%; max-height: none; margin: 0; padding: 0; border: 0;
    background: rgb(4 6 18 / 0.97); backdrop-filter: blur(10px); color: var(--color-ink-2);
    font-family: var(--font-mono); font-size: 0.74rem; overflow-y: auto;
  }
  .atlas::backdrop { background: none; }
  .atlas[open] { animation: rise 0.5s var(--ease-out-expo); }
  .sheet { width: min(100%, 52rem); margin-inline: auto; padding: clamp(28px, 6vh, 64px) var(--gutter) 96px; box-sizing: border-box; }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px; }
  h2 { margin: 0; font: 500 1.4rem/1.2 var(--font-display); color: var(--color-ink); }
  .count { margin: 8px 0 0; color: var(--color-dim); }
  b { font-weight: 500; color: var(--color-amber); }
  .tools { display: flex; gap: 10px; }
  .tools button {
    padding: 8px 14px; font: inherit; color: var(--color-ink); background: rgb(6 8 24 / 0.6);
    border: 1px solid var(--color-line-strong); cursor: pointer;
  }
  .tools button:hover:not(:disabled) { border-color: var(--color-amber); color: var(--color-amber); }
  .tools button:disabled { opacity: 0.4; cursor: default; }
  .intro { max-width: 62ch; margin: 24px 0 0; line-height: 1.7; color: var(--color-dim); }
  .group { margin-top: 36px; --r: #dfe3f7; }
  .group[data-rarity='uncommon'] { --r: #6fdca0; }
  .group[data-rarity='rare'] { --r: #8fc7ff; }
  .group[data-rarity='epic'] { --r: #c39bff; }
  .group[data-rarity='legendary'] { --r: #ffb84d; }
  .notes { --r: var(--color-dim); }
  h3 { margin: 0 0 10px; font: 500 0.7rem/1 var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--r); }
  ul { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--color-line); }
  .row {
    display: grid; grid-template-columns: 3.4rem 1fr auto; align-items: center; gap: 4px 14px;
    padding: 14px 0; border-bottom: 1px solid var(--color-line);
  }
  .id { color: var(--color-dim); font-variant-numeric: tabular-nums; }
  .body { display: grid; gap: 4px; min-width: 0; }
  .name { color: var(--color-ink); }
  .line { color: var(--color-dim); line-height: 1.6; max-width: 54ch; }
  .state { color: var(--color-dim); text-transform: capitalize; white-space: nowrap; }
  .row[data-state='unsurveyed'] .name { color: var(--color-dim); }
  .row[data-state='observed'] .state { color: var(--r); }
  .row[data-state='logged'] .state { color: var(--r); border: 1px solid currentColor; padding: 3px 9px; letter-spacing: 0.04em; }
  .seed {
    justify-self: start; padding: 0; font: inherit; color: var(--color-dim); background: none; border: 0;
    text-decoration: underline; text-underline-offset: 3px; cursor: pointer; font-variant-numeric: tabular-nums;
  }
  .seed:hover:not(:disabled) { color: var(--color-amber); }
  .seed:disabled { text-decoration: none; cursor: default; }
  .toast {
    position: fixed; z-index: 20; top: 76px; right: var(--gutter); width: min(22rem, calc(100% - 2 * var(--gutter)));
    padding: 16px 18px; box-sizing: border-box; font-family: var(--font-mono); font-size: 0.74rem;
    background: rgb(6 8 24 / 0.92); backdrop-filter: blur(8px); border: 1px solid var(--color-amber);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.5); animation: pop 0.7s var(--ease-out-expo);
  }
  .toast p { margin: 0; }
  .t-title { color: var(--color-amber); letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.68rem; }
  .t-name { margin-top: 6px; font: 500 1rem/1.3 var(--font-display); color: var(--color-ink); }
  .t-line { margin-top: 8px; line-height: 1.6; color: var(--color-ink-2); }
  .t-actions { display: flex; gap: 18px; margin-top: 12px; }
  .t-actions button { padding: 0; font: inherit; color: var(--color-dim); background: none; border: 0; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .t-actions button:hover { color: var(--color-amber); }
  @keyframes pop { from { opacity: 0; transform: translateY(-10px) scale(0.96); } }
  .stamp { animation: stamp 0.7s var(--ease-out-expo) 0.15s backwards; }
  .rolls { margin-top: 40px; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  @keyframes stamp { from { opacity: 0; transform: scale(1.6) rotate(-6deg); } }
  @media (max-width: 640px) {
    .row { grid-template-columns: 2.6rem 1fr auto; }
  }
  @media (prefers-reduced-motion: reduce) {
    .atlas[open], .stamp, .toast { animation: none; }
  }
</style>
