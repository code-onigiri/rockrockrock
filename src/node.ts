import { Container, Graphics, Text, FederatedPointerEvent } from "pixi.js";

export interface NodeOptions {
  x?: number;
  y?: number;
  title?: string;
  gridSize?: number;
}

export class DraggableNode extends Container {
  private background: Graphics;
  private titleBar: Container;
  private titleBarBg: Graphics;
  private titleText: Text;
  private gridSize: number;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  constructor(options: NodeOptions = {}) {
    super();

    this.gridSize = options.gridSize ?? 50;
    const width = this.gridSize * 2; // 2グリッド
    const height = this.gridSize * 3; // 3グリッド
    const titleBarHeight = 30;

    // タイトルバーコンテナ
    this.titleBar = new Container();
    this.titleBar.eventMode = "static";
    this.titleBar.cursor = "grab";
    this.titleBar.hitArea = { x: 0, y: 0, width, height: titleBarHeight, contains: (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= titleBarHeight };
    this.addChild(this.titleBar);

    // タイトルバー背景
    this.titleBarBg = new Graphics();
    this.titleBarBg.rect(0, 0, width, titleBarHeight);
    this.titleBarBg.fill({ color: 0x4a90e2 });
    this.titleBar.addChild(this.titleBarBg);

    // タイトルテキスト
    this.titleText = new Text({
      text: options.title ?? "Node",
      style: {
        fill: 0xffffff,
        fontSize: 14,
        fontWeight: "bold",
      },
    });
    this.titleText.anchor.set(0, 0.5);
    this.titleText.position.set(8, titleBarHeight / 2);
    this.titleBar.addChild(this.titleText);

    // 本体
    this.background = new Graphics();
    this.background.rect(0, titleBarHeight, width, height - titleBarHeight);
    this.background.fill({ color: 0x2d2d2d });
    this.background.stroke({ width: 2, color: 0x4a4a4a });
    this.addChild(this.background);

    // 初期位置設定
    if (options.x !== undefined || options.y !== undefined) {
      this.position.set(options.x ?? 0, options.y ?? 0);
    }

    // ドラッグイベント設定
    this.setupDragEvents();
  }

  private setupDragEvents() {
    this.titleBar.on("pointerdown", this.onDragStart.bind(this));
    this.titleBar.on("pointermove", this.onDragMove.bind(this));
    this.titleBar.on("pointerup", this.onDragEnd.bind(this));
    this.titleBar.on("pointerupoutside", this.onDragEnd.bind(this));
  }

  private onDragStart(event: FederatedPointerEvent) {
    this.isDragging = true;
    this.titleBar.cursor = "grabbing";

    this.dragOffset.x = event.global.x - this.x;
    this.dragOffset.y = event.global.y - this.y;

    event.stopPropagation();
  }

  private onDragMove(event: FederatedPointerEvent) {
    if (!this.isDragging) return;

    this.x = event.global.x - this.dragOffset.x;
    this.y = event.global.y - this.dragOffset.y;

    event.stopPropagation();
  }

  private onDragEnd(event: FederatedPointerEvent) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.titleBar.cursor = "grab";

    // グリッドにスナップ
    this.x = Math.round(this.x / this.gridSize) * this.gridSize;
    this.y = Math.round(this.y / this.gridSize) * this.gridSize;

    event.stopPropagation();
  }
}
