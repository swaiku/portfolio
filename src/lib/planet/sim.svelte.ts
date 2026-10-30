/** Live readout shown in the HUD; written by the scene a few times per second. */
export const sim = $state({
  alt: '--',
  rot: '--',
  seed: '------',
  name: '--',
  kind: '--',
  state: 'BOOT' as 'BOOT' | 'SURVEY' | 'LOCKED' | 'NO-GL',
});
