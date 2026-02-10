/**
 * ティックエンジン — 毎ティックごとにリソース搬送＋レシピ処理＋電力計算
 *
 * 処理順:
 *   Phase 0: 電力計算（power ポート経由の接続で需給バランス）
 *   Phase 1: 搬送（output inventory → 接続先 input inventory）
 *            搬送量: item=1個, liquid=10, gas=10 (powerポートは搬送なし)
 *   Phase 2: 加工（レシピ実行、電力充足チェック後）
 *
 * RecipePortBinding を通じてレシピがポートにリソースを割り当てる。
 * 倉庫・タンクなど「バッファ機械」はレシピなしで動作する。
 */

import { Inventory } from "./inventory.ts";
import type { Recipe } from "./nodeTypes.ts";
import { getRecipesForMachine, MACHINE_TYPES } from "./nodeTypes.ts";
import type { NodeData, ConnectionData, PortData } from "../nodeData.ts";
import { RESOURCES } from "./resource.ts";

/** ノード1つぶんのランタイム状態 */
export interface NodeGameState {
  inputInventory: Inventory;
  outputInventory: Inventory;
  activeRecipe: Recipe | null;
  processingProgress: number;
  machineTypeId: string;
  /** 直近ティックの消費電力 */
  powerConsumed: number;
  /** 直近ティックの生産電力 */
  powerProduced: number;
  /** 選択中のレシピインデックス（-1 = 自動） */
  selectedRecipeIndex: number;
  /** 電力供給状態 */
  powerSatisfied: boolean;
}

/** ティックエンジン全体の電力統計 */
export interface PowerStats {
  totalConsumed: number;
  totalProduced: number;
  balance: number;
}

/** 搬送量テーブル */
const TRANSPORT_AMOUNT: Record<string, number> = {
  item: 1,
  liquid: 10,
  gas: 10,
  power: 0, // powerポートは搬送しない
};

export class TickEngine {
  public states = new Map<string, NodeGameState>();
  public tickCount = 0;
  public powerStats: PowerStats = {
    totalConsumed: 0,
    totalProduced: 0,
    balance: 0,
  };

  public onTick?: () => void;

  // ─── 登録 ───

  registerNode(nodeData: NodeData, machineTypeId: string) {
    const def = MACHINE_TYPES[machineTypeId];
    const cap = def?.inventoryCapacity ?? 20;
    this.states.set(nodeData.id, {
      inputInventory: new Inventory(cap),
      outputInventory: new Inventory(cap),
      activeRecipe: null,
      processingProgress: 0,
      machineTypeId,
      powerConsumed: 0,
      powerProduced: 0,
      selectedRecipeIndex: -1,
      powerSatisfied: true,
    });
  }

  unregisterNode(nodeId: string) {
    this.states.delete(nodeId);
  }

  // ─── ティック実行 ───

  tick(connections: ConnectionData[], nodes: NodeData[]) {
    this.tickCount++;

    // 電力統計リセット
    let totalConsumed = 0;
    let totalProduced = 0;
    for (const state of this.states.values()) {
      state.powerConsumed = 0;
      state.powerProduced = 0;
    }

    // Phase 0: 電力計算
    this.powerPhase(connections, nodes);

    // Phase 1: 搬送
    this.transportPhase(connections, nodes);

    // Phase 2: 処理
    this.processPhase(nodes);

    // 電力集計
    for (const state of this.states.values()) {
      totalConsumed += state.powerConsumed;
      totalProduced += state.powerProduced;
    }
    this.powerStats = {
      totalConsumed,
      totalProduced,
      balance: totalProduced - totalConsumed,
    };

    this.onTick?.();
  }

  // ─── Phase 0: 電力計算 ───

