/**
 * 機械種別・ポート定義・レシピ定義
 *
 * PortDef : 機械が持つポートの定義（型のみ、方向は inputPorts/outputPorts で暗黙）
 * RecipePortBinding : レシピがポートに割り当てるリソース
 * Recipe : 機械・入力・出力・電力・ティック
 */

import type { ResourceId, PortType } from "./resource.ts";

// ─── ポート定義 ───

/** 機械定義上のポート（方向は配列で暗黙決定） */
export interface PortDef {
  label: string;
  type: PortType;
}

// ─── レシピ ───

/** レシピのポートバインディング */
export interface RecipePortBinding {
  /** inputPorts[] / outputPorts[] 内のインデックス */
  portIndex: number;
  resourceId: ResourceId;
  amount: number;
}

export interface Recipe {
  /** このレシピを処理する機械の種別ID */
  machine: string;
  /** 入力ポートバインディング */
  inputs: RecipePortBinding[];
  /** 出力ポートバインディング */
  outputs: RecipePortBinding[];
  /** ティック毎の電力 (+消費 / -生産) */
  powerPerTick: number;
  /** 処理に必要なティック数 */
  ticks: number;
}

// ─── 機械種別 ───

export type MachineTypeId = string;

export interface MachineCategory {
  id: string;
  name: string;
  color: number;
}

export const MACHINE_CATEGORIES: MachineCategory[] = [
  { id: "extraction", name: "採掘", color: 0x4a90e2 },
  { id: "processing", name: "加工", color: 0xe2904a },
  { id: "power", name: "電力", color: 0xeedd22 },
  { id: "logistics", name: "物流", color: 0x4ae290 },
];

export interface MachineTypeDef {
  id: MachineTypeId;
  name: string;
  titleColor: number;
  category: string;
  width: number;
  height: number;
  /** 入力ポート定義（上から順） */
  inputPorts: PortDef[];
  /** 出力ポート定義（上から順） */
  outputPorts: PortDef[];
  /** 内部インベントリ容量 */
  inventoryCapacity: number;
}

// ─── 全機械定義 ───

export const MACHINE_TYPES: Record<string, MachineTypeDef> = {
  miner: {
    id: "miner",
    name: "採掘機",
    titleColor: 0x4a90e2,
    category: "extraction",
    width: 170,
    height: 200,
    inputPorts: [],
    outputPorts: [
      { label: "OUT 1", type: "item" },
      { label: "OUT 2", type: "item" },
    ],
    inventoryCapacity: 20,
  },

  furnace: {
    id: "furnace",
    name: "溶鉱炉",
    titleColor: 0xe2904a,
    category: "processing",
    width: 190,
    height: 220,
    inputPorts: [
      { label: "素材1", type: "item" },
      { label: "素材2", type: "item" },
      { label: "電力", type: "power" },
    ],
    outputPorts: [{ label: "製品", type: "item" }],
    inventoryCapacity: 30,
  },

  assembler: {
    id: "assembler",
    name: "組立機",
    titleColor: 0x9050cc,
    category: "processing",
    width: 190,
    height: 230,
    inputPorts: [
      { label: "素材1", type: "item" },
      { label: "素材2", type: "item" },
      { label: "素材3", type: "item" },
      { label: "電力", type: "power" },
    ],
    outputPorts: [
      { label: "製品1", type: "item" },
      { label: "製品2", type: "item" },
    ],
    inventoryCapacity: 30,
  },

  boiler: {
    id: "boiler",
    name: "ボイラー",
    titleColor: 0xcc5050,
    category: "power",
    width: 190,
    height: 220,
    inputPorts: [
      { label: "燃料", type: "item" },
      { label: "水", type: "liquid" },
    ],
    outputPorts: [{ label: "蒸気", type: "gas" }],
    inventoryCapacity: 40,
  },

  generator: {
    id: "generator",
    name: "蒸気発電機",
    titleColor: 0xeedd22,
    category: "power",
    width: 170,
    height: 200,
    inputPorts: [{ label: "蒸気", type: "gas" }],
    outputPorts: [{ label: "電力", type: "power" }],
    inventoryCapacity: 20,
  },

  storage: {
    id: "storage",
    name: "倉庫",
    titleColor: 0x4ae290,
    category: "logistics",
    width: 170,
    height: 220,
    inputPorts: [
      { label: "IN 1", type: "item" },
      { label: "IN 2", type: "item" },
      { label: "IN 3", type: "item" },
    ],
    outputPorts: [
      { label: "OUT 1", type: "item" },
      { label: "OUT 2", type: "item" },
      { label: "OUT 3", type: "item" },
    ],
    inventoryCapacity: 100,
  },

  tank: {
    id: "tank",
    name: "タンク",
    titleColor: 0x4488cc,
    category: "logistics",
    width: 170,
    height: 200,
    inputPorts: [
      { label: "IN 1", type: "liquid" },
      { label: "IN 2", type: "liquid" },
    ],
    outputPorts: [
      { label: "OUT 1", type: "liquid" },
      { label: "OUT 2", type: "liquid" },
    ],
    inventoryCapacity: 200,
  },

  gas_tank: {
    id: "gas_tank",
    name: "ガスタンク",
    titleColor: 0x88ccff,
    category: "logistics",
    width: 170,
    height: 200,
    inputPorts: [
      { label: "IN 1", type: "gas" },
      { label: "IN 2", type: "gas" },
    ],
    outputPorts: [
      { label: "OUT 1", type: "gas" },
      { label: "OUT 2", type: "gas" },
    ],
    inventoryCapacity: 200,
  },
};

