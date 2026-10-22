import { createInsertSchema } from "drizzle-zod";
import { date, index, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const accidentsTable = pgTable(
  "accidents",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    time: text("time").notNull(),
    childName: text("child_name").notNull(),
    room: text("room").notNull(),
    location: text("location").notNull(),
    accidentType: text("accident_type").notNull(),
    injuryType: text("injury_type").notNull(),
    description: text("description").notNull(),
    treatmentGiven: text("treatment_given").notNull(),
    parentInformed: boolean("parent_informed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("accidents_date_idx").on(table.date),
    index("accidents_room_idx").on(table.room),
    index("accidents_location_idx").on(table.location),
    index("accidents_type_idx").on(table.accidentType),
  ],
);

export const insertAccidentSchema = createInsertSchema(accidentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAccident = z.infer<typeof insertAccidentSchema>;
export type Accident = typeof accidentsTable.$inferSelect;
