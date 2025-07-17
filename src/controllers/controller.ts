import { Request, Response } from "express";
import { SupportedBlockchains } from "../types.js";
import { SdkManager } from "../pool/sdkManager.js";

export class ApiController {
  constructor(private sdkManager: SdkManager = sdkManager) {}

  private async getSdk(vaultAccountId: string, chain: SupportedBlockchains) {
    return await this.sdkManager.getSdk(vaultAccountId, chain);
  }

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
    const { originVaultAccountId, destinationAddress } = req.body;
    try {
      const sdk = await this.getSdk(
        String(originVaultAccountId),
        chain as SupportedBlockchains
      );
      const claims = await sdk.makeClaims(
        chain as SupportedBlockchains,
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
        requiredTokenAmount
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