  private powerPhase(connections: ConnectionData[], nodes: NodeData[]) {
    // 各ノードが power-out から出す電力量を計算
    // 発電機が稼働中（activeRecipeあり or powerPerTick<0 のレシピ選択中）= 発電
    // power接続経由で需要ノードに供給

    // ノードごとの電力供給量を集計
    const powerSupply = new Map<string, number>();

    for (const nd of nodes) {
      const state = this.states.get(nd.id);
      if (!state) continue;

      // 発電量: 進行中レシピの powerPerTick が負なら発電
      if (state.activeRecipe && state.activeRecipe.powerPerTick < 0) {
        const generated = Math.abs(state.activeRecipe.powerPerTick);
        state.powerProduced = generated;
        powerSupply.set(nd.id, generated);
      }
    }

    // power接続を辿り、各消費ノードに供給量を伝搬
    const powerReceived = new Map<string, number>();
    for (const conn of connections) {
      const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
      if (!fromNode) continue;

      const fromPort = fromNode.outputs.find((p) => p.id === conn.fromPortId);
      if (!fromPort || fromPort.portType !== "power") continue;

      // power接続: fromの発電量をtoに加算
      const supply = powerSupply.get(conn.fromNodeId) ?? 0;
      powerReceived.set(
        conn.toNodeId,
        (powerReceived.get(conn.toNodeId) ?? 0) + supply,
      );
    }

    // 各ノードの電力充足状態を設定
    for (const nd of nodes) {
      const state = this.states.get(nd.id);
      if (!state) continue;

      // 必要電力: レシピ選択中のpowerPerTick (正の値 = 消費)
      const recipes = getRecipesForMachine(state.machineTypeId);
      let requiredPower = 0;

      if (state.activeRecipe && state.activeRecipe.powerPerTick > 0) {
        requiredPower = state.activeRecipe.powerPerTick;
      } else if (state.selectedRecipeIndex >= 0) {
        const r = recipes[state.selectedRecipeIndex];
        if (r && r.powerPerTick > 0) requiredPower = r.powerPerTick;
      }

      if (requiredPower <= 0) {
        state.powerSatisfied = true; // 電力不要 or 発電機
      } else {
        // powerポートが存在するかチェック
        const hasPowerIn = nd.inputs.some((p) => p.portType === "power");
        if (!hasPowerIn) {
          state.powerSatisfied = true; // powerポートなし → 電力不要扱い
        } else {
          const received = powerReceived.get(nd.id) ?? 0;
          state.powerSatisfied = received >= requiredPower;
          if (state.powerSatisfied) {
            state.powerConsumed = requiredPower;
          }
        }
      }
    }
  }

  // ─── Phase 1: 搬送 ───

  private transportPhase(connections: ConnectionData[], nodes: NodeData[]) {
    for (const conn of connections) {
      const fromState = this.states.get(conn.fromNodeId);
      const toState = this.states.get(conn.toNodeId);
      if (!fromState || !toState) continue;

      // ポート情報を取得
      const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
      const toNode = nodes.find((n) => n.id === conn.toNodeId);
      if (!fromNode || !toNode) continue;

      const fromPort = fromNode.outputs.find((p) => p.id === conn.fromPortId);
      if (!fromPort) continue;

      // powerポートは搬送しない
      if (fromPort.portType === "power") continue;

      const amount = TRANSPORT_AMOUNT[fromPort.portType] ?? 1;

      // ポートに resourceId が割り当てられている場合:
      //   そのリソースのみ搬送
      // 割り当てられていない場合（倉庫等）:
      //   出力インベントリの最初のリソースを搬送
      if (fromPort.resourceId) {
        this.transportResource(fromState, toState, fromPort.resourceId, amount);
      } else {
        // 汎用搬送: PortType に合うリソースを搬送
        const stacks = fromState.outputInventory.toStacks();
        for (const stack of stacks) {
          if (this.isResourceCompatible(stack.resourceId, fromPort)) {
            this.transportResource(
              fromState,
              toState,
              stack.resourceId,
              amount,
            );
            break; // 1コネクションにつき1種類
          }
        }
      }
    }
  }

