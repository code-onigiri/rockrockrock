import {
  Application,
  Container,
  Graphics,
  TilingSprite,
  Point,
  type ContainerChild,
} from "pixi.js";

export const createScrollableWorld = (app: Application) => {
  const gridSize = 50;
  const gridColor = 0xffffff;
  const gridAlpha = 0.2;

  const halfPixel = 0.5;
  const gridPattern = new Graphics()
    .moveTo(halfPixel, halfPixel)
    .lineTo(gridSize - halfPixel, halfPixel)
    .moveTo(halfPixel, halfPixel)
    .lineTo(halfPixel, gridSize - halfPixel)
    .stroke({
      width: 1,
      color: gridColor,
      alpha: gridAlpha,
      pixelLine: true,
    });
  const gridTexture = app.renderer.generateTexture(gridPattern);
  const grid = new TilingSprite({
    texture: gridTexture,
    width: app.screen.width,
    height: app.screen.height,
    applyAnchorToTexture: true,
  });

  const updateGridSize = () => {
    grid.width = app.screen.width;
    grid.height = app.screen.height;
  };

  const updateStageHitArea = () => {
    app.stage.hitArea = app.screen;
  };

  const updateLayout = () => {
    updateGridSize();
    updateStageHitArea();
  };

  updateLayout();
  app.renderer.on("resize", updateLayout);

  app.stage.addChild(grid);

  const world = new Container();
  app.stage.addChild(world);

  app.stage.eventMode = "static";

  let isDragging = false;
  let lastPosition = { x: 0, y: 0 };

  app.stage.on("pointerdown", (event) => {
    // ワールドの子要素がクリックされた場合はドラッグしない
    if (event.target && event.target !== app.stage && event.target !== grid) {
      return;
    }

    isDragging = true;
    lastPosition = { x: event.global.x, y: event.global.y };
  });

  const stopDrag = () => {
    isDragging = false;
  };

  app.stage.on("pointerup", stopDrag);
  app.stage.on("pointerupoutside", stopDrag);

  app.stage.on("pointermove", (event) => {
    if (!isDragging) return;
    const { x, y } = event.global;
    const dx = x - lastPosition.x;
    const dy = y - lastPosition.y;
    lastPosition = { x, y };
    world.position.x += dx;
    world.position.y += dy;
    grid.tilePosition.x += dx;
    grid.tilePosition.y += dy;
  });

  // ズーム設定
  const minScale = 0.2;
  const maxScale = 3;

  const clamp = (v: number, a: number, b: number) =>
    Math.max(a, Math.min(b, v));

  // v8ではInteractionではなくEventSystem(app.renderer.events)で座標変換する
  const mapClientToGlobal = (clientX: number, clientY: number) => {
    const rect = app.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const point = new Point();
    app.renderer.events.mapPositionToPoint(point, canvasX, canvasY);
    return point;
  };

  const applyZoom = (newScale: number, globalPos: Point) => {
    const oldScale = world.scale.x;
    if (newScale === oldScale) return;

    const { x: px, y: py } = world.position;
    const ratio = newScale / oldScale;
    const nextX = globalPos.x - ratio * (globalPos.x - px);
    const nextY = globalPos.y - ratio * (globalPos.y - py);
    const dx = nextX - px;
    const dy = nextY - py;

    world.scale.set(newScale);
    world.position.set(nextX, nextY);
    grid.tileScale.set(newScale, newScale);
    grid.tilePosition.x += dx;
    grid.tilePosition.y += dy;
  };

  // マウスホイールによるズーム（マウス位置を中心にズーム）
  app.canvas.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();

      const globalPos = mapClientToGlobal(e.clientX, e.clientY);
      // 細かく滑らかなズームを実現
      const zoomFactor = Math.pow(1.0015, -e.deltaY);
      const newScale = clamp(world.scale.x * zoomFactor, minScale, maxScale);
      applyZoom(newScale, globalPos);
    },
    { passive: false },
  );

  // ピンチ操作（タッチ）によるズーム
  const pointers = new Map<number, { x: number; y: number }>();
  let isPinching = false;
  let initialDistance = 0;
  let initialScale = 1;

  const setPointerCapture = (e: PointerEvent, capture: boolean) => {
    if (!(e.target instanceof Element)) return;
    try {
      if (capture) {
        e.target.setPointerCapture(e.pointerId);
      } else {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch {
      // 無視
    }
  };

  const updatePinch = () => {
    if (!isPinching || pointers.size < 2) return;

    const [a, b] = Array.from(pointers.values());
    const newDistance = Math.hypot(a.x - b.x, a.y - b.y);
    const factor = newDistance / initialDistance;
    const newScale = clamp(initialScale * factor, minScale, maxScale);

    const centerClientX = (a.x + b.x) / 2;
    const centerClientY = (a.y + b.y) / 2;
    const globalPos = mapClientToGlobal(centerClientX, centerClientY);

    applyZoom(newScale, globalPos);
  };

  app.canvas.addEventListener("pointerdown", (e: PointerEvent) => {
    setPointerCapture(e, true);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      isPinching = true;
      const [a, b] = Array.from(pointers.values());
      initialDistance = Math.hypot(a.x - b.x, a.y - b.y);
      initialScale = world.scale.x;
    }
  });

  app.canvas.addEventListener("pointermove", (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    updatePinch();
  });

  app.canvas.addEventListener("pointerup", (e: PointerEvent) => {
    setPointerCapture(e, false);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      isPinching = false;
    }
  });

  app.canvas.addEventListener("pointercancel", (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      isPinching = false;
    }
  });

  // ヘルパー関数: アイテムをワールドに追加し、eventModeを自動設定
  const addItem = <T extends ContainerChild>(item: T): T => {
    if ("eventMode" in item) {
      item.eventMode = "static";
    }
    world.addChild(item);
    return item;
  };

  // ヘルパー関数: 複数のアイテムを一括追加
  const addItems = <T extends ContainerChild>(...items: T[]): T[] => {
    items.forEach((item) => addItem(item));
    return items;
  };

  return { world, addItem, addItems };
};
