<a id="readme-top"></a>

<div align="center">
  <a href="https://jrmy.ch">
    <img src="public/og.jpg" alt="A black hole rendered by the site's procedural planet" width="600">
  </a>

  <h3 align="center">swaiku · personal website</h3>

  <p align="center">
    A mission-control portfolio built around a real-time procedural planet.
    <br />
    <a href="https://jrmy.ch"><strong>Visit jrmy.ch »</strong></a>
    <br />
    <br />
    <a href="https://github.com/swaiku/portfolio/issues">Report a bug</a>
  </p>

  [![License: AGPL-3.0][license-shield]][license-url]
</div>

<details>
  <summary>Table of contents</summary>
  <ol>
    <li><a href="#about-the-project">About the project</a>
      <ul><li><a href="#built-with">Built with</a></li></ul>
    </li>
    <li><a href="#getting-started">Getting started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#project-structure">Project structure</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About the project

The personal site of Swaiku: Master's student in Data Science at HES-SO in Lausanne, working on MLOps, UAV navigation and robotics. It extends my GitHub profile with a telemetry vocabulary ("Mission briefing", "Payload modules", "Active missions", "Transmission log") around a planet that is generated and rendered live in the browser.

- Every visit rolls a new world from a seed: rocky and gas planets, stars, pulsars, black holes, nebulae and comets. Collect them all in the Atlas.
- Terrain, atmosphere scattering, clouds and lensing are computed on the GPU with TSL shaders; no texture is downloaded.
- The render budget adapts to the device: quality tiers, adaptive resolution, and a CSS fallback when there is no usable GPU.
- All the facts about me live in [`src/data/site.ts`](src/data/site.ts).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built with

[![Astro][astro-shield]][astro-url]
[![Svelte][svelte-shield]][svelte-url]
[![Three.js][three-shield]][three-url]
[![TypeScript][ts-shield]][ts-url]
[![Tailwind CSS][tailwind-shield]][tailwind-url]
[![Bun][bun-shield]][bun-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started

### Prerequisites

- [Bun](https://bun.sh)
- A browser with WebGL 2 to see the planet (without it, the page shows a CSS stand-in)

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/swaiku/portfolio.git
   cd portfolio
   ```
2. Install the dependencies
   ```sh
   bun install
   ```
3. Start the dev server on <http://localhost:4321>
   ```sh
   bun run dev
   ```
4. Build the static site into `dist/` and preview it
   ```sh
   bun run build
   bun run preview
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

Query parameters for development:

| Parameter | Effect |
| --- | --- |
| `?debug` | Opens a tweak panel with a frame-rate graph and live controls |
| `?planet=B7B0A5` | Loads the world with this hexadecimal seed |
| `?kind=quasar` | Forces a class of world (`quasar`, `cold` and `singularity` are black holes) |
| `?bake=1024` | Overrides the texture size, useful on slow GPUs |
| `?gl` | Forces the WebGL 2 backend (WebGPU is used by default when the browser has it) |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project structure

```
src/
├── components/   Svelte islands: planet scene, HUD, Atlas
├── data/         Site content (profile, missions, skills)
├── layouts/      Base layout and meta tags
├── lib/planet/   World generation, baking and TSL shaders
├── pages/        The single page
└── styles/       Global CSS and design tokens
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

The code is licensed under the [GNU AGPL-3.0](LICENSE): you may use and modify it, but any modified version you run or distribute must be published under the same license, with credit.

The personal content is not covered by it and stays all rights reserved: the text and facts in [`src/data/site.ts`](src/data/site.ts), my CV information and the `public/og.jpg` image.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

[Swaiku](https://github.com/swaiku)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS -->
[license-shield]: https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge
[license-url]: LICENSE
[astro-shield]: https://img.shields.io/badge/Astro-0C0F1E?style=for-the-badge&logo=astro&logoColor=FF5D01
[astro-url]: https://astro.build
[svelte-shield]: https://img.shields.io/badge/Svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white
[svelte-url]: https://svelte.dev
[three-shield]: https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white
[three-url]: https://threejs.org
[ts-shield]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[ts-url]: https://www.typescriptlang.org
[tailwind-shield]: https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white
[tailwind-url]: https://tailwindcss.com
[bun-shield]: https://img.shields.io/badge/Bun-FBF0DF?style=for-the-badge&logo=bun&logoColor=black
[bun-url]: https://bun.sh
