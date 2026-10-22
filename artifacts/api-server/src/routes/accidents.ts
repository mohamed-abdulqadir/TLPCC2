import { and, count, desc, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAccidentBody,
  CreateAccidentResponse,
  GetDashboardResponse,
  ListAccidentsQueryParams,
  ListAccidentsResponse,
} from "@workspace/api-zod";
import { db, accidentsTable } from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();
router.use(requireStaff);

function asDateInput(value: Date | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

router.get("/accidents", async (req, res): Promise<void> => {
  const parsed = ListAccidentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filters = parsed.data;
  const conditions: SQL[] = [];
  const dateFrom = asDateInput(filters.dateFrom);
  const dateTo = asDateInput(filters.dateTo);

  if (dateFrom) conditions.push(gte(accidentsTable.date, dateFrom));
  if (dateTo) conditions.push(lt(accidentsTable.date, addOneDay(dateTo)));
  if (filters.room) conditions.push(ilike(accidentsTable.room, filters.room));
  if (filters.location) {
    conditions.push(ilike(accidentsTable.location, filters.location));
  }
  if (filters.accidentType) {
    conditions.push(ilike(accidentsTable.accidentType, filters.accidentType));
  }
  if (filters.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(accidentsTable.childName, search),
      ilike(accidentsTable.room, search),
      ilike(accidentsTable.location, search),
      ilike(accidentsTable.accidentType, search),
      ilike(accidentsTable.injuryType, search),
      ilike(accidentsTable.description, search),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select()
    .from(accidentsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(accidentsTable.date), desc(accidentsTable.time), desc(accidentsTable.createdAt));

  res.json(ListAccidentsResponse.parse(rows));
});

router.post("/accidents", async (req, res): Promise<void> => {
  const parsed = CreateAccidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [accident] = await db
    .insert(accidentsTable)
    .values({
      ...parsed.data,
      date: asDateInput(parsed.data.date)!,
    })
    .returning();

  res.status(201).json(CreateAccidentResponse.parse(accident));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const currentMonthCondition = and(
    gte(accidentsTable.date, monthStart),
    lt(accidentsTable.date, nextMonthStart),
  );

  const [{ total = 0 } = {}] = await db
    .select({ total: count() })
    .from(accidentsTable)
    .where(currentMonthCondition);
  const [byRoom, byLocation, byType, recentAccidents] = await Promise.all([
    db
      .select({ name: accidentsTable.room, count: count() })
      .from(accidentsTable)
      .groupBy(accidentsTable.room)
      .orderBy(desc(count())),
    db
      .select({ name: accidentsTable.location, count: count() })
      .from(accidentsTable)
      .groupBy(accidentsTable.location)
      .orderBy(desc(count())),
    db
      .select({ name: accidentsTable.accidentType, count: count() })
      .from(accidentsTable)
      .groupBy(accidentsTable.accidentType)
      .orderBy(desc(count())),
    db
      .select()
      .from(accidentsTable)
      .orderBy(desc(accidentsTable.date), desc(accidentsTable.time))
      .limit(5),
  ]);

  res.json(
    GetDashboardResponse.parse({
      totalThisMonth: total,
      byRoom,
      byLocation,
      byType,
      recentAccidents,
    }),
  );
});

function addOneDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default router;
