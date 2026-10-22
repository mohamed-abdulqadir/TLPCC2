import { createInsertSchema } from "drizzle-zod";
import { date, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const actionsTable = pgTable(
  "actions",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    assignedTo: text("assigned_to").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("Not Started"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("actions_status_idx").on(table.status),
    index("actions_due_date_idx").on(table.dueDate),
  ],
);

export const insertActionSchema = createInsertSchema(actionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAction = z.infer<typeof insertActionSchema>;
export type Action = typeof actionsTable.$inferSelect;
