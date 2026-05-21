import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env, isCorsOriginAllowed } from "./config/env";
import { requireAuth } from "./middleware/auth";
import { assetsRouter } from "./routes/assets";
import { healthRouter } from "./routes/health";
import { productAssetsRouter } from "./routes/product-assets";
import { ApiError } from "./services/errors";

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "[unserializable error object]";
    }
  }

  return String(error);
}

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (isCorsOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "20mb" }));

  app.use("/v1", healthRouter);
  app.use("/v1/assets", requireAuth, assetsRouter);
  app.use("/v1/product-assets", requireAuth, productAssetsRouter);

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({
        error: error.message,
        ...(error.payload ?? {})
      });
      return;
    }

    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      response.status(400).json({
        error: "Invalid request payload",
        details: (error as any).issues ?? []
      });
      return;
    }

    const message = serializeUnknownError(error);
    response.status(500).json({ error: "Internal server error", details: message });
  });

  return app;
}