// ─── 全レシピ ───

export const RECIPES: Recipe[] = [
  // ── 採掘機（入力なし → 出力） ──
  {
    machine: "miner",
    inputs: [],
    outputs: [{ portIndex: 0, resourceId: "rock", amount: 1 }],
    powerPerTick: 0,
    ticks: 3,
  },
  {
    machine: "miner",
    inputs: [],
    outputs: [{ portIndex: 0, resourceId: "iron_ore", amount: 1 }],
    powerPerTick: 0,
    ticks: 4,
  },
  {
    machine: "miner",
    inputs: [],
    outputs: [{ portIndex: 0, resourceId: "copper_ore", amount: 1 }],
    powerPerTick: 0,
    ticks: 4,
  },
  {
    machine: "miner",
    inputs: [],
    outputs: [{ portIndex: 0, resourceId: "coal", amount: 1 }],
    powerPerTick: 0,
    ticks: 5,
  },

  // ── 溶鉱炉 ──
  {
    machine: "furnace",
    inputs: [{ portIndex: 0, resourceId: "iron_ore", amount: 2 }],
    outputs: [{ portIndex: 0, resourceId: "iron", amount: 1 }],
    powerPerTick: 2,
    ticks: 4,
  },
  {
    machine: "furnace",
    inputs: [{ portIndex: 0, resourceId: "copper_ore", amount: 2 }],
    outputs: [{ portIndex: 0, resourceId: "copper", amount: 1 }],
    powerPerTick: 2,
    ticks: 4,
  },

  // ── 組立機 ──
  {
    machine: "assembler",
    inputs: [{ portIndex: 0, resourceId: "iron", amount: 2 }],
    outputs: [{ portIndex: 0, resourceId: "gear", amount: 1 }],
    powerPerTick: 3,
    ticks: 3,
  },
  {
    machine: "assembler",
    inputs: [
      { portIndex: 0, resourceId: "copper", amount: 1 },
      { portIndex: 1, resourceId: "gear", amount: 1 },
    ],
    outputs: [{ portIndex: 0, resourceId: "circuit", amount: 1 }],
    powerPerTick: 4,
    ticks: 5,
  },

  // ── ボイラー ──
  {
    machine: "boiler",
    inputs: [
      { portIndex: 0, resourceId: "coal", amount: 1 },
      { portIndex: 1, resourceId: "water", amount: 5 },
    ],
    outputs: [{ portIndex: 0, resourceId: "steam", amount: 10 }],
    powerPerTick: 0,
    ticks: 3,
  },

  // ── 蒸気発電機 ──
  {
    machine: "generator",
    inputs: [{ portIndex: 0, resourceId: "steam", amount: 5 }],
    outputs: [],
    powerPerTick: -10, // 負 = 発電
    ticks: 2,
  },
];

// ─── ユーティリティ ───

export function getRecipesForMachine(machineId: string): Recipe[] {
  return RECIPES.filter((r) => r.machine === machineId);
}

export function getMachinesByCategory(): Map<string, MachineTypeDef[]> {
  const map = new Map<string, MachineTypeDef[]>();
  for (const def of Object.values(MACHINE_TYPES)) {
    const list = map.get(def.category) ?? [];
    list.push(def);
    map.set(def.category, list);
  }
  return map;
}
