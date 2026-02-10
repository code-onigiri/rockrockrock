/**
 * ノードのView (PixiJS)
 *
 * レイアウト:
 *   ┌──────────────────────────┐
 *   │  HEADER (タイトルバー)     │
 *   ├────┬───────────────┬─────┤
 *   │ IN │     MAIN      │ OUT │
 *   │ P  │ ◀ [recipe] ▶  │ P   │
 *   │ O  │ [progress bar]│ O   │
 *   │ R  │ ┌──┬──┬──┐    │ R   │
 *   │ T  │ │IN│IN│  │    │ T   │
 *   │ S  │ ├──┼──┼──┤    │ S   │
 *   │    │ │OT│OT│  │    │     │
 *   │    │ └──┴──┴──┘    │     │
 *   └────┴───────────────┴─────┘
 *
 * ポートの見た目は PortType で変化:
 *   - item:   ●  塗り潰し丸
 *   - liquid: ■  塗り潰し四角
 *   - gas:    ◎  二重丸（中空）
 *   - power:  ◆  ダイヤモンド
 *
 * インベントリスロットはMAIN内に常時表示
 */

import {
  Container,
  Graphics,
  Text,
  FederatedPointerEvent,
  Rectangle,
} from "pixi.js";
import type { NodeData, PortData } from "./nodeData.ts";
import type { PortType, ResourceStack } from "./game/resource.ts";
import {
  getResourceColor,
  getResourceName,
  getPortTypeColor,
  getPortTypeName,
} from "./game/resource.ts";

// ─── 定数 ───

const PORT_RADIUS = 6;
const PORT_SPACING = 26;
const PORT_COLUMN_WIDTH = 24;
const TITLE_BAR_HEIGHT = 28;
const PORT_TOP_MARGIN = 16;
const MAIN_PADDING = 4;
const CORNER_RADIUS = 6;

// スロット表示
const SLOT_SIZE = 16;
const SLOT_GAP = 2;
const SLOT_COLS = 4;

// ─── PortView ───

export class PortView extends Container {
  public portData: PortData;
  public nodeId: string;
  private gfx: Graphics;
  private labelText: Text;

  constructor(portData: PortData, nodeId: string) {
    super();
    this.portData = portData;
    this.nodeId = nodeId;

    this.eventMode = "static";
    this.cursor = "pointer";

    this.gfx = new Graphics();
    this.addChild(this.gfx);

    this.labelText = new Text({
      text: this.getLabelText(),
      style: { fill: 0x888888, fontSize: 7 },
      resolution: 2,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, PORT_RADIUS + 2);
    this.addChild(this.labelText);

    this.drawNormal();

    this.on("pointerover", () => this.drawHover());
    this.on("pointerout", () => this.drawNormal());
  }

  getGlobalCenter(): { x: number; y: number } {
    const p = this.getGlobalPosition();
    return { x: p.x, y: p.y };
  }

  public redraw() {
    this.drawNormal();
    this.labelText.text = this.getLabelText();
  }

  private getLabelText(): string {
    if (this.portData.resourceId) {
      return getResourceName(this.portData.resourceId).slice(0, 4);
    }
    if (this.portData.portType === "power") {
      return "⚡";
    }
    return this.portData.name.slice(0, 3);
  }

  private getColor(): number {
    if (this.portData.resourceId) {
      return getResourceColor(this.portData.resourceId);
    }
    return getPortTypeColor(this.portData.portType);
  }

  private drawNormal() {
    const color = this.getColor();
    this.gfx.clear();
    this.drawShape(this.gfx, this.portData.portType, PORT_RADIUS, color);
  }

  private drawHover() {
    this.gfx.clear();
    this.drawShape(this.gfx, this.portData.portType, PORT_RADIUS + 1, 0xffdd57);
  }

  private drawShape(g: Graphics, pt: PortType, r: number, fill: number) {
    const stroke = 0xffffff;
    switch (pt) {
      case "liquid":
        g.rect(-r, -r, r * 2, r * 2).fill({ color: fill });
        g.rect(-r, -r, r * 2, r * 2).stroke({ width: 2, color: stroke });
        break;
      case "gas":
        g.circle(0, 0, r).stroke({ width: 2, color: fill });
        g.circle(0, 0, r * 0.45).fill({ color: fill });
        break;
      case "power":
        g.moveTo(0, -r)
          .lineTo(r, 0)
          .lineTo(0, r)
          .lineTo(-r, 0)
          .closePath()
          .fill({ color: fill });
        g.moveTo(0, -r)
          .lineTo(r, 0)
          .lineTo(0, r)
          .lineTo(-r, 0)
          .closePath()
          .stroke({ width: 2, color: stroke });
        break;
      default:
        g.circle(0, 0, r).fill({ color: fill });
        g.circle(0, 0, r).stroke({ width: 2, color: stroke });
        break;
    }
  }
}

// ─── DraggableNode ───

export interface DraggableNodeOptions {
  gridSizeX?: number;
  gridSizeY?: number;
}

export class DraggableNode extends Container {
  public data: NodeData;
  public inputPorts: PortView[] = [];
  public outputPorts: PortView[] = [];

