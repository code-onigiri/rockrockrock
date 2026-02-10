/**
 * 下部パレットUI — 機械カテゴリボタン → 展開 → ドラッグ&ドロップで配置
 *
 * HTML/CSS ベースのオーバーレイUI。
 * ドラッグ開始時にゴースト要素を表示し、ドロップ時にコールバックで
 * ワールド座標に変換してノードを追加する。
 *
 * パレットカードにはポートタイプのサマリを表示。
 */

import {
  MACHINE_CATEGORIES,
  type MachineTypeDef,
  getMachinesByCategory,
} from "./game/nodeTypes.ts";
import { getPortTypeName } from "./game/resource.ts";
import type { PortType } from "./game/resource.ts";

export interface PaletteDropEvent {
  machineType: MachineTypeDef;
  screenX: number;
  screenY: number;
}

export class MachinePalette {
  private container: HTMLDivElement;
  private categoryBar: HTMLDivElement;
  private itemPanel: HTMLDivElement;
  private activeCategory: string | null = null;

  public onDrop?: (event: PaletteDropEvent) => void;

  private dragGhost: HTMLDivElement | null = null;
  private dragMachineType: MachineTypeDef | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "machine-palette";
    Object.assign(this.container.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      zIndex: "1000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      pointerEvents: "none",
    });

    this.itemPanel = document.createElement("div");
    Object.assign(this.itemPanel.style, {
      display: "none",
      flexWrap: "wrap",
      gap: "6px",
      padding: "8px 12px",
      background: "rgba(30,30,30,0.92)",
      borderRadius: "8px 8px 0 0",
      border: "1px solid rgba(255,255,255,0.15)",
      borderBottom: "none",
      pointerEvents: "auto",
      maxWidth: "600px",
      justifyContent: "center",
    });
    this.container.appendChild(this.itemPanel);

    this.categoryBar = document.createElement("div");
    Object.assign(this.categoryBar.style, {
      display: "flex",
      gap: "4px",
      padding: "6px 12px",
      background: "rgba(20,20,20,0.95)",
      borderRadius: "8px 8px 0 0",
      pointerEvents: "auto",
    });
    this.container.appendChild(this.categoryBar);

    this.buildCategories();
    document.body.appendChild(this.container);

    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));
  }

  private buildCategories() {
    for (const cat of MACHINE_CATEGORIES) {
      const btn = document.createElement("button");
      btn.textContent = cat.name;
      btn.dataset.catId = cat.id;
      const colorHex = `#${cat.color.toString(16).padStart(6, "0")}`;
      Object.assign(btn.style, {
        background: "rgba(50,50,50,0.9)",
        color: colorHex,
        border: `1px solid ${colorHex}`,
        borderRadius: "4px",
        padding: "4px 12px",
        fontSize: "12px",
        fontWeight: "bold",
        cursor: "pointer",
        transition: "background 0.15s",
      });

      btn.addEventListener("mouseenter", () => {
        btn.style.background = `rgba(80,80,80,0.9)`;
      });
      btn.addEventListener("mouseleave", () => {
        if (this.activeCategory !== cat.id) {
          btn.style.background = "rgba(50,50,50,0.9)";
        }
      });

      btn.addEventListener("click", () => this.toggleCategory(cat.id));
      this.categoryBar.appendChild(btn);
    }
  }

  private toggleCategory(catId: string) {
    if (this.activeCategory === catId) {
      this.activeCategory = null;
      this.itemPanel.style.display = "none";
      this.resetCategoryButtons();
      return;
    }

    this.activeCategory = catId;
    this.resetCategoryButtons();

    const btns = this.categoryBar.querySelectorAll("button");
    btns.forEach((b) => {
      if ((b as HTMLButtonElement).dataset.catId === catId) {
        (b as HTMLElement).style.background = "rgba(100,100,100,0.9)";
      }
    });

    this.buildItemPanel(catId);
  }

  private resetCategoryButtons() {
    const btns = this.categoryBar.querySelectorAll("button");
    btns.forEach((b) => {
      (b as HTMLElement).style.background = "rgba(50,50,50,0.9)";
    });
  }

  private buildItemPanel(catId: string) {
    this.itemPanel.innerHTML = "";
    this.itemPanel.style.display = "flex";

    const byCategory = getMachinesByCategory();
    const machines = byCategory.get(catId) ?? [];

    for (const def of machines) {
      const card = document.createElement("div");
      const colorHex = `#${def.titleColor.toString(16).padStart(6, "0")}`;
      Object.assign(card.style, {
        background: "rgba(45,45,45,0.95)",
        border: `1px solid ${colorHex}`,
        borderRadius: "4px",
        padding: "6px 10px",
        cursor: "grab",
        userSelect: "none",
        minWidth: "80px",
        textAlign: "center",
        transition: "transform 0.1s, box-shadow 0.1s",
      });

      const nameSpan = document.createElement("div");
      nameSpan.textContent = def.name;
      Object.assign(nameSpan.style, {
        color: colorHex,
        fontSize: "11px",
        fontWeight: "bold",
      });
      card.appendChild(nameSpan);

      // ポートタイプサマリ
      const infoSpan = document.createElement("div");
      const portSummary = this.getPortSummary(def);
      infoSpan.textContent = portSummary;
      Object.assign(infoSpan.style, {
        color: "#888",
        fontSize: "8px",
        marginTop: "2px",
      });
      card.appendChild(infoSpan);

      card.addEventListener("mouseenter", () => {
        card.style.transform = "scale(1.05)";
        card.style.boxShadow = `0 0 8px ${colorHex}44`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "scale(1)";
        card.style.boxShadow = "none";
      });

      card.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.startDrag(def, e.clientX, e.clientY, colorHex);
      });

      this.itemPanel.appendChild(card);
    }
  }

  private getPortSummary(def: MachineTypeDef): string {
    const countByType = (ports: { type: PortType }[]) => {
      const m = new Map<PortType, number>();
      for (const p of ports) m.set(p.type, (m.get(p.type) ?? 0) + 1);
      return [...m.entries()]
        .map(([t, n]) => `${getPortTypeName(t)}×${n}`)
        .join(" ");
    };
    const inStr = countByType(def.inputPorts);
    const outStr = countByType(def.outputPorts);
    return `${inStr || "—"} → ${outStr || "—"}`;
  }

  // ─── ドラッグ＆ドロップ ───

  private startDrag(def: MachineTypeDef, x: number, y: number, color: string) {
    this.dragMachineType = def;

    this.dragGhost = document.createElement("div");
    Object.assign(this.dragGhost.style, {
      position: "fixed",
      left: `${x - 40}px`,
      top: `${y - 20}px`,
      width: "80px",
      height: "40px",
      background: "rgba(45,45,45,0.85)",
      border: `2px solid ${color}`,
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: color,
      fontSize: "11px",
      fontWeight: "bold",
      pointerEvents: "none",
      zIndex: "2000",
      opacity: "0.9",
      boxShadow: `0 0 12px ${color}44`,
    });
    this.dragGhost.textContent = def.name;
    document.body.appendChild(this.dragGhost);
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.dragGhost) return;
    this.dragGhost.style.left = `${e.clientX - 40}px`;
    this.dragGhost.style.top = `${e.clientY - 20}px`;
  }

  private onMouseUp(e: MouseEvent) {
    if (!this.dragGhost || !this.dragMachineType) return;

    const paletteRect = this.container.getBoundingClientRect();
    const droppedOnPalette = e.clientY >= paletteRect.top;

    if (!droppedOnPalette) {
      this.onDrop?.({
        machineType: this.dragMachineType,
        screenX: e.clientX,
        screenY: e.clientY,
      });
    }

    document.body.removeChild(this.dragGhost);
    this.dragGhost = null;
    this.dragMachineType = null;
  }

  destroy() {
    document.removeEventListener("mousemove", this.onMouseMove.bind(this));
    document.removeEventListener("mouseup", this.onMouseUp.bind(this));
    this.container.remove();
  }
}
