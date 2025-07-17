import { Request, Response } from "express";
import { SupportedBlockchains } from "../types.js";
import { getAssetIdsByBlockchain } from "../utils/general.js";
import { FireblocksMidnightSDK } from "../FireblocksMidnightSDK.js";

export class ApiController {
  private sdkCache = new Map<string, FireblocksMidnightSDK>();

  private getSdk = async (
    vaultAccountId: string,
    chain: SupportedBlockchains
  ) => {
    const key = `${vaultAccountId}-${chain}`;
    if (this.sdkCache.has(key)) return this.sdkCache.get(key)!;

    const assetId = getAssetIdsByBlockchain(chain);
    if (!assetId) {
      throw new Error(`Unsupported blockchain: ${chain}`);
    }
    const sdk = await FireblocksMidnightSDK.create(vaultAccountId, assetId);
    this.sdkCache.set(key, sdk);
    return sdk;
  };

  public checkAddress = async (req: Request, res: Response) => {
    const { vaultAccountId, chain } = req.params;
    try {
      const sdk = await this.getSdk(
        vaultAccountId,
        chain as SupportedBlockchains
      );
      const result = await sdk.checkAddress(chain as SupportedBlockchains);

      res.status(200).json({ value: result });
    } catch (error: any) {
      console.error("Error in checkAddress:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

  public getClaims = async (req: Request, res: Response) => {
    const { vaultAccountId, chain } = req.params;
    try {
      const sdk = await this.getSdk(
        vaultAccountId,
        chain as SupportedBlockchains
      );
      const result = await sdk.getClaims(chain as SupportedBlockchains);
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error in getClaims:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

  public makeClaims = async (req: Request, res: Response) => {
    const { chain } = req.params;
    const { assetId, originVaultAccountId, destinationAddress } = req.body;
    try {
      const sdk = await this.getSdk(
        String(originVaultAccountId),
        chain as SupportedBlockchains
      );
      const claims = await sdk.makeClaims(
        chain as SupportedBlockchains,
        assetId,
        destinationAddress
      );
      res.status(200).json(claims);
    } catch (error: any) {
      console.error(
        "Error in makeClaims:",
        error instanceof Error ? error.message : error
      );
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : error });
    }
  };

  public transferClaims = async (req: Request, res: Response) => {
    try {
      const {
        vaultAccountId,
        recipientAddress,
        tokenPolicyId,
        requiredTokenAmount,
      } = req.body;
      const sdk = await this.getSdk(
        String(vaultAccountId),
        SupportedBlockchains.CARDANO
      );
      const claims = await sdk.transferClaims(
        recipientAddress,
        tokenPolicyId,
        requiredTokenAmount,
      );
      res.status(200).json(claims);
    } catch (error: any) {
      console.error(
        "Error in transferClaims:",
        error instanceof Error ? error.message : error
      );
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : error });
    }
  };
}
