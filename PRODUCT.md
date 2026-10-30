# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro + Svelte (islands) + Tailwind + Three.js, Bun. Chosen by the user. Static build; host undecided (Cloudflare Pages, GitHub Pages or the user's Raspberry Pi 5 homelab).

## Users

Recruiters and hiring managers (data science, ML/MLOps, robotics) who skim a personal site for a few minutes to judge Jérémy's profile, projects and skills.

## Product Purpose

Personal website of Jérémy ("swaiku"), Master's student in Data Science at HES-SO (Fribourg, Switzerland), Bachelor in Data Engineering (HEIA-FR). Goal: land internships, jobs and collaborations by presenting profile, projects and skills memorably.

## Positioning

A mission-control site, not a CV template: it extends his GitHub profile README (telemetry vocabulary, sections "Mission briefing", "Payload modules", "Active missions", "Off duty", "Transmission log") around a real-time procedural planet.

## Operating Context

English-only. Static site. Visitors on desktop and phone; the WebGL planet must degrade gracefully (reduced motion, no WebGL, low-power devices).

## Capabilities and Constraints

- Stack: Python, C++, TypeScript, JavaScript, Go; ROS, Raspberry Pi, Linux, Git, GitHub, GitLab; PyTorch, scikit-learn, MySQL, Docker; Astro, Svelte, Tailwind, Bun, Godot, Obsidian.
- Active: Master's (MLOps and cloud systems), UAV autonomous navigation research, self-hosted Raspberry Pi 5 homelab, archery club website and media, running/endurance.
- Eurobot robotics competitions alumni. Interests: space exploration, robotics, privacy, open source, Formula 1, gaming, archery.
- Planet: ultra-realistic procedural Three.js (atmosphere scattering, clouds, night lights, normal-mapped terrain), no heavy texture downloads required.

## Brand Commitments

Space / mission-control theme matching github.com/swaiku. Dark backgrounds (#0b0f2a, #1a1040 badges), monospace telemetry formatting, space-agency language. Binding per the user.

## Evidence on Hand

Only the GitHub profile text above. No real project links, CV, photo, testimonials or contact details were provided: demo project entries must be labelled as placeholders; never invent employers, metrics or publications.

## Product Principles

1. The planet is the first impression; content must still be readable within seconds.
2. Telemetry language flavors the labels but never hides real information.
3. Only claim what is true about Jérémy; placeholders are labelled.
4. Performance and accessibility are part of the craft (reduced motion, no-WebGL fallback).

## Accessibility & Inclusion

Respect prefers-reduced-motion; text contrast over the 3D scene meets WCAG AA; full keyboard navigation; WebGL canvas is decorative (aria-hidden) with a static fallback.