  // 内部UI要素
  private bodyContainer: Container;
  private titleBar: Container;
  private titleBarBg: Graphics;
  private titleText: Text;
  private selectionBorder: Graphics;
  private mainArea: Container;
  private mainBg: Graphics;
  private recipeSelectorContainer: Container;
  private recipeNameText: Text;
  private recipeText: Text;
  private progressBg: Graphics;
  private progressBar: Graphics;
  private processingIndicator: Graphics;
  // インベントリスロットコンテナ
  private slotContainer: Container;
  private mainW: number;

  private gridSizeX: number;
  private gridSizeY: number;
  private isDragging = false;
  private activePointerId: number | null = null;
  private dragOffset = { x: 0, y: 0 };

  public onMoved?: (node: DraggableNode) => void;
  public onSelected?: (node: DraggableNode) => void;
  public onRightClick?: (
    node: DraggableNode,
    event: FederatedPointerEvent,
  ) => void;
  public onRecipeChange?: (node: DraggableNode, delta: number) => void;

  constructor(data: NodeData, options: DraggableNodeOptions = {}) {
    super();
    this.data = data;
    this.gridSizeX = options.gridSizeX ?? 50;
    this.gridSizeY = options.gridSizeY ?? 50;

    const { width, height, titleColor } = data;
    const bodyHeight = height - TITLE_BAR_HEIGHT;
    this.mainW = width - PORT_COLUMN_WIDTH * 2 - MAIN_PADDING * 2;

    // ── タイトルバー ──
    this.titleBar = new Container();
    this.titleBar.eventMode = "static";
    this.titleBar.cursor = "grab";
    this.titleBar.hitArea = new Rectangle(0, 0, width, TITLE_BAR_HEIGHT);
    this.addChild(this.titleBar);

    this.titleBarBg = new Graphics();
    drawTopRoundedRect(this.titleBarBg, 0, 0, width, TITLE_BAR_HEIGHT);
    this.titleBarBg.fill({ color: titleColor });
    this.titleBar.addChild(this.titleBarBg);

    this.titleText = new Text({
      text: data.title,
      style: { fill: 0xffffff, fontSize: 13, fontWeight: "bold" },
      resolution: 2,
    });
    this.titleText.anchor.set(0, 0.5);
    this.titleText.position.set(8, TITLE_BAR_HEIGHT / 2);
    this.titleBar.addChild(this.titleText);

    this.processingIndicator = new Graphics();
    this.processingIndicator.circle(0, 0, 4).fill({ color: 0x44ff44 });
    this.processingIndicator.position.set(width - 14, TITLE_BAR_HEIGHT / 2);
    this.processingIndicator.visible = false;
    this.titleBar.addChild(this.processingIndicator);

    // ── ボディ ──
    this.bodyContainer = new Container();
    this.bodyContainer.position.set(0, TITLE_BAR_HEIGHT);
    this.addChild(this.bodyContainer);

    const bodyBg = new Graphics();
    drawBottomRoundedRect(bodyBg, 0, 0, width, bodyHeight);
    bodyBg.fill({ color: 0x2d2d2d });
    bodyBg.stroke({ width: 2, color: 0x4a4a4a });
    this.bodyContainer.addChild(bodyBg);

    const sepLeft = new Graphics();
    sepLeft
      .moveTo(PORT_COLUMN_WIDTH, 0)
      .lineTo(PORT_COLUMN_WIDTH, bodyHeight)
      .stroke({ width: 1, color: 0x3a3a3a });
    this.bodyContainer.addChild(sepLeft);

    const sepRight = new Graphics();
    sepRight
      .moveTo(width - PORT_COLUMN_WIDTH, 0)
      .lineTo(width - PORT_COLUMN_WIDTH, bodyHeight)
      .stroke({ width: 1, color: 0x3a3a3a });
    this.bodyContainer.addChild(sepRight);

    // ── MAIN エリア ──
    const mainX = PORT_COLUMN_WIDTH + MAIN_PADDING;
    const mainH = bodyHeight - MAIN_PADDING * 2;

    this.mainArea = new Container();
    this.mainArea.position.set(mainX, MAIN_PADDING);
    this.mainArea.eventMode = "static";
    this.mainArea.hitArea = new Rectangle(0, 0, this.mainW, mainH);
    this.bodyContainer.addChild(this.mainArea);

    this.mainBg = new Graphics();
    this.mainBg
      .roundRect(0, 0, this.mainW, mainH, 3)
      .fill({ color: 0x1a1a1a, alpha: 0.4 });
    this.mainArea.addChild(this.mainBg);

    // ── レシピ選択UI ◀ [名前] ▶ ──
    this.recipeSelectorContainer = new Container();
    this.recipeSelectorContainer.position.set(4, 4);
    this.mainArea.addChild(this.recipeSelectorContainer);

    const btnLeft = this.createSmallButton("◀", () =>
      this.onRecipeChange?.(this, -1),
    );
    btnLeft.position.set(0, 0);
    this.recipeSelectorContainer.addChild(btnLeft);

    this.recipeNameText = new Text({
      text: "自動",
      style: { fill: 0xdddddd, fontSize: 9 },
      resolution: 2,
    });
    this.recipeNameText.position.set(16, 1);
    this.recipeSelectorContainer.addChild(this.recipeNameText);

    const btnRight = this.createSmallButton("▶", () =>
      this.onRecipeChange?.(this, 1),
    );
    btnRight.position.set(this.mainW - 20, 0);
    this.recipeSelectorContainer.addChild(btnRight);

    // レシピ/電力テキスト
    this.recipeText = new Text({
      text: "",
      style: { fill: 0xaaaaaa, fontSize: 8 },
      resolution: 2,
    });
    this.recipeText.position.set(4, 17);
    this.mainArea.addChild(this.recipeText);

    // プログレスバー
    const barY = 28;
    const barW = this.mainW - 8;
    this.progressBg = new Graphics();
    this.progressBg.rect(0, 0, barW, 5).fill({ color: 0x333333 });
    this.progressBg.position.set(4, barY);
    this.mainArea.addChild(this.progressBg);

    this.progressBar = new Graphics();
    this.progressBar.position.set(4, barY);
    this.mainArea.addChild(this.progressBar);

    // ── インベントリスロットコンテナ（MAINの下半分） ──
    this.slotContainer = new Container();
    this.slotContainer.position.set(4, barY + 8);
    this.mainArea.addChild(this.slotContainer);

    // ── 選択枠 ──
    this.selectionBorder = new Graphics();
    this.selectionBorder.visible = false;
    this.addChild(this.selectionBorder);
    this.drawSelectionBorder();

    // ── ポート構築 ──
    this.buildPorts();

    // ── 初期位置 ──
    this.position.set(data.x, data.y);

    // ── ドラッグイベント ──
    this.setupDragEvents();
  }

