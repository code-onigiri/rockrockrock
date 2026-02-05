import { Application, Assets, Sprite } from "pixi.js";
import { createScrollableWorld } from "./scrollableWorld.ts";

(async () => {
  // Create a new application
  const app = new Application();

  globalThis.__PIXI_APP__ = app;

  // Initialize the application
  await app.init({
    background: "#1099bb",
    resizeTo: window,
    eventMode: "static",
  });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  const { world, addItem, addItems } = createScrollableWorld(app);

  // Load the bunny texture
  const texture = await Assets.load("/assets/bunny.png");

  // Create a bunny Sprite
  const bunny = new Sprite(texture);

  // Center the sprite's anchor point
  bunny.anchor.set(0.5);

  // Move the sprite to the center of the screen
  bunny.position.set(app.screen.width / 2, app.screen.height / 2);

  // addItemを使用してworldに追加（eventModeは自動設定される）
  addItem(bunny);

  // 複数のアイテムを一括で追加する場合は addItems を使用
  // 例: addItems(bunny1, bunny2, bunny3);

  // Listen for animate update
  app.ticker.add((time) => {
    // Just for fun, let's rotate mr rabbit a little.
    // * Delta is 1 if running at 100% performance *
    // * Creates frame-independent transformation *
    bunny.rotation += 0.1 * time.deltaTime;
  });
})();
