/**
 * ノード・コネクション一元管理マネージャ
 *
 * レイヤー構造（world の子要素順）:
 *   [0] connectionLayer  — コネクション線（ノードの**背面**）
 *   [1] nodeLayer         — ノード群（手前）
 *   [2] tempLineGraphics  — ドラッグ中の仮線（最前面）
 *
 * 接続ルール（3段階）:
 *   ① PortType 一致: item↔item, liquid↔liquid, gas↔gas, power↔power
 *   ② 方向チェック: output → input のみ
 *   ③ リソース互換:
 *      - 両方 resourceId あり → 一致必須
 *      - 片方 or 両方未割当 → PortType 一致のみで OK（倉庫等）
 */

import { Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { DraggableNode, PortView } from "./node.ts";
import type { NodeData, ConnectionData } from "./nodeData.ts";
import {
  createConnectionData,
  serializeGraph,
  deserializeGraph,
} from "./nodeData.ts";
import { getPortTypeColor } from "./game/resource.ts";

/** 折れ線のオフセット */
const ELBOW_MIN_OFFSET = 20;
/** ヒット判定の幅 */
const CONNECTION_HIT_WIDTH = 12;

// ─── ConnectionView ───

class ConnectionView extends Container {
  public connData: ConnectionData;
  private line: Graphics;
  private hitGfx: Graphics;

  constructor(connData: ConnectionData) {
    super();
    this.connData = connData;

    this.line = new Graphics();
    this.line.eventMode = "none";
    this.addChild(this.line);

    this.hitGfx = new Graphics();
    this.hitGfx.eventMode = "static";
    this.hitGfx.cursor = "pointer";
    this.hitGfx.alpha = 0;
    this.addChild(this.hitGfx);
  }

  redraw(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    alpha: number,
  ) {
    const midX =
      x2 > x1 + ELBOW_MIN_OFFSET * 2 ? (x1 + x2) / 2 : x1 + ELBOW_MIN_OFFSET;

    this.line.clear();
    this.line
      .moveTo(x1, y1)
      .lineTo(midX, y1)
      .lineTo(midX, y2)
      .lineTo(x2, y2)
      .stroke({ width: 3, color, alpha });

    this.hitGfx.clear();
    this.hitGfx
      .moveTo(x1, y1)
      .lineTo(midX, y1)
      .lineTo(midX, y2)
      .lineTo(x2, y2)
      .stroke({ width: CONNECTION_HIT_WIDTH, color: 0xffffff, alpha: 1 });
  }

  onRightClick(handler: (c: ConnectionData) => void) {
    this.hitGfx.on("rightclick", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      handler(this.connData);
    });
  }

  setupHover(hoverColor: number, normalColor: number) {
    this.hitGfx.on("pointerover", () => {
      this.line.tint = hoverColor;
      if (this.parent)
        this.parent.setChildIndex(this, this.parent.children.length - 1);
    });
    this.hitGfx.on("pointerout", () => {
      this.line.tint = normalColor === 0xaaddff ? 0xffffff : normalColor;
    });
  }
}

// ─── NodeManager ───

export class NodeManager {
  public nodes: NodeData[] = [];
  public connections: ConnectionData[] = [];

  private nodeViews = new Map<string, DraggableNode>();
  private connectionViews = new Map<string, ConnectionView>();

  private world: Container;
  private connectionLayer: Container;
  private nodeLayer: Container;
  private tempLineGraphics: Graphics;

  private selectedNodeId: string | null = null;
  private draggingPort: PortView | null = null;
  private draggingPointerId: number | null = null;
  private dragEndPos = { x: 0, y: 0 };

  private gridSizeX: number;
  private gridSizeY: number;

