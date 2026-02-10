import type { ResourceId, ResourceStack } from "./resource.ts";

export type { ResourceStack };

/**
 * インベントリ — リソースIDごとの数量管理
 */
export class Inventory {
  private items = new Map<ResourceId, number>();
  public maxCapacity: number;

  constructor(maxCapacity = 0) {
    this.maxCapacity = maxCapacity;
  }

  /** 現在の総数 */
  get totalAmount(): number {
    let sum = 0;
    for (const v of this.items.values()) sum += v;
    return sum;
  }

  /** 特定リソースの数量 */
  getAmount(id: ResourceId): number {
    return this.items.get(id) ?? 0;
  }

  /** 追加（追加できた数を返す） */
  add(id: ResourceId, amount: number): number {
    if (amount <= 0) return 0;
    if (this.maxCapacity > 0) {
      amount = Math.min(amount, this.maxCapacity - this.totalAmount);
    }
    if (amount <= 0) return 0;
    this.items.set(id, this.getAmount(id) + amount);
    return amount;
  }

  /** 取り出し（取り出せた数を返す） */
  remove(id: ResourceId, amount: number): number {
    const current = this.getAmount(id);
    const removed = Math.min(current, amount);
    if (removed <= 0) return 0;
    const remaining = current - removed;
    if (remaining <= 0) this.items.delete(id);
    else this.items.set(id, remaining);
    return removed;
  }

  has(id: ResourceId, amount: number): boolean {
    return this.getAmount(id) >= amount;
  }

  hasAll(stacks: ResourceStack[]): boolean {
    return stacks.every((s) => this.has(s.resourceId, s.amount));
  }

  removeAll(stacks: ResourceStack[]): boolean {
    if (!this.hasAll(stacks)) return false;
    for (const s of stacks) this.remove(s.resourceId, s.amount);
    return true;
  }

  get isEmpty(): boolean {
    return this.items.size === 0;
  }

  toStacks(): ResourceStack[] {
    const result: ResourceStack[] = [];
    for (const [resourceId, amount] of this.items) {
      if (amount > 0) result.push({ resourceId, amount });
    }
    return result;
  }

  clear() {
    this.items.clear();
  }

  toJSON(): ResourceStack[] {
    return this.toStacks();
  }

  static fromJSON(data: ResourceStack[], maxCapacity = 0): Inventory {
    const inv = new Inventory(maxCapacity);
    for (const s of data) inv.add(s.resourceId, s.amount);
    return inv;
  }
}
