/** The tab icon follows the world on screen: same family, same accent colour. Returns a data URI. */
export function faviconFor(family: string, accent: string, ring = false) {
  const bg = '<rect width="32" height="32" rx="7" fill="#0b0f2a"/>';
  const halo = (id: string) => `<radialGradient id="${id}"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>`;
  const tilted = (rx: number, ry: number, w: number) => `<ellipse cx="16" cy="16" rx="${rx}" ry="${ry}" transform="rotate(-20 16 16)" fill="none" stroke="${accent}" stroke-width="${w}"/>`;
  const body: Record<string, string> = {
    star: `<defs>${halo('h')}</defs><circle cx="16" cy="16" r="15" fill="url(#h)" opacity=".7"/><circle cx="16" cy="16" r="6" fill="#fff6dc"/>`,
    hole: `<circle cx="16" cy="16" r="8" fill="none" stroke="${accent}" stroke-opacity=".45"/><circle cx="16" cy="16" r="6.5" fill="#000"/>${tilted(13, 4, 2.2)}`,
    nebula: `<defs>${halo('h')}</defs><circle cx="12" cy="13" r="11" fill="url(#h)" opacity=".8"/><circle cx="20" cy="19" r="10" fill="url(#h)" opacity=".7"/><circle cx="21" cy="10" r="7" fill="url(#h)" opacity=".6"/>`,
    comet: `<path d="M23 8 4 27l2 1 19-17Z" fill="${accent}" opacity=".45"/><circle cx="22" cy="10" r="4.5" fill="${accent}"/>`,
  };
  const planet = `<circle cx="16" cy="16" r="9.5" fill="${accent}"/><path d="M8.5 20.5a9.5 9.5 0 0 0 15-8.5 9.5 9.5 0 0 1-15 8.5Z" fill="#0b0f2a" opacity=".55"/><circle cx="16" cy="16" r="10.3" fill="none" stroke="#fff" stroke-opacity=".35"/>${ring ? tilted(14.5, 4, 1.6) : ''}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${bg}${body[family] ?? planet}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
