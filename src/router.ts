import { Router } from "express";
import { ApiController } from "./controllers/controller.js";

const router: Router = Router();
const apiController = new ApiController();

/**
 * @openapi
 * /api/provetree/check/{chain}/{vaultAccountId}:
 *   get:
 *     summary: Check address existence in Provetree
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
 *         description: Address found or not
 */
router.get(
  "/provetree/check/:chain/:vaultAccountId",
  apiController.checkAddress
);

/**
 * @openapi
 * /api/claim/claims/{chain}/{vaultAccountId}:
 *   get:
 *     summary: Get claims for a vault
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
router.get("/claim/claims/:chain/:vaultAccountId", apiController.getClaims);

/**
 * @openapi
 * /api/fireblocks/vaults/{chain}/{vaultAccountId}:
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
  "/fireblocks/vaults/:chain/:vaultAccountId",
  apiController.getVaultAccountAddresses
);

/**
 * @openapi
 * /api/claim/transfer:
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
router.post("/claim/transfer", apiController.transferClaims);

/**
 * @openapi
 * /api/claim/claims/{chain}:
 *   post:
 *     summary: Make claims
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
router.post("/claim/claims/:chain", apiController.makeClaims);

export default router;
