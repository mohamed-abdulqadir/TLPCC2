import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accidentsRouter from "./accidents";
import actionsRouter from "./actions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accidentsRouter);
router.use(actionsRouter);

export default router;
