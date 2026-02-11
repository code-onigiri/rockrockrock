import { Application } from "pixi.js";
import { createScrollableWorld } from "./scrollableWorld.ts";
import { DraggableNode } from "./node.ts";

const init = async () => {
  const app = new Application();
  const debugGlobal = globalThis as typeof globalThis & {
    __PIXI_APP__?: Application;
  };
  debugGlobal.__PIXI_APP__ = app;

  await app.init({
    background: "#1099bb",
    resizeTo: window,
    eventMode: "static",
  });

  document.getElementById("pixi-container")!.appendChild(app.canvas);

  const { addItems } = createScrollableWorld(app);
  addItems(
    new DraggableNode({ cols: 3, rows: 2, title: "Node 1" }),
    new DraggableNode({ cols: 2, rows: 4, title: "Node 2" }),
  );
};

void init();
