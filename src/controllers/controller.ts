import dotenv from "dotenv";
import { Request, Response } from "express";
import { SupportedBlockchains } from "../types.js";
import { getAssetIdsByBlockchain } from "../utils/general.js";
import { FireblocksMidnightSDK } from "../FireblocksMidnightSDK.js";

dotenv.config();

export class ApiController {
  private sdkCache = new Map<string, FireblocksMidnightSDK>();

  private getSdk = async (
    vaultAccountId: string,
    chain: SupportedBlockchains
  ) => {
    const key = `${vaultAccountId}-${chain}`;
    if (this.sdkCache.has(key)) return this.sdkCache.get(key)!;

    const assetId = getAssetIdsByBlockchain(chain)[0];
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

      res.status(200).json(result);
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
      res.status(200).json(claims.data);
    } catch (error: any) {
      console.error("Error in makeClaims:", error.message);
      res.status(500).json({ error: error.message });
    }
  };
}
