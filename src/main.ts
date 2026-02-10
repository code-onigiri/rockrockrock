import { Application } from "pixi.js";
import { createScrollableWorld } from "./scrollableWorld.ts";
import { NodeManager } from "./nodeManager.ts";
import { MACHINE_TYPES, getRecipesForMachine } from "./game/nodeTypes.ts";
import { createGameNode } from "./game/nodeFactory.ts";
import { TickEngine } from "./game/tickEngine.ts";
import { MachinePalette } from "./palette.ts";
import { getResourceName } from "./game/resource.ts";

(async () => {
  const app = new Application();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__PIXI_APP__ = app;

  await app.init({
    background: "#1099bb",
    resizeTo: window,
    eventMode: "static",
  });

  document.getElementById("pixi-container")!.appendChild(app.canvas);

  const { world, gridSizeX, gridSizeY } = createScrollableWorld(app, {
    gridSizeX: 50,
    gridSizeY: 50,
  });

  // ── エンジン・マネージャ初期化 ──
  const tickEngine = new TickEngine();
  const manager = new NodeManager(world, { gridSizeX, gridSizeY });

  /** レシピ表示名を取得 */
  const getRecipeLabel = (nodeId: string): string => {
    const state = tickEngine.states.get(nodeId);
    if (!state) return "";
    const recipes = getRecipesForMachine(state.machineTypeId);
    const idx = state.selectedRecipeIndex;
    if (idx < 0 || idx >= recipes.length) return "自動";
    const r = recipes[idx];
    return r.outputs.map((o) => getResourceName(o.resourceId)).join("+") || "—";
  };

  /** ゲームノード追加ヘルパー */
  const addGameNode = (typeId: string, x: number, y: number) => {
    const def = MACHINE_TYPES[typeId];
    if (!def) throw new Error(`Unknown machine type: ${typeId}`);

    const nodeData = createGameNode(def, x, y);
    const view = manager.addNode(nodeData);
    tickEngine.registerNode(nodeData, typeId);

    // レシピ切り替えコールバック
    view.onRecipeChange = (_node, delta) => {
      const state = tickEngine.states.get(nodeData.id);
      if (!state) return;
      const recipes = getRecipesForMachine(state.machineTypeId);
      if (recipes.length === 0) return;

      // -1(自動) → 0 → 1 → ... → N-1 → -1 (ループ)
      let idx = state.selectedRecipeIndex;
      idx += delta;
      if (idx >= recipes.length) idx = -1;
      if (idx < -1) idx = recipes.length - 1;

      tickEngine.setSelectedRecipe(nodeData.id, idx);

      // ポートにリソース情報を反映
      if (idx >= 0) {
        const recipe = recipes[idx];
        view.updatePortResources(recipe.inputs, recipe.outputs);
      } else {
        // 自動モード: リソース割り当てクリア
        view.updatePortResources([], []);
      }

      // 表示名を更新
      const name =
        idx < 0
          ? "自動"
          : recipes[idx].outputs
              .map((o) => getResourceName(o.resourceId))
              .join("+") || "—";
      view.updateDisplay({
        inputStacks: state.inputInventory.toStacks(),
        outputStacks: state.outputInventory.toStacks(),
        isProcessing: state.activeRecipe !== null,
        progress: 0,
        totalTicks: 0,
        currentTick: 0,
        powerConsumed: 0,
        powerProduced: 0,
        recipeName: name,
      });
    };

    return nodeData;
  };

  // ── ロード or デモデータ ──
  const loaded = manager.load();
  if (!loaded) {
    // デモ: 採掘機(iron_ore) → 溶鉱炉(iron) → 倉庫
    const miner = addGameNode("miner", 100, 100);
    const furnace = addGameNode("furnace", 350, 100);
    const storage = addGameNode("storage", 600, 150);

    // 採掘機: iron_ore レシピを選択 (index=1)
    const minerRecipes = getRecipesForMachine("miner");
    tickEngine.setSelectedRecipe(miner.id, 1); // iron_ore
    const minerView = manager.getNodeView(miner.id);
    if (minerView && minerRecipes[1]) {
      minerView.updatePortResources(
        minerRecipes[1].inputs,
        minerRecipes[1].outputs,
      );
    }

    // 溶鉱炉: iron_ore → iron レシピを選択 (index=0)
    const furnaceRecipes = getRecipesForMachine("furnace");
    tickEngine.setSelectedRecipe(furnace.id, 0); // iron_ore → iron
    const furnaceView = manager.getNodeView(furnace.id);
    if (furnaceView && furnaceRecipes[0]) {
      furnaceView.updatePortResources(
        furnaceRecipes[0].inputs,
        furnaceRecipes[0].outputs,
      );
    }

    // デモ用: 初期インベントリにサンプルアイテムを追加（スロット表示確認）
    const minerState = tickEngine.states.get(miner.id);
    if (minerState) {
      minerState.outputInventory.add("iron_ore", 3);
    }
    const furnaceState = tickEngine.states.get(furnace.id);
    if (furnaceState) {
      furnaceState.inputInventory.add("iron_ore", 5);
    }
    const storageState = tickEngine.states.get(storage.id);
    if (storageState) {
      storageState.inputInventory.add("iron", 2);
    }

    // 採掘機の OUT1 → 溶鉱炉の 素材1 を接続
    const minerOut = miner.outputs[0];
    const furnaceIn = furnace.inputs[0];
    if (minerOut && furnaceIn) {
      manager.connect(miner.id, minerOut.id, furnace.id, furnaceIn.id);
    }

    // 溶鉱炉の 製品 → 倉庫の IN1 を接続
    const furnaceOut = furnace.outputs[0];
    const storageIn = storage.inputs[0];
    if (furnaceOut && storageIn) {
      manager.connect(furnace.id, furnaceOut.id, storage.id, storageIn.id);
    }
  } else {
    // 保存データからゲーム状態を復元
    for (const nd of manager.nodes) {
      if (nd.machineTypeId) {
        tickEngine.registerNode(nd, nd.machineTypeId);
      }
    }
  }

  // ── ティックコールバック: 表示更新 ──
  tickEngine.onTick = () => {
    for (const nd of manager.nodes) {
      const view = manager.getNodeView(nd.id);
      const state = tickEngine.states.get(nd.id);
      if (!view || !state) continue;

      const progress =
        state.activeRecipe && state.activeRecipe.ticks > 0
          ? state.processingProgress / state.activeRecipe.ticks
          : 0;

      view.updateDisplay({
        inputStacks: state.inputInventory.toStacks(),
        outputStacks: state.outputInventory.toStacks(),
        isProcessing: state.activeRecipe !== null,
        progress,
        totalTicks: state.activeRecipe?.ticks ?? 0,
        currentTick: state.processingProgress,
        powerConsumed: state.powerConsumed,
        powerProduced: state.powerProduced,
        recipeName: getRecipeLabel(nd.id),
      });
    }
  };

  // ── ティック駆動（1秒間隔） ──
  setInterval(() => {
    tickEngine.tick(manager.connections, manager.nodes);
  }, 1000);

  // ── キーボードショートカット ──
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      manager.save();
    }
  });

  // ── 下部パレットUI ──
  const palette = new MachinePalette();
  palette.onDrop = (evt) => {
    const worldX = (evt.screenX - world.position.x) / world.scale.x;
    const worldY = (evt.screenY - world.position.y) / world.scale.y;
    addGameNode(evt.machineType.id, worldX, worldY);
  };
})();
