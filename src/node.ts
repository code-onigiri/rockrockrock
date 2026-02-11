import {
  Container,
  Graphics,
  Text,
  FederatedPointerEvent,
  Rectangle,
} from "pixi.js";

export interface NodeOptions {
  x?: number;
  y?: number;
  title?: string;
  gridSize?: number;
  /** 横のグリッド数（デフォルト: 2） */
  cols?: number;
  /** 縦のグリッド数（デフォルト: 3） */
  rows?: number;
}

export class DraggableNode extends Container {
  private background: Graphics;
  private titleBar: Container;
  private titleBarBg: Graphics;
  private titleText: Text;
  private gridSize: number;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  // 要素外に出てもドラッグ継続できるようにする
  private dragRoot: Container | null = null;
  private onDragMoveBound = this.onDragMove.bind(this);
  private onDragEndBound = this.onDragEnd.bind(this);

  private getRootContainer(): Container {
    // 最上位コンテナ（通常は stage）までたどる
    let parent = this.parent as Container | null;
    while (parent?.parent) parent = parent.parent as Container;
    return parent ?? this;
  }

  constructor(options: NodeOptions = {}) {
    super();

    this.gridSize = options.gridSize ?? 50;
    const cols = options.cols ?? 2;
    const rows = options.rows ?? 3;
    const width = this.gridSize * cols; // 横: cols グリッド
    const height = this.gridSize * rows; // 縦: rows グリッド
    const titleBarHeight = 30;

    // タイトルバーコンテナ
    this.titleBar = new Container();
    this.titleBar.eventMode = "static";
    this.titleBar.cursor = "grab";
    this.titleBar.hitArea = new Rectangle(0, 0, width, titleBarHeight);
    this.addChild(this.titleBar);

    // タイトルバー背景（上角だけ丸める: roundShape 利用）
    this.titleBarBg = new Graphics();
    const titleCornerRadius = 8; // タイトルバーの角丸半径(px)
    this.titleBarBg
      .roundShape(
        [
          { x: 0, y: 0, radius: titleCornerRadius }, // 左上
          { x: width, y: 0, radius: titleCornerRadius }, // 右上
          { x: width, y: titleBarHeight, radius: 0 }, // 右下
          { x: 0, y: titleBarHeight, radius: 0 }, // 左下
        ],
        0,
      )
      .fill({ color: 0x4a90e2 });
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

    // 本体（下角だけ丸める: roundShape 利用）
    this.background = new Graphics();
    const bgCornerRadius = 8; // 本体の下角半径(px)
    this.background
      .roundShape(
        [
          { x: 0, y: titleBarHeight, radius: 0 }, // 左上
          { x: width, y: titleBarHeight, radius: 0 }, // 右上
          { x: width, y: height, radius: bgCornerRadius }, // 右下
          { x: 0, y: height, radius: bgCornerRadius }, // 左下
        ],
        0,
      )
      .fill({ color: 0x2d2d2d })
      .stroke({ width: 2, color: 0x4a4a4a });
    // 通常は titleBar で受けるが、ドラッグ中は上位コンテナに委譲する
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

    const parent = this.parent!;
    const localPos = parent.toLocal(event.global);
    this.dragOffset.x = localPos.x - this.x;
    this.dragOffset.y = localPos.y - this.y;

    // titleBar から外れてもドラッグを継続できるようにする
    const root = this.getRootContainer();
    root.on("pointermove", this.onDragMoveBound);
    root.on("pointerup", this.onDragEndBound);
    root.on("pointerupoutside", this.onDragEndBound);
    this.dragRoot = root;

    event.stopPropagation();
  }

  private onDragMove(event: FederatedPointerEvent) {
    if (!this.isDragging) return;

    const parent = this.parent!;
    const localPos = parent.toLocal(event.global);
    this.x = localPos.x - this.dragOffset.x;
    this.y = localPos.y - this.dragOffset.y;

    event.stopPropagation();
  }

  private onDragEnd(event: FederatedPointerEvent) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.titleBar.cursor = "grab";

    // 上位コンテナのリスナーを解除
    if (this.dragRoot) {
      this.dragRoot.off("pointermove", this.onDragMoveBound);
      this.dragRoot.off("pointerup", this.onDragEndBound);
      this.dragRoot.off("pointerupoutside", this.onDragEndBound);
      this.dragRoot = null;
    }

    // グリッドにスナップ
    this.x = Math.round(this.x / this.gridSize) * this.gridSize;
    this.y = Math.round(this.y / this.gridSize) * this.gridSize;

    event.stopPropagation();
  }
}
