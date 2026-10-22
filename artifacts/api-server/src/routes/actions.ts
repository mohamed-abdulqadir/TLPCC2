import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateActionBody,
  CreateActionResponse,
  ListActionsResponse,
  UpdateActionBody,
  UpdateActionParams,
  UpdateActionResponse,
} from "@workspace/api-zod";
import { db, actionsTable } from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();
router.use(requireStaff);

router.get("/actions", async (_req, res): Promise<void> => {
  const actions = await db
    .select()
    .from(actionsTable)
    .orderBy(asc(actionsTable.dueDate), asc(actionsTable.createdAt));

  res.json(ListActionsResponse.parse(actions));
});

router.post("/actions", async (req, res): Promise<void> => {
  const parsed = CreateActionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [action] = await db
    .insert(actionsTable)
    .values({
      ...parsed.data,
      dueDate: parsed.data.dueDate.toISOString().slice(0, 10),
    })
    .returning();

  res.status(201).json(CreateActionResponse.parse(action));
});

router.patch("/actions/:id", async (req, res): Promise<void> => {
  const parsedParams = UpdateActionParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const parsedBody = UpdateActionBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  if (Object.keys(parsedBody.data).length === 0) {
    res.status(400).json({ error: "At least one action field must be provided." });
    return;
  }

  const updates: Partial<typeof actionsTable.$inferInsert> = {};
  if (parsedBody.data.title !== undefined) updates.title = parsedBody.data.title;
  if (parsedBody.data.reason !== undefined) updates.reason = parsedBody.data.reason;
  if (parsedBody.data.assignedTo !== undefined) {
    updates.assignedTo = parsedBody.data.assignedTo;
  }
  if (parsedBody.data.dueDate !== undefined) {
    updates.dueDate = parsedBody.data.dueDate.toISOString().slice(0, 10);
  }
  if (parsedBody.data.status !== undefined) updates.status = parsedBody.data.status;

  const [action] = await db
    .update(actionsTable)
    .set(updates)
    .where(eq(actionsTable.id, parsedParams.data.id))
    .returning();

  if (!action) {
    res.status(404).json({ error: "Action not found." });
    return;
  }

  res.json(UpdateActionResponse.parse(action));
});

export default router;
