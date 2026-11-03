import type { Fact } from './facts';

/** Live readout shown in the HUD; written by the scene a few times per second. */
export const sim = $state({
  seed: '------',
  name: '--',
  kind: '--',
  rarity: '--',
  traits: '',
  facts: [] as Fact[],
  phase: 'sky' as string,
  /** 0 → 1 while the world is being baked */
  progress: 0,
  /** seconds until the next survey may start */
  cool: 0,
  state: 'BOOT' as 'BOOT' | 'SURVEY' | 'LOCKED' | 'NO-GL',
});
