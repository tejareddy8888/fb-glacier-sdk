import { Router } from "express";
import { ApiController } from "./controllers/controller.js";

const router: Router = Router();
const apiController = new ApiController();

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
 *               sourceVaultId: "123"
 *               destinationVaultId: "456"
 *               claimId: "abc123"
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
 *             example:
 *               vaultAccountId: "123"
 *               claimType: "reward"
 *     responses:
 *       200:
 *         description: Claims processed
 */
router.post("/claims/:chain", apiController.makeClaims);

export default router;
