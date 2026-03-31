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
import publicRouter from "./public";
import inquiriesRouter from "./inquiries";
import b2bRequestsRouter from "./b2b-requests";
import notificationsRouter from "./notifications";
import companySettingsRouter from "./company-settings";

const router: IRouter = Router();

router.use(publicRouter);
router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(branchesRouter);
router.use(stationsRouter);
router.use(clientsRouter);
router.use(assetsRouter);
router.use(rentalsRouter);
router.use(blacklistRouter);
router.use(inquiriesRouter);
router.use(b2bRequestsRouter);
router.use(notificationsRouter);
router.use(companySettingsRouter);

export default router;
