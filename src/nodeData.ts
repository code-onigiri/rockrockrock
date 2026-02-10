/**
 * ノード・ポート・コネクションのデータモデル
 *
 * PortData.portType : ポートの物理タイプ（item/liquid/gas/power）— 機械定義から設定
 * PortData.resourceId : レシピで割り当てられた具体的なリソースID（オプション）
 */

import type { PortType } from "./game/resource.ts";

// ─── ポート ───

export type PortDirection = "input" | "output";

export interface PortData {
  id: string;
  name: string;
  direction: PortDirection;
  /** ポートの物理タイプ（item/liquid/gas/power） */
  portType: PortType;
  /** レシピで割り当てられたリソースID（未割当なら undefined） */
  resourceId?: string;
}

// ─── ノード ───

export interface NodeData {
  id: string;
  x: number;
  y: number;
  title: string;
  width: number;
  height: number;
  titleColor: number;
  inputs: PortData[];
  outputs: PortData[];
  /** 機械種別ID（ゲームロジック用） */
  machineTypeId?: string;
}

// ─── コネクション ───

export interface ConnectionData {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

// ─── IDジェネレータ ───

let _nodeIdCounter = 0;
let _portIdCounter = 0;
let _connectionIdCounter = 0;

export function generateNodeId(): string {
  return `node_${++_nodeIdCounter}`;
}
export function generatePortId(): string {
  return `port_${++_portIdCounter}`;
}
export function generateConnectionId(): string {
  return `conn_${++_connectionIdCounter}`;
}

// ─── ファクトリ ───

export function createPort(
  name: string,
  direction: PortDirection,
  portType: PortType,
  resourceId?: string,
): PortData {
  return {
    id: generatePortId(),
    name,
    direction,
    portType,
    resourceId,
  };
}

export function createNodeData(
  opts: Partial<NodeData> & { title: string },
): NodeData {
  return {
    id: opts.id ?? generateNodeId(),
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    title: opts.title,
    width: opts.width ?? 100,
    height: opts.height ?? 150,
    titleColor: opts.titleColor ?? 0x4a90e2,
    inputs: opts.inputs ?? [],
    outputs: opts.outputs ?? [],
    machineTypeId: opts.machineTypeId,
  };
}

export function createConnectionData(
  fromNodeId: string,
  fromPortId: string,
  toNodeId: string,
  toPortId: string,
): ConnectionData {
  return {
    id: generateConnectionId(),
    fromNodeId,
    fromPortId,
    toNodeId,
    toPortId,
  };
}

// ─── シリアライズ / デシリアライズ ───

export interface GraphSaveData {
  nodes: NodeData[];
  connections: ConnectionData[];
}

export function serializeGraph(
  nodes: NodeData[],
  connections: ConnectionData[],
): string {
  return JSON.stringify({ nodes, connections } satisfies GraphSaveData);
}

export function deserializeGraph(json: string): GraphSaveData {
  const data = JSON.parse(json) as GraphSaveData;

  let maxNode = 0;
  let maxPort = 0;
  let maxConn = 0;

  for (const n of data.nodes) {
    const num = parseInt(n.id.replace("node_", ""), 10);
    if (!isNaN(num) && num > maxNode) maxNode = num;
    for (const p of [...n.inputs, ...n.outputs]) {
      const pn = parseInt(p.id.replace("port_", ""), 10);
      if (!isNaN(pn) && pn > maxPort) maxPort = pn;
    }
  }
  for (const c of data.connections) {
    const cn = parseInt(c.id.replace("conn_", ""), 10);
    if (!isNaN(cn) && cn > maxConn) maxConn = cn;
  }

  _nodeIdCounter = Math.max(_nodeIdCounter, maxNode);
  _portIdCounter = Math.max(_portIdCounter, maxPort);
  _connectionIdCounter = Math.max(_connectionIdCounter, maxConn);

  return data;
}
