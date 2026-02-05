# AI MEMOs

## PixiJS drag + grid notes

- Use `TilingSprite` with a generated grid texture for an infinite grid background; update `grid.width/height` on renderer resize.
- For drag scrolling, move a `world` Container and adjust `grid.tilePosition` by drag delta.
- To prevent dragging when clicking on world items, check `event.target` in the stage's `pointerdown` handler - only allow dragging when target is the stage or grid.
- Set `eventMode = "static"` on all interactive items so they can be detected as event targets.
- Use helper functions `addItem()` or `addItems()` to automatically set `eventMode` and add items to world in one step.
