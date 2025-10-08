import { Router } from "express";
import { ApiController } from "./controllers/controller.js";
import { FbNightApiService } from "./apiService.js";

export const configureRouter = (api: FbNightApiService): Router => {
  const router: Router = Router();
  const apiController = new ApiController(api);

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     responses:
   *       200:
   *         description: Service is healthy
   */
  router.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  /**
   * @openapi
   * /metrics:
   *   get:
   *     summary: Get SDK pool metrics
   *     responses:
   *       200:
   *         description: Pool metrics
   */
  router.get("/metrics", apiController.getPoolMetrics);

  /**
   * @openapi
   * /clear-pool:
   *   post:
   *     summary: Clear idle SDK instances from pool
   *     responses:
   *       200:
   *         description: Pool cleared successfully
   */
  router.post("/clear-pool", apiController.clearPool);

  /**
   * @openapi
   * /api/check/{chain}/{vaultAccountId}:
   *   get:
   *     summary: Fetches address' allocation value by vault account and blockchain
   *     parameters:
   *       - in: path
   *         name: chain
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: vaultAccountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Indicates whether the address was found
   */
  router.get(
    "/check/:chain/:vaultAccountId",
    apiController.checkAddressAllocation
  );

  /**
   * @openapi
   * /api/claims/{chain}/{vaultAccountId}:
   *   get:
   *     summary: Get claims history for a vault
   *     parameters:
   *       - in: path
   *         name: chain
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: vaultAccountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of claims
   */
  router.get("/claims/:chain/:vaultAccountId", apiController.getClaimsHistory);

  /**
   * @openapi
   * /api/vaults/{chain}/{vaultAccountId}:
   *   get:
   *     summary: Get Fireblocks vault addresses
   *     parameters:
   *       - in: path
   *         name: chain
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: vaultAccountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Vault addresses
   */
  router.get(
    "/vaults/:chain/:vaultAccountId",
    apiController.getVaultAccountAddresses
  );

  /**
   * @openapi
   * /api/transfer:
   *   post:
   *     summary: Transfer claim ownership
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             example:
   *               vaultAccountId: "123"
   *               recipientAddress: "addr1qxyz"
   *               tokenPolicyId: "abc123"
   *               requiredTokenAmount: 1000
   *     responses:
   *       200:
   *         description: Claim transferred
   */
  router.post("/transfer", apiController.transferClaims);

  /**
   * @openapi
   * /api/claims/{chain}:
   *   post:
   *     summary: Make NIGHT claims for a vault account
   *     parameters:
   *       - in: path
   *         name: chain
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - originVaultAccountId
   *               - destinationAddress
   *             properties:
   *               originVaultAccountId:
   *                 type: string
   *                 description: Source vault account ID
   *                 example: "123"
   *               destinationAddress:
   *                 type: string
   *                 description: Recipient blockchain address
   *                 example: "addr1qxyz..."
   *     responses:
   *       200:
   *         description: Claims processed
   */
  router.post("/claims/:chain", apiController.makeClaims);

  return router;
};
