import type { Trade, TradeTier, TradeItem } from "./types.js";

export type { Trade, TradeTier, TradeItem };

/**
 * Represents a villager trading table from the behavior pack's `trading/` directory.
 * Trading tables define the tiers of trades available for a villager profession.
 *
 * @example
 * ```ts
 * const table = addon.getTradingTable("armorer_trades");
 * console.log(table?.tiers[0].trades[0]);
 * ```
 */
export class TradingTable {
  /** The raw parsed JSON of the trading table file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the trading table file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;
  /** The file name without extension, used as the lookup key. e.g. `"armorer_trades"`. */
  readonly name: string;
  /** The ordered list of trade tiers. Players unlock higher tiers by completing trades. */
  readonly tiers: TradeTier[];

  constructor(data: Record<string, unknown>, filePath: string, name: string) {
    this.data = data;
    this.filePath = filePath;
    this.name = name;
    this.tiers = this._parseTiers(data);
  }

  /**
   * Returns a flat deduplicated list of every item identifier referenced
   * across all tiers and trades, including both wanted and given items.
   */
  getAllItemIdentifiers(): string[] {
    const ids: string[] = [];
    for (const tier of this.tiers)
      for (const trade of tier.trades) {
        for (const w of trade.wants) ids.push(w.item);
        for (const g of trade.gives) ids.push(g.item);
      }
    return [...new Set(ids)];
  }

  private _parseTiers(data: Record<string, unknown>): TradeTier[] {
    const raw = data["tiers"];
    if (!Array.isArray(raw)) return [];
    return raw.map((t: unknown) => {
      const tier = t as Record<string, unknown>;
      const tradeSource = Array.isArray(tier["trades"])
        ? (tier["trades"] as Record<string, unknown>[])
        : Array.isArray(tier["groups"])
          ? (tier["groups"] as Record<string, unknown>[]).flatMap((g) =>
              Array.isArray((g as Record<string, unknown>)["trades"])
                ? ((g as Record<string, unknown>)["trades"] as Record<string, unknown>[])
                : []
            )
          : [];
      const trades: Trade[] = tradeSource.map((tr) => ({
        wants: this._parseTradeItems(tr["wants"]),
        gives: this._parseTradeItems(tr["gives"]),
      }));
      return { trades };
    });
  }

  private _parseTradeItems(raw: unknown): TradeItem[] {
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).map((r) => ({
      item: (r["item"] as string) ?? "",
      quantity: (r["quantity"] as TradeItem["quantity"]) ?? 1,
    }));
  }
}