  // ─── 公開メソッド ───

  public setSelected(selected: boolean) {
    this.selectionBorder.visible = selected;
  }

  /** MAINエリアの表示を更新 */
  public updateDisplay(info: {
    inputStacks: ResourceStack[];
    outputStacks: ResourceStack[];
    isProcessing: boolean;
    progress: number;
    totalTicks: number;
    currentTick: number;
    powerConsumed: number;
    powerProduced: number;
    recipeName?: string;
  }) {
    if (info.recipeName !== undefined) {
      this.recipeNameText.text = info.recipeName;
    }

    // 処理状態テキスト
    const lines: string[] = [];
    if (info.isProcessing) {
      lines.push(`${info.currentTick}/${info.totalTicks}`);
    }
    if (info.powerConsumed > 0) lines.push(`⚡-${info.powerConsumed}`);
    if (info.powerProduced > 0) lines.push(`⚡+${info.powerProduced}`);
    this.recipeText.text = lines.join("  ");

    // プログレスバー
    const barW = this.mainW - 8;
    this.progressBar.clear();
    if (info.isProcessing && info.totalTicks > 0) {
      const fillW = Math.max(1, barW * info.progress);
      this.progressBar.rect(0, 0, fillW, 5).fill({ color: 0x44bb44 });
    }

    // インベントリスロット描画
    this.drawSlots(info.inputStacks, info.outputStacks);

    this.processingIndicator.visible = info.isProcessing;
  }

