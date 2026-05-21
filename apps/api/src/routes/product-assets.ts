import { Router } from "express";
import {
  ProductAssetGenerationEnqueueResponseSchema,
  ProductAssetGenerationRequestSchema
} from "@deskterioronline/contracts/product-assets";
import { ApiError } from "../services/errors";
import { createProductAssetGenerationJobForOwner } from "../services/product-asset-service";

export const productAssetsRouter = Router();

productAssetsRouter.post("/generate", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const payload = ProductAssetGenerationRequestSchema.parse(request.body);
    const job = await createProductAssetGenerationJobForOwner(ownerId, payload);
    const responseBody = ProductAssetGenerationEnqueueResponseSchema.parse({
      jobId: job.id,
      status: job.status
    });
    response.status(202).json(responseBody);
  } catch (error) {
    next(error);
  }
});
