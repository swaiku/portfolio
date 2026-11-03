export type Tier = 'off' | 'low' | 'mid' | 'high';

/** Render budget picked once from the device, then lowered live when frames run long. */
export const quality = $state({ tier: 'high' as Tier, dpr: 1.5, floor: 0.75 });

const START = { off: 1, low: 1, mid: 1.25, high: 1.5 };
export const BAKE = { off: 1024, low: 1024, mid: 2048, high: 4096 };

/**
 * 'off' = neither a real WebGPU adapter nor hardware WebGL2 (a page-sized shader planet would crawl on a software
 * rasteriser): use the CSS fallback. `gpu` says a real WebGPU adapter was found.
 */
export function probe(gpu: boolean): Tier {
  if (!gpu) {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'off';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) return 'off';
  }
  const n = navigator as Navigator & { deviceMemory?: number };
  const weak = (n.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  return weak ? 'low' : coarse ? 'mid' : 'high';
}

export function setTier(tier: Tier) {
  quality.tier = tier;
  quality.dpr = Math.min(devicePixelRatio, START[tier]);
}
