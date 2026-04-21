import { Router } from "express";
import {
  AssetGenerationEnqueueResponseSchema,
  AssetGenerationRequestSchema
} from "@deskterioronline/contracts/assets";
import { ApiError } from "../services/errors";
import { createAssetGenerationJobForOwner } from "../services/asset-service";

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
