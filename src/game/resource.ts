/**
 * リソース＋ポートタイプ定義
 *
 * - ResourceType: 保管可能なリソースの種類 (item / liquid / gas)
 * - PortType:     ポートの物理タイプ (item / liquid / gas / power)
 *   ※ power は保管不可だがポート接続で使う
 */

/** リソースの種類（保管可能） */
export type ResourceType = "item" | "liquid" | "gas";

/** ポートの物理タイプ（power を含む） */
export type PortType = "item" | "liquid" | "gas" | "power";

/** リソースID */
export type ResourceId = string;

/** リソーススタック（レシピ・インベントリ共通） */
export interface ResourceStack {
  resourceId: ResourceId;
  amount: number;
}

/** リソース定義 */
export interface ResourceDef {
  id: ResourceId;
  name: string;
  type: ResourceType;
  /** 画像パス（アイテム用、オプション） */
  png?: string;
  /** カラーコード（全タイプ共通、オプション） */
  color?: number;
}

// ─── 全リソース定義 ───

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  // --- アイテム ---
  rock: { id: "rock", name: "岩", type: "item", color: 0x888888 },
  stone: { id: "stone", name: "石", type: "item", color: 0xaaaaaa },
  iron_ore: { id: "iron_ore", name: "鉄鉱石", type: "item", color: 0xb87333 },
  iron: { id: "iron", name: "鉄", type: "item", color: 0xcccccc },
  copper_ore: {
    id: "copper_ore",
    name: "銅鉱石",
    type: "item",
    color: 0xd4a574,
  },
  copper: { id: "copper", name: "銅", type: "item", color: 0xb87333 },
  gear: { id: "gear", name: "歯車", type: "item", color: 0xdddddd },
  circuit: { id: "circuit", name: "回路", type: "item", color: 0x44cc44 },
  coal: { id: "coal", name: "石炭", type: "item", color: 0x333333 },

  // --- 液体 ---
  water: { id: "water", name: "水", type: "liquid", color: 0x4488ff },
  oil: { id: "oil", name: "原油", type: "liquid", color: 0x222222 },
  acid: { id: "acid", name: "硫酸", type: "liquid", color: 0xcccc00 },

  // --- 気体 ---
  steam: { id: "steam", name: "蒸気", type: "gas", color: 0xdddddd },
  oxygen: { id: "oxygen", name: "酸素", type: "gas", color: 0x88ccff },
};

// ─── ユーティリティ ───

export function getResourceName(id: ResourceId): string {
  return RESOURCES[id]?.name ?? id;
}

export function getResourceColor(id: ResourceId): number {
  return RESOURCES[id]?.color ?? 0x888888;
}

export function getResourceType(id: ResourceId): ResourceType | undefined {
  return RESOURCES[id]?.type;
}

/** ResourceType → PortType 変換（同名なのでそのままキャスト） */
export function resourceTypeToPortType(rt: ResourceType): PortType {
  return rt as PortType;
}

/** PortType のデフォルトカラー（リソース未割当時に使う） */
export function getPortTypeColor(pt: PortType): number {
  switch (pt) {
    case "item":
      return 0x888888;
    case "liquid":
      return 0x4488ff;
    case "gas":
      return 0x88ccff;
    case "power":
      return 0xeedd22;
  }
}

/** PortType の日本語名 */
export function getPortTypeName(pt: PortType): string {
  switch (pt) {
    case "item":
      return "アイテム";
    case "liquid":
      return "液体";
    case "gas":
      return "気体";
    case "power":
      return "電力";
  }
}
