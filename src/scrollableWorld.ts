import {
  Application,
  Container,
  Graphics,
  Rectangle,
  TilingSprite,
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
  // NOTE :気にしないほうが幸せなエラー
  const gridTexture = app.renderer.generateTexture(gridPattern, {
    // 明示的に切り抜き領域を指定して余分な余白を防ぐ
    region: new Rectangle(0, 0, gridSize, gridSize),
    // レンダラーの resolution に合わせて高解像度（Retina）対応する
    resolution: app.renderer.resolution,
  });
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

  updateGridSize();
  app.renderer.on("resize", updateGridSize);

  app.stage.addChild(grid);

  const world = new Container();
  app.stage.addChild(world);

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.renderer.on("resize", () => {
    app.stage.hitArea = app.screen;
  });

  let isDragging = false;
  let lastPosition = { x: 0, y: 0 };

  app.stage.on("pointerdown", (event) => {
    // worldの子要素がクリックされた場合はドラッグしない
    if (event.target && event.target !== app.stage && event.target !== grid) {
      return;
    }

    isDragging = true;
    lastPosition = { x: event.global.x, y: event.global.y };
  });

  app.stage.on("pointerup", () => {
    isDragging = false;
  });

  app.stage.on("pointerupoutside", () => {
    isDragging = false;
  });

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

  // ヘルパー関数: アイテムをworldに追加し、eventModeを自動設定
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
