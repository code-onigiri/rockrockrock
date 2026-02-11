import { Application } from "pixi.js";
import { createScrollableWorld } from "./scrollableWorld.ts";
import { DraggableNode } from "./node.ts";

(async () => {
  // Create a new application
  const app = new Application();
  // NOTE :気にしないほうが幸せなエラー
  globalThis.__PIXI_APP__ = app;

  // Initialize the application
  await app.init({
    background: "#1099bb",
    resizeTo: window,
    eventMode: "static",
  });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  const { world, addItem } = createScrollableWorld(app);

  // ノードを作成
  const node1 = new DraggableNode({
    x: 100,
    y: 100,
    title: "Node 1",
  });

  const node2 = new DraggableNode({
    x: 250,
    y: 150,
    title: "Node 2",
  });

  // worldに追加
  addItem(node1);
  addItem(node2);
})();
