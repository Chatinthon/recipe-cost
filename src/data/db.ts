import Dexie, { type Table } from 'dexie';
import type { Ingredient, Recipe, RecipeItem } from '../engine/types';

export interface PriceHistoryRow {
  id: string;
  ingredientId: string;
  /** satang */
  packPrice: number;
  packSize: number | null;
  packUnit: string | null;
  store?: string;
  recordedAt: string; // YYYY-MM-DD
  updatedAt: string;
  deleted?: boolean;
}

export interface SettingRow {
  key: string;
  value: string;
  updatedAt: string;
}

export type SyncTable = 'Ingredients' | 'PriceHistory' | 'Recipes' | 'RecipeItems' | 'Settings';

export interface OutboxRow {
  seq?: number;
  table: SyncTable;
  key: string;
  queuedAt: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  ingredients!: Table<Ingredient, string>;
  recipes!: Table<Recipe, string>;
  recipeItems!: Table<RecipeItem, string>;
  priceHistory!: Table<PriceHistoryRow, string>;
  settings!: Table<SettingRow, string>;
  outbox!: Table<OutboxRow, number>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'recipe-cost') {
    super(name);
    this.version(1).stores({
      ingredients: 'id, updatedAt',
      recipes: 'id, updatedAt',
      recipeItems: 'id, recipeId, refId, updatedAt',
      priceHistory: 'id, ingredientId, updatedAt',
      settings: 'key',
      outbox: '++seq, [table+key]',
      meta: 'key',
    });
  }
}

export let db = new AppDB();

/** Tests only: swap in a fresh database. */
export function resetDbForTests(name: string) {
  db = new AppDB(name);
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return crypto.randomUUID();
}
