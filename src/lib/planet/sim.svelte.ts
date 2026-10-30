/** Live readout shown in the HUD; written by the scene a few times per second. */
export const sim = $state({
  alt: '--',
  rot: '--',
  seed: '------',
  name: '--',
  kind: '--',
  rarity: '--',
  state: 'BOOT' as 'BOOT' | 'SURVEY' | 'LOCKED' | 'NO-GL',
});