  /** インベントリをスロットグリッドで描画 */
  private drawSlots(
    inputStacks: ResourceStack[],
    outputStacks: ResourceStack[],
  ) {
    this.slotContainer.removeChildren();

    let curY = 0;

    // INPUT スロット
    if (inputStacks.length > 0) {
      const inLabel = new Text({
        text: "IN",
        style: { fill: 0x6699aa, fontSize: 7, fontWeight: "bold" },
        resolution: 2,
      });
      inLabel.position.set(0, curY);
      this.slotContainer.addChild(inLabel);
      curY += 9;

      curY = this.renderSlotRow(inputStacks, 0, curY);
      curY += 2;
    }

    // OUTPUT スロット
    if (outputStacks.length > 0) {
      const outLabel = new Text({
        text: "OUT",
        style: { fill: 0xaa9966, fontSize: 7, fontWeight: "bold" },
        resolution: 2,
      });
      outLabel.position.set(0, curY);
      this.slotContainer.addChild(outLabel);
      curY += 9;

      this.renderSlotRow(outputStacks, 0, curY);
    }
  }

  /** スロット1行分を描画し、次のY位置を返す */
  private renderSlotRow(
    stacks: ResourceStack[],
    startX: number,
    startY: number,
  ): number {
    let col = 0;
    let row = 0;

    for (const stack of stacks) {
      const x = startX + col * (SLOT_SIZE + SLOT_GAP);
      const y = startY + row * (SLOT_SIZE + SLOT_GAP + 8);

      // スロット背景
      const slotBg = new Graphics();
      slotBg
        .roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 2)
        .fill({ color: getResourceColor(stack.resourceId), alpha: 0.7 });
      slotBg
        .roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 2)
        .stroke({ width: 1, color: 0x555555 });
      this.slotContainer.addChild(slotBg);

      // 数量（右下）
      const amtText = new Text({
        text: `${stack.amount}`,
        style: { fill: 0xffffff, fontSize: 7, fontWeight: "bold" },
        resolution: 2,
      });
      amtText.anchor.set(1, 1);
      amtText.position.set(x + SLOT_SIZE - 1, y + SLOT_SIZE - 1);
      this.slotContainer.addChild(amtText);

