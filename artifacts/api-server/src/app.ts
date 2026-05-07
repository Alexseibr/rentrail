import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/error-handler";
import { correlationId } from "./middlewares/correlation-id";

const app: Express = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMIT",
      message: "Too many requests, please try again later",
    },
  },
  skip: () => process.env.NODE_ENV !== "production",
});

const iotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMIT", message: "Too many commands, slow down" },
  },
  skip: () => process.env.NODE_ENV !== "production",
});

app.use(correlationId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) =>
      (req as express.Request & { correlationId?: string }).correlationId ?? "",
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/phone/login", authLimiter);
app.use("/api/auth/phone/request-otp", authLimiter);
app.use("/api/auth/phone/verify-otp", authLimiter);
app.use("/api/auth/client/login", authLimiter);
app.use("/api/client/vehicles/:id/lock", iotLimiter);
app.use("/api/client/vehicles/:id/unlock", iotLimiter);
app.use("/api/client/vehicles/:id/arm", iotLimiter);
app.use("/api/client/vehicles/:id/disarm", iotLimiter);
app.use("/api", router);

app.use(errorHandler);

export default app;
