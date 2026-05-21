import { Router } from "express";
import {
  AssetGenerationEnqueueResponseSchema,
  AssetGenerationRequestSchema
} from "@deskterioronline/contracts/assets";
import { ApiError } from "../services/errors";
import { createAssetGenerationJobForOwner } from "../services/asset-service";
import { listGeneratedAssetsForOwner } from "../repositories/assets-repo";

export const assetsRouter = Router();

assetsRouter.post("/generate", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = AssetGenerationRequestSchema.parse(request.body);
    const job = await createAssetGenerationJobForOwner(ownerId, payload);
    const responseBody = AssetGenerationEnqueueResponseSchema.parse({
      jobId: job.id,
      status: job.status
    });
    response.status(202).json(responseBody);
  } catch (error) {
    next(error);
  }
});

assetsRouter.get("/", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const items = await listGeneratedAssetsForOwner(ownerId);
    response.status(200).json({ items });
  } catch (error) {
    next(error);
  }
});
