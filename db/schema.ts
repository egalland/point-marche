import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const marketDefinitions = sqliteTable("market_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortCode: text("short_code").notNull(),
  tone: text("tone").notNull().default("mint"),
  colorHex: text("color_hex").notNull().default(""),
  plannerTags: text("planner_tags").notNull().default("[]"),
  jiraWarningDays: integer("jira_warning_days").notNull().default(10),
  jiraCriticalDays: integer("jira_critical_days").notNull().default(20),
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

export const jiraWeeklySnapshots = sqliteTable("jira_weekly_snapshots", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  week: integer("week").notNull(),
  rawText: text("raw_text").notNull(),
  payload: text("payload").notNull(),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("jira_weekly_snapshots_year_week_idx").on(table.year, table.week),
]);

export const jiraMarketWeeklySnapshots = sqliteTable("jira_market_weekly_snapshots", {
  id: text("id").primaryKey(),
  marketId: text("market_id").notNull().references(() => marketDefinitions.id),
  year: integer("year").notNull(),
  week: integer("week").notNull(),
  rawText: text("raw_text").notNull(),
  payload: text("payload").notNull(),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("jira_market_weekly_snapshots_market_period_idx").on(table.marketId, table.year, table.week),
  index("jira_market_weekly_snapshots_market_updated_idx").on(table.marketId, table.updatedAt),
]);

export const jiraMarketAssignments = sqliteTable("jira_market_assignments", {
  id: text("id").primaryKey(),
  marketId: text("market_id").notNull(),
  assignee: text("assignee").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("jira_market_assignments_market_person_idx").on(table.marketId, table.assignee),
  index("jira_market_assignments_market_idx").on(table.marketId),
]);

export const globalUsers = sqliteTable("global_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  usercode: text("jira_name").notNull(),
  plannerAlias: text("planner_alias").notNull().default(""),
  role: text("role").notNull().default("autre"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("global_users_email_idx").on(table.email),
  index("global_users_active_name_idx").on(table.isActive, table.name),
  index("global_users_jira_name_idx").on(table.usercode),
]);

export const globalUserMarkets = sqliteTable("global_user_markets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => globalUsers.id, { onDelete: "cascade" }),
  marketId: text("market_id").notNull().references(() => marketDefinitions.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("global_user_markets_user_market_idx").on(table.userId, table.marketId),
  index("global_user_markets_market_idx").on(table.marketId),
  index("global_user_markets_user_idx").on(table.userId),
]);

export const plannerTasks = sqliteTable("planner_tasks", {
  externalId: text("external_id").primaryKey(),
  taskName: text("task_name").notNull(),
  effectiveMonth: text("effective_month").notNull().default(""),
  plannerStatus: text("planner_status").notNull().default(""),
  category: text("category").notNull().default(""),
  simulationDate: text("simulation_date").notNull().default(""),
  controlDate: text("control_date").notNull().default(""),
  labels: text("labels").notNull().default("[]"),
  payload: text("payload").notNull(),
  importedBy: text("imported_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("planner_tasks_effective_month_idx").on(table.effectiveMonth),
  index("planner_tasks_simulation_date_idx").on(table.simulationDate),
  index("planner_tasks_control_date_idx").on(table.controlDate),
]);
