import type { RollArgs } from './archetypes';
import type { Fact } from './facts';

/** Live readout shown in the HUD; written by the scene a few times per second. */
export const sim = $state({
  seed: '------',
  name: '--',
  kind: '--',
  /** object family and type id of the world on screen, and the arguments that rolled it (for the debug panel) */
  family: '' as string,
  typeId: '',
  args: null as RollArgs | null,
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
