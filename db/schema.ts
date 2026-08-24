import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const marketDefinitions = sqliteTable("market_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortCode: text("short_code").notNull(),
  tone: text("tone").notNull().default("mint"),
  position: integer("position").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("market_definitions_name_idx").on(table.name),
  index("market_definitions_active_position_idx").on(table.isActive, table.position),
]);

export const weeklyPoints = sqliteTable("weekly_points", {
  id: text("id").primaryKey(),
  marketId: text("market_id").notNull(),
  year: integer("year").notNull(),
  week: integer("week").notNull(),
  version: integer("version").notNull(),
  meetingDate: text("meeting_date").notNull(),
  pointName: text("point_name").notNull(),
  themeColor: text("theme_color").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("weekly_points_market_week_version_idx").on(table.marketId, table.year, table.week, table.version),
  index("weekly_points_market_created_idx").on(table.marketId, table.createdAt),
]);
