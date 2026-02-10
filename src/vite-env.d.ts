/// <reference types="vite/client" />

declare global {
  // biome-ignore lint: Pixi DevTools convention

  var __PIXI_APP__: import("pixi.js").Application | undefined;
}
export {};
