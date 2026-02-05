# Copilot Instructions for rockrockrock

## First You must follow this

- **会話の区切りでは必ず `ask_user` を提示**し、次のアクション（複数可）と自由入力を受け取ること。会話を勝手に終了しない。
- **短く、事実ベースで簡潔に回答**すること。不要な長話や推測は避ける。
- **名前は `GitHub Copilot`、モデルは `Raptor mini (Preview)` と答える**（必要に応じて）。

## Project Overview

This is an idle/incremental game built with PixiJS v8.8.1 and TypeScript. The game concept revolves around processing rocks into various items (Factorio-style incremental mechanics). The project serves dual purposes: creating the game and practicing PixiJS development.

## Build, Test, and Lint Commands

```bash
# Development server with hot reload
pnpm dev
# Or: npm run dev (which is aliased to dev)
npm start

# Build for production (runs lint + TypeScript check + Vite build)
pnpm build

# Lint only
pnpm lint
```

## Key Conventions

### PixiJS Patterns

1. **Adding items to the world**: Always use `addItem()` or `addItems()` helpers instead of `world.addChild()` directly. These helpers automatically set `eventMode = "static"` which is required for proper event handling.

   ```typescript
   // ✅ Correct
   addItem(sprite);
   addItems(sprite1, sprite2, sprite3);
   
   // ❌ Avoid
   world.addChild(sprite);
   ```

2. **Global PixiJS app reference**: The application instance is exposed globally as `globalThis.__PIXI_APP__` for debugging purposes.

3. **Event handling**: Interactive elements need `eventMode = "static"` to be detectable as event targets (prevents drag-through issues).

4. **Grid rendering**: Grid uses `pixelLine: true` for crisp 1px lines at any zoom level.

### Code Style

- TypeScript with strict mode enabled (`strict: true` in tsconfig)
- Unused locals/parameters are errors (`noUnusedLocals`, `noUnusedParameters`)
- ESLint with TypeScript and Prettier integration
- Module system: ES Modules (`"type": "module"` in package.json)


### Technical Notes (from AI_MEMOs.md)

- Grid system: Update `grid.width/height` on renderer resize for responsive grids
- Drag prevention: Check `event.target` in stage's `pointerdown` handler
- Interactive items: Set `eventMode = "static"` on all clickable elements
- Use helper functions to enforce conventions automatically

## File Organization

```
src/
  main.ts              # Application entry point
  scrollableWorld.ts   # Drag-to-pan world with grid
public/
  assets/             # Game assets (images, etc.)
  style.css           # Global styles
  favicon.png
index.html            # HTML entry point with #pixi-container
```

## Language

Project documentation is in Japanese (README, comments may be mixed Japanese/English).