      // リソース名（スロット下）
      const nameText = new Text({
        text: getResourceName(stack.resourceId).slice(0, 2),
        style: { fill: 0xaaaaaa, fontSize: 6 },
        resolution: 2,
      });
      nameText.anchor.set(0.5, 0);
      nameText.position.set(x + SLOT_SIZE / 2, y + SLOT_SIZE + 1);
      this.slotContainer.addChild(nameText);

      col++;
      if (col >= SLOT_COLS) {
        col = 0;
        row++;
      }
    }

    const totalRows = Math.max(1, Math.ceil(stacks.length / SLOT_COLS));
    return startY + totalRows * (SLOT_SIZE + SLOT_GAP + 8);
  }

  public getPortView(portId: string): PortView | undefined {
    return (
      this.inputPorts.find((p) => p.portData.id === portId) ??
      this.outputPorts.find((p) => p.portData.id === portId)
    );
  }

  /**
   * レシピ選択に応じてポートの resourceId を更新し再描画。
   */
  public updatePortResources(
    inputBindings: { portIndex: number; resourceId: string }[],
    outputBindings: { portIndex: number; resourceId: string }[],
  ) {
    for (const pv of this.inputPorts) {
      if (pv.portData.portType !== "power") {
        pv.portData.resourceId = undefined;
      }
    }
    for (const pv of this.outputPorts) {
      if (pv.portData.portType !== "power") {
        pv.portData.resourceId = undefined;
      }
    }

    for (const b of inputBindings) {
      const pv = this.inputPorts[b.portIndex];
      if (pv) pv.portData.resourceId = b.resourceId;
    }
    for (const b of outputBindings) {
      const pv = this.outputPorts[b.portIndex];
      if (pv) pv.portData.resourceId = b.resourceId;
    }

    for (const pv of [...this.inputPorts, ...this.outputPorts]) {
      pv.redraw();
    }
  }

  static getPortSummary(
    inputPorts: { label: string; type: PortType }[],
    outputPorts: { label: string; type: PortType }[],
  ): string {
    const countByType = (ports: { type: PortType }[]) => {
      const m = new Map<PortType, number>();
      for (const p of ports) m.set(p.type, (m.get(p.type) ?? 0) + 1);
      return [...m.entries()]
        .map(([t, n]) => `${getPortTypeName(t)}×${n}`)
        .join(" ");
    };
    const inStr = countByType(inputPorts);
    const outStr = countByType(outputPorts);
    return `${inStr || "—"} → ${outStr || "—"}`;
  }

  // ─── ポート構築 ───

  private buildPorts() {
    const bodyHeight = this.data.height - TITLE_BAR_HEIGHT;

    this.data.inputs.forEach((pd, i) => {
      const port = new PortView(pd, this.data.id);
      const y = PORT_TOP_MARGIN + i * PORT_SPACING;
      port.position.set(
        PORT_COLUMN_WIDTH / 2,
        Math.min(y, bodyHeight - PORT_TOP_MARGIN),
      );
      this.bodyContainer.addChild(port);
      this.inputPorts.push(port);
    });

    this.data.outputs.forEach((pd, i) => {
      const port = new PortView(pd, this.data.id);
      const y = PORT_TOP_MARGIN + i * PORT_SPACING;
      port.position.set(
        this.data.width - PORT_COLUMN_WIDTH / 2,
        Math.min(y, bodyHeight - PORT_TOP_MARGIN),
      );
      this.bodyContainer.addChild(port);
      this.outputPorts.push(port);
    });
  }

  // ─── 小ボタン作成 ───

  private createSmallButton(labelStr: string, onClick: () => void): Container {
    const btn = new Container();
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.roundRect(0, 0, 14, 12, 2).fill({ color: 0x444444 });
    btn.addChild(bg);

    const txt = new Text({
      text: labelStr,
      style: { fill: 0xdddddd, fontSize: 8 },
      resolution: 2,
    });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(7, 6);
    btn.addChild(txt);

    btn.on("pointerover", () => {
      bg.clear();
      bg.roundRect(0, 0, 14, 12, 2).fill({ color: 0x666666 });
    });
    btn.on("pointerout", () => {
      bg.clear();
      bg.roundRect(0, 0, 14, 12, 2).fill({ color: 0x444444 });
    });
    btn.on("pointerdown", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      onClick();
    });

    return btn;
  }

  // ─── 選択枠 ───

  private drawSelectionBorder() {
    const { width, height } = this.data;
    const pad = 3;
    this.selectionBorder.clear();
    this.selectionBorder
      .roundRect(
        -pad,
        -pad,
        width + pad * 2,
        height + pad * 2,
        CORNER_RADIUS + pad,
      )
      .stroke({ width: 2, color: 0x00bfff, alpha: 0.9 });
  }

  // ─── ドラッグ ───

  private setupDragEvents() {
    this.titleBar.on("pointerdown", this.onDragStart.bind(this));
    this.titleBar.on("rightclick", (e: FederatedPointerEvent) => {
      this.onRightClick?.(this, e);
    });
  }

  private onDragStart(event: FederatedPointerEvent) {
    this.onSelected?.(this);
    this.isDragging = true;
    this.titleBar.cursor = "grabbing";
    this.activePointerId = event.pointerId;

    const parent = this.parent ?? this;
    const local = event.getLocalPosition(parent);
    this.dragOffset.x = local.x - this.x;
    this.dragOffset.y = local.y - this.y;

    const stage = this.getStage();
    if (stage) {
      stage.on("pointermove", this.onDragMove, this);
      stage.on("pointerup", this.onDragEnd, this);
      stage.on("pointerupoutside", this.onDragEnd, this);
    }
    event.stopPropagation();
  }

  private onDragMove(event: FederatedPointerEvent) {
    if (!this.isDragging || this.activePointerId !== event.pointerId) return;
    const parent = this.parent ?? this;
    const local = event.getLocalPosition(parent);
    this.x = local.x - this.dragOffset.x;
    this.y = local.y - this.dragOffset.y;
    this.data.x = this.x;
    this.data.y = this.y;
    this.onMoved?.(this);
    event.stopPropagation();
  }

  private onDragEnd(event: FederatedPointerEvent) {
    if (!this.isDragging || this.activePointerId !== event.pointerId) return;
    this.isDragging = false;
    this.activePointerId = null;
    this.titleBar.cursor = "grab";

    const stage = this.getStage();
    if (stage) {
      stage.off("pointermove", this.onDragMove, this);
      stage.off("pointerup", this.onDragEnd, this);
      stage.off("pointerupoutside", this.onDragEnd, this);
    }

    this.x = Math.round(this.x / this.gridSizeX) * this.gridSizeX;
    this.y = Math.round(this.y / this.gridSizeY) * this.gridSizeY;
    this.data.x = this.x;
    this.data.y = this.y;
    this.onMoved?.(this);
    event.stopPropagation();
  }

  private getStage(): Container | null {
    let c: Container | null = this.parent as Container | null;
    while (c?.parent) c = c.parent as Container;
    return c || this;
  }
}

// ─── 描画ヘルパー ───

function drawTopRoundedRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const r = Math.min(CORNER_RADIUS, w / 2, h);
  g.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .arc(x + w - r, y + r, r, -Math.PI / 2, 0)
    .lineTo(x + w, y + h)
    .lineTo(x, y + h)
    .lineTo(x, y + r)
    .arc(x + r, y + r, r, Math.PI, -Math.PI / 2)
    .closePath();
}

function drawBottomRoundedRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const r = Math.min(CORNER_RADIUS, w / 2, h);
  g.moveTo(x, y)
    .lineTo(x + w, y)
    .lineTo(x + w, y + h - r)
    .arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
    .lineTo(x + r, y + h)
    .arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
    .lineTo(x, y)
    .closePath();
}
