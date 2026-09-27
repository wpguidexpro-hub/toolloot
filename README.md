# ToollooT

ToollooT is a futuristic, installable browser toolbox built around focused mini-workspaces rather than a collection of plain forms.

## Product vision

ToollooT is designed to feel like a lightweight AI-era utility workspace:
- fast, guided and visually engaging
- desktop software-like workspaces and mobile app-like flows
- local-first browser processing wherever practical
- reusable components so every tool can share the same polished interaction model
- subtle AI-inspired motion and status feedback without pretending that a non-AI operation is AI
- recent-tool and session continuity stored locally in the user's browser when a feature explicitly supports it

## Current image capabilities

The image suite includes compressor, resizer, converter, cropper, background removal and format/size workflows. Image sources can include device files, drag/drop, camera, clipboard, direct image URL, folders, ZIP imports and screenshots where the browser supports them.

The Image Compressor uses IndexedDB for its optional local session continuity. Saved compressor sessions expire after one hour and can be cleared by the user. Files are not sent to a ToollooT server by this browser-local session feature.

## Technology

- React + Vite
- Lucide React icons
- SweetAlert2
- IndexedDB via idb-keyval
- JSZip
- FileSaver
- browser-image-compression
- pdf-lib
- Papa Parse
- HEIC conversion and browser image processing libraries
- PWA manifest + service worker

## Privacy model

ToollooT does not require an account for its basic tools. Browser-local features keep their state on the user's device. Any future network-backed feature must clearly explain what data it needs before use.

## Development

Install dependencies with: npm install

Start development server with: npm run dev

Create a production build with: npm run build

Preview the production build with: npm run preview

## Design principles

1. One obvious next action.
2. Show useful feedback immediately.
3. Keep advanced controls available without making them mandatory.
4. Make results measurable: size, dimensions, savings or output format.
5. Preserve user work locally when a tool supports session recovery.
6. Prefer free/open-source browser libraries over paid third-party services when practical.
7. Respect reduced-motion preferences and responsive accessibility.

## Repository

The project is maintained as the ToollooT web application and is intended to grow through reusable tool components rather than one-off page implementations.
