<script lang="ts">
  import { atlas, loggedCount, openAtlas } from '../lib/atlas.svelte';
  import { TYPES } from '../lib/planet/archetypes';
</script>

<button type="button" class="atlas-link" onclick={openAtlas}>
  <span class="dot" class:call={!atlas.opened} aria-hidden="true"></span>Atlas <b>{loggedCount()}/{TYPES.length}</b>
</button>

<style>
  .atlas-link {
    margin-right: clamp(16px, 2.6vw, 34px);
    padding: 7px 12px; font: 400 0.72rem/1.4 var(--font-mono); color: var(--color-ink); white-space: nowrap; cursor: pointer;
    background: rgb(6 8 24 / 0.6); border: 1px solid var(--color-line-strong);
  }
  .atlas-link:hover { border-color: var(--color-amber); color: var(--color-amber); }
  b { font-weight: 400; color: var(--color-amber); }
  .dot { display: inline-block; width: 6px; height: 6px; margin-right: 8px; border-radius: 50%; background: var(--color-amber); vertical-align: 1px; }
  .dot.call { animation: ping 1.8s ease-out infinite; }
  @keyframes ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-amber) 70%, transparent); } 100% { box-shadow: 0 0 0 9px transparent; } }
  @media (prefers-reduced-motion: reduce) { .dot.call { animation: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-amber) 40%, transparent); } }
</style>
