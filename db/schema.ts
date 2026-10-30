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
  revision: text("revision").notNull().default("initial"),
  meetingDate: text("meeting_date").notNull(),
  pointName: text("point_name").notNull(),
  themeColor: text("theme_color").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("weekly_points_market_week_version_idx").on(table.marketId, table.year, table.week, table.version),
  index("weekly_points_market_created_idx").on(table.marketId, table.createdAt),
]);

export const analystWeeklyPoints = sqliteTable("analyst_weekly_points", {
  id: text("id").primaryKey(),
  revision: text("revision").notNull().default("initial"),
  analystId: text("analyst_id").notNull(),
  year: integer("year").notNull(),
  week: integer("week").notNull(),
  meetingDate: text("meeting_date").notNull(),
  periodFrom: text("period_from").notNull(),
  periodTo: text("period_to").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("analyst_weekly_points_analyst_period_idx").on(table.analystId, table.year, table.week),
  index("analyst_weekly_points_analyst_updated_idx").on(table.analystId, table.updatedAt),
]);

// Editing drafts remain separate from shared weekly points.
export const pointDrafts = sqliteTable("point_drafts", {
  editor: text("editor").notNull(),
  scope: text("scope").notNull(),
  ownerId: text("owner_id").notNull(),
  year: integer("year").notNull(),
  week: integer("week").notNull(),
  meetingDate: text("meeting_date").notNull(),
  payload: text("payload").notNull(),
  revision: text("revision").notNull(),
  basePointId: text("base_point_id"),
  basePointRevision: text("base_point_revision"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("point_drafts_editor_owner_week_idx").on(table.editor, table.scope, table.ownerId, table.year, table.week),
  index("point_drafts_editor_owner_updated_idx").on(table.editor, table.scope, table.ownerId, table.updatedAt),
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

export const jiraAnalystWeeklySnapshots = sqliteTable("jira_analyst_weekly_snapshots", {
  id: text("id").primaryKey(),
  analystId: text("analyst_id").notNull().references(() => globalUsers.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  week: integer("week").notNull(),
  rawText: text("raw_text").notNull(),
  payload: text("payload").notNull(),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("jira_analyst_weekly_snapshots_analyst_period_idx").on(table.analystId, table.year, table.week),
  index("jira_analyst_weekly_snapshots_analyst_updated_idx").on(table.analystId, table.updatedAt),
]);

export const jiraImportBatches = sqliteTable("jira_import_batches", {
  id: text("id").primaryKey(),
  sourceProfile: text("source_profile").notNull().default("jira-participants"),
  filename: text("filename").notNull().default(""),
  status: text("status").notNull().default("uploading"),
  rowCount: integer("row_count").notNull().default(0),
  ticketCount: integer("ticket_count").notNull().default(0),
  participantCount: integer("participant_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  repairedTextCount: integer("repaired_text_count").notNull().default(0),
  unknownUserCodeCount: integer("unknown_usercode_count").notNull().default(0),
  importedBy: text("imported_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => [
  index("jira_import_batches_status_created_idx").on(table.status, table.createdAt),
]);

export const jiraImportTickets = sqliteTable("jira_import_tickets", {
  id: text("id").primaryKey(),
  importId: text("import_id").notNull().references(() => jiraImportBatches.id, { onDelete: "cascade" }),
  ticketKey: text("ticket_key").notNull(),
  internalId: text("internal_id").notNull().default(""),
  status: text("status").notNull().default(""),
  summary: text("summary").notNull().default(""),
  issueType: text("issue_type").notNull().default(""),
  category: text("category").notNull().default(""),
  subcategory: text("subcategory").notNull().default(""),
  jiraCreatedAt: text("jira_created_at").notNull().default(""),
  assigneeUserCode: text("assignee_usercode").notNull().default(""),
  jiraUpdatedAt: text("jira_updated_at").notNull().default(""),
  resolutionAt: text("resolution_at").notNull().default(""),
  link: text("link").notNull().default(""),
}, (table) => [
  uniqueIndex("jira_import_tickets_import_key_idx").on(table.importId, table.ticketKey),
  index("jira_import_tickets_import_idx").on(table.importId),
]);

export const jiraImportParticipants = sqliteTable("jira_import_participants", {
  id: text("id").primaryKey(),
  importId: text("import_id").notNull().references(() => jiraImportBatches.id, { onDelete: "cascade" }),
  ticketKey: text("ticket_key").notNull(),
  usercode: text("usercode").notNull(),
  jiraUserId: text("jira_user_id").notNull().default(""),
}, (table) => [
  uniqueIndex("jira_import_participants_import_ticket_usercode_idx").on(table.importId, table.ticketKey, table.usercode),
  index("jira_import_participants_import_idx").on(table.importId),
]);

export const jiraTickets = sqliteTable("jira_tickets", {
  key: text("ticket_key").primaryKey(),
  internalId: text("internal_id").notNull().default(""),
  status: text("status").notNull().default(""),
  summary: text("summary").notNull().default(""),
  issueType: text("issue_type").notNull().default(""),
  category: text("category").notNull().default(""),
  subcategory: text("subcategory").notNull().default(""),
  jiraCreatedAt: text("jira_created_at").notNull().default(""),
  assigneeUserCode: text("assignee_usercode").notNull().default(""),
  jiraUpdatedAt: text("jira_updated_at").notNull().default(""),
  resolutionAt: text("resolution_at").notNull().default(""),
  link: text("link").notNull().default(""),
  lastImportId: text("last_import_id").notNull().default(""),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("jira_tickets_assignee_status_idx").on(table.assigneeUserCode, table.status),
  index("jira_tickets_updated_idx").on(table.jiraUpdatedAt),
  index("jira_tickets_last_import_idx").on(table.lastImportId),
]);

export const jiraTicketParticipants = sqliteTable("jira_ticket_participants", {
  id: text("id").primaryKey(),
  ticketKey: text("ticket_key").notNull().references(() => jiraTickets.key, { onDelete: "cascade" }),
  usercode: text("usercode").notNull(),
  jiraUserId: text("jira_user_id").notNull().default(""),
  lastImportId: text("last_import_id").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("jira_ticket_participants_ticket_usercode_idx").on(table.ticketKey, table.usercode),
  index("jira_ticket_participants_usercode_idx").on(table.usercode),
  index("jira_ticket_participants_import_idx").on(table.lastImportId),
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