  private transportResource(
    from: NodeGameState,
    to: NodeGameState,
    resourceId: string,
    amount: number,
  ) {
    const available = from.outputInventory.getAmount(resourceId);
    const toTransport = Math.min(available, amount);
    if (toTransport <= 0) return;
    const added = to.inputInventory.add(resourceId, toTransport);
    if (added > 0) {
      from.outputInventory.remove(resourceId, added);
    }
  }

  /** リソースがポートのPortTypeと互換かチェック */
  private isResourceCompatible(resourceId: string, port: PortData): boolean {
    const resDef = RESOURCES[resourceId];
    if (!resDef) return false;
    return resDef.type === port.portType;
  }

  // ─── Phase 2: 処理 ───

  private processPhase(nodes: NodeData[]) {
    for (const nodeData of nodes) {
      const state = this.states.get(nodeData.id);
      if (!state) continue;

      // バッファ機械（倉庫・タンク等）: inputからoutputへ自動転送
      const recipes = getRecipesForMachine(state.machineTypeId);
      if (recipes.length === 0) {
        this.bufferTransfer(state);
        continue;
      }

      // 処理中レシピの進捗
      if (state.activeRecipe) {
        // 電力不足なら一時停止
        if (state.activeRecipe.powerPerTick > 0 && !state.powerSatisfied) {
          continue;
        }

        state.processingProgress++;
        if (state.activeRecipe.powerPerTick > 0) {
          state.powerConsumed = state.activeRecipe.powerPerTick;
        } else if (state.activeRecipe.powerPerTick < 0) {
          state.powerProduced = Math.abs(state.activeRecipe.powerPerTick);
        }

        if (state.processingProgress >= state.activeRecipe.ticks) {
          // 完了 → 出力インベントリに追加
          for (const out of state.activeRecipe.outputs) {
            state.outputInventory.add(out.resourceId, out.amount);
          }
          state.activeRecipe = null;
          state.processingProgress = 0;
        }
        continue;
      }

      // 新しいレシピを探して開始
      const candidateRecipes =
        state.selectedRecipeIndex >= 0 &&
        state.selectedRecipeIndex < recipes.length
          ? [recipes[state.selectedRecipeIndex]]
          : recipes;

      for (const recipe of candidateRecipes) {
        // 電力消費レシピなら電力チェック
        if (recipe.powerPerTick > 0 && !state.powerSatisfied) continue;

        // 入力材料チェック
        if (this.hasRecipeInputs(state, recipe)) {
          this.consumeRecipeInputs(state, recipe);
          state.activeRecipe = recipe;
          state.processingProgress = 0;
          break;
        }
      }
    }
  }

  /** バッファ機械: input→output自動転送 */
  private bufferTransfer(state: NodeGameState) {
    const stacks = state.inputInventory.toStacks();
    for (const stack of stacks) {
      const toTransfer = Math.min(stack.amount, 5);
      const added = state.outputInventory.add(stack.resourceId, toTransfer);
      if (added > 0) {
        state.inputInventory.remove(stack.resourceId, added);
      }
    }
  }

  /** レシピ入力材料があるか */
  private hasRecipeInputs(state: NodeGameState, recipe: Recipe): boolean {
    if (recipe.inputs.length === 0) return true;
    return recipe.inputs.every((b) =>
      state.inputInventory.has(b.resourceId, b.amount),
    );
  }

  /** レシピ入力材料を消費 */
  private consumeRecipeInputs(state: NodeGameState, recipe: Recipe): void {
    for (const b of recipe.inputs) {
      state.inputInventory.remove(b.resourceId, b.amount);
    }
  }

  /** ノードのレシピ選択を変更 (-1 = 自動) */
  setSelectedRecipe(nodeId: string, recipeIndex: number) {
    const state = this.states.get(nodeId);
    if (!state) return;
    state.selectedRecipeIndex = recipeIndex;
    if (state.activeRecipe) {
      state.activeRecipe = null;
      state.processingProgress = 0;
    }
  }

  /** 全状態クリア */
  clearAll() {
    this.states.clear();
    this.tickCount = 0;
    this.powerStats = { totalConsumed: 0, totalProduced: 0, balance: 0 };
  }
}