  constructor(
    world: Container,
    opts: { gridSizeX?: number; gridSizeY?: number } = {},
  ) {
    this.world = world;
    this.gridSizeX = opts.gridSizeX ?? 50;
    this.gridSizeY = opts.gridSizeY ?? 50;

    // レイヤー順: connection(背面) → nodes(手前) → tempLine(最前面)
    this.connectionLayer = new Container();
    this.connectionLayer.eventMode = "static";
    this.world.addChild(this.connectionLayer);

    this.nodeLayer = new Container();
    this.nodeLayer.eventMode = "static";
    this.world.addChild(this.nodeLayer);

    this.tempLineGraphics = new Graphics();
    this.tempLineGraphics.eventMode = "none";
    this.world.addChild(this.tempLineGraphics);

    // Delete/Backspace で選択中ノード削除
    window.addEventListener("keydown", (e) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        this.selectedNodeId
      ) {
        this.removeNode(this.selectedNodeId);
      }
    });
  }

  // ─── ノード追加・削除 ───

  addNode(data: NodeData): DraggableNode {
    this.nodes.push(data);

    const view = new DraggableNode(data, {
      gridSizeX: this.gridSizeX,
      gridSizeY: this.gridSizeY,
    });
    view.onMoved = () => this.redrawConnections();
    this.setupPortEvents(view);
    this.setupNodeSelection(view);

    view.eventMode = "static";
    this.nodeLayer.addChild(view);
    this.nodeViews.set(data.id, view);

    return view;
  }

  removeNode(nodeId: string) {
    const relConns = this.connections.filter(
      (c) => c.fromNodeId === nodeId || c.toNodeId === nodeId,
    );
    for (const c of relConns) this.removeConnection(c.id);

    const view = this.nodeViews.get(nodeId);
    if (view) {
      this.nodeLayer.removeChild(view);
      view.destroy();
      this.nodeViews.delete(nodeId);
    }
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    if (this.selectedNodeId === nodeId) this.selectedNodeId = null;
  }

  // ─── コネクション ───

  addConnection(conn: ConnectionData) {
    this.connections.push(conn);
    const cv = new ConnectionView(conn);
    cv.onRightClick((c) => this.removeConnection(c.id));
    cv.setupHover(0xff6666, 0xaaddff);
    this.connectionLayer.addChild(cv);
    this.connectionViews.set(conn.id, cv);
    this.redrawConnections();
  }

  removeConnection(connId: string) {
    const cv = this.connectionViews.get(connId);
    if (cv) {
      this.connectionLayer.removeChild(cv);
      cv.destroy();
      this.connectionViews.delete(connId);
    }
    this.connections = this.connections.filter((c) => c.id !== connId);
  }

  connect(
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string,
  ): ConnectionData {
    const conn = createConnectionData(
      fromNodeId,
      fromPortId,
      toNodeId,
      toPortId,
    );
    this.addConnection(conn);
    return conn;
  }

  getNodeView(nodeId: string): DraggableNode | undefined {
    return this.nodeViews.get(nodeId);
  }

  // ─── 選択 ───

  private setupNodeSelection(view: DraggableNode) {
    view.onSelected = (n) => this.selectNode(n.data.id);
    view.onRightClick = (n, e) => {
      e.stopPropagation();
      this.removeNode(n.data.id);
    };
  }

  private selectNode(nodeId: string | null) {
    if (this.selectedNodeId) {
      this.nodeViews.get(this.selectedNodeId)?.setSelected(false);
    }
    this.selectedNodeId = nodeId;
    if (nodeId) this.nodeViews.get(nodeId)?.setSelected(true);
  }

  // ─── ポートドラッグ → コネクション作成 ───

  private setupPortEvents(nodeView: DraggableNode) {
    for (const port of [...nodeView.inputPorts, ...nodeView.outputPorts]) {
      port.on("pointerdown", (e: FederatedPointerEvent) =>
        this.onPortDragStart(port, e),
      );
    }
  }

  private onPortDragStart(port: PortView, e: FederatedPointerEvent) {
    this.draggingPort = port;
    this.draggingPointerId = e.pointerId;
    const wp = e.getLocalPosition(this.world);
    this.dragEndPos.x = wp.x;
    this.dragEndPos.y = wp.y;

    const stage = this.getStage();
    if (stage) {
      stage.on("pointermove", this.onPortDragMove, this);
      stage.on("pointerup", this.onPortDragEnd, this);
      stage.on("pointerupoutside", this.onPortDragEnd, this);
    }
    e.stopPropagation();
  }

  private onPortDragMove(e: FederatedPointerEvent) {
    if (!this.draggingPort || this.draggingPointerId !== e.pointerId) return;
    const wp = e.getLocalPosition(this.world);
    this.dragEndPos.x = wp.x;
    this.dragEndPos.y = wp.y;

    this.tempLineGraphics.clear();
    const sp = this.getPortWorldPos(this.draggingPort);
    this.drawElbow(
      this.tempLineGraphics,
      sp.x,
      sp.y,
      this.dragEndPos.x,
      this.dragEndPos.y,
      0xffdd57,
      0.8,
    );
    e.stopPropagation();
  }

  private onPortDragEnd(e: FederatedPointerEvent) {
    if (!this.draggingPort || this.draggingPointerId !== e.pointerId) return;

    const stage = this.getStage();
    if (stage) {
      stage.off("pointermove", this.onPortDragMove, this);
      stage.off("pointerup", this.onPortDragEnd, this);
      stage.off("pointerupoutside", this.onPortDragEnd, this);
    }

    const target = this.findPortAt(this.dragEndPos);
    if (target && this.canConnect(this.draggingPort, target)) {
      let from = this.draggingPort;
      let to = target;
      if (from.portData.direction === "input") [from, to] = [to, from];
      this.connect(from.nodeId, from.portData.id, to.nodeId, to.portData.id);
    }

    this.tempLineGraphics.clear();
    this.draggingPort = null;
    this.draggingPointerId = null;
    e.stopPropagation();
  }

  private findPortAt(
    pos: { x: number; y: number },
    threshold = 16,
  ): PortView | null {
    for (const nv of this.nodeViews.values()) {
      for (const p of [...nv.inputPorts, ...nv.outputPorts]) {
        const pp = this.getPortWorldPos(p);
        const dx = pp.x - pos.x;
        const dy = pp.y - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) return p;
      }
    }
    return null;
  }

  /**
   * 3段階接続チェック:
   *   ① PortType 一致
   *   ② 方向チェック (output→input)
   *   ③ リソース互換:
   *      - 両方 resourceId あり → 一致必須
   *      - 片方 or 両方未割当 → OK（倉庫やautoモード）
   *   ④ 重複チェック
   */
  private canConnect(a: PortView, b: PortView): boolean {
    // 同一ノード不可
    if (a.nodeId === b.nodeId) return false;

    // ① PortType 一致
    if (a.portData.portType !== b.portData.portType) return false;

    // ② 方向チェック
    if (a.portData.direction === b.portData.direction) return false;

    const from = a.portData.direction === "output" ? a : b;
    const to = a.portData.direction === "input" ? a : b;

    // ③ リソース互換
    if (from.portData.resourceId && to.portData.resourceId) {
      if (from.portData.resourceId !== to.portData.resourceId) return false;
    }

    // ④ 重複コネクション不可
    return !this.connections.some(
      (c) =>
        c.fromNodeId === from.nodeId &&
        c.fromPortId === from.portData.id &&
        c.toNodeId === to.nodeId &&
        c.toPortId === to.portData.id,
    );
  }

  // ─── 描画 ───

  redrawConnections() {
    for (const conn of this.connections) {
      const fn = this.nodeViews.get(conn.fromNodeId);
      const tn = this.nodeViews.get(conn.toNodeId);
      if (!fn || !tn) continue;
      const fp = fn.getPortView(conn.fromPortId);
      const tp = tn.getPortView(conn.toPortId);
      if (!fp || !tp) continue;

      const s = this.getPortWorldPos(fp);
      const e = this.getPortWorldPos(tp);

      // 接続線の色は PortType から決定
      const lineColor = getPortTypeColor(fp.portData.portType);
      this.connectionViews
        .get(conn.id)
        ?.redraw(s.x, s.y, e.x, e.y, lineColor, 1);
    }
  }

  private getPortWorldPos(port: PortView): { x: number; y: number } {
    const g = port.getGlobalPosition();
    return this.world.toLocal(g);
  }

  private drawElbow(
    gfx: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    alpha: number,
  ) {
    const midX =
      x2 > x1 + ELBOW_MIN_OFFSET * 2 ? (x1 + x2) / 2 : x1 + ELBOW_MIN_OFFSET;
    gfx
      .moveTo(x1, y1)
      .lineTo(midX, y1)
      .lineTo(midX, y2)
      .lineTo(x2, y2)
      .stroke({ width: 3, color, alpha });
  }

  private getStage(): Container | null {
    let c: Container | null = this.world.parent as Container | null;
    while (c?.parent) c = c.parent as Container;
    return c || this.world;
  }

  // ─── 保存・読み込み ───

  private static readonly STORAGE_KEY = "rockrockrock_graph";

  save() {
    const json = serializeGraph(this.nodes, this.connections);
    localStorage.setItem(NodeManager.STORAGE_KEY, json);
    console.log("[NodeManager] Saved");
  }

  load(): boolean {
    const json = localStorage.getItem(NodeManager.STORAGE_KEY);
    if (!json) return false;
    try {
      const data = deserializeGraph(json);
      this.clearAll();
      for (const nd of data.nodes) this.addNode(nd);
      for (const cd of data.connections) this.addConnection(cd);
      console.log(
        `[NodeManager] Loaded ${data.nodes.length} nodes, ${data.connections.length} connections`,
      );
      return true;
    } catch (e) {
      console.error("[NodeManager] Load failed:", e);
      return false;
    }
  }

  clearAll() {
    for (const id of [...this.connectionViews.keys()])
      this.removeConnection(id);
    for (const id of [...this.nodeViews.keys()]) this.removeNode(id);
  }
}
