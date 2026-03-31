import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import branchesRouter from "./branches";
import stationsRouter from "./stations";
import clientsRouter from "./clients";
import assetsRouter from "./assets";
import rentalsRouter from "./rentals";
import blacklistRouter from "./blacklist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(branchesRouter);
router.use(stationsRouter);
router.use(clientsRouter);
router.use(assetsRouter);
router.use(rentalsRouter);
router.use(blacklistRouter);

export default router;
