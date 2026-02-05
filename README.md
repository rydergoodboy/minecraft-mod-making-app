# ModMint - Minecraft Mod Making App

ModMint is a standalone web app where users type a simple idea and get a generated Minecraft Fabric mod starter project as a downloadable `.zip`.

## Features
- Takes plain-language mod concepts.
- Lets users select a mod type (biome, mob, structure, item, block, etc.).
- Auto-detects keywords and turns them into starter items/blocks.
- Generates a complete mod scaffold (`fabric.mod.json`, Java classes, gradle files, README).
- Downloads everything as one zip with one click.

## Run locally
Because this app is pure HTML/CSS/JS, you can run it with any static server:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Notes
- This app generates a starter mod app template, which you can expand with textures, recipes, and gameplay logic.
- Generated output targets Fabric + Java 17 conventions.
