import { Request, Response } from "express";
import { SupportedBlockchains } from "../types.js";
import { SdkManager } from "../pool/sdkManager.js";

export class ApiController {
  private sdkManager: SdkManager;

  constructor() {
    this.sdkManager = new SdkManager();
  }

  public checkAddress = async (req: Request, res: Response) => {
    const { vaultAccountId, chain } = req.params;
    try {
      const sdk = await this.sdkManager.getSdk(
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
      const sdk = await this.sdkManager.getSdk(
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
      const sdk = await this.sdkManager.getSdk(
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
      console.log(
        `Transferring claims from vault ${vaultAccountId} to ${recipientAddress} with policy ${tokenPolicyId} and amount ${requiredTokenAmount}`
      );
      const sdk = await this.sdkManager.getSdk(
        String(vaultAccountId),
        SupportedBlockchains.CARDANO_TESTNET
      );
      const { txHash, senderAddress, tokenName } = await sdk.transferClaims(
        recipientAddress,
        tokenPolicyId,
        Number(requiredTokenAmount)
      );
      res.status(200).json({
        status: "success",
        transactionHash: txHash,
        recipientAddress,
        senderAddress: senderAddress,
        tokenPolicyId,
        tokenName,
        amount: requiredTokenAmount,
      });
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

  public getVaultAccountAddresses = async (req: Request, res: Response) => {
    const { chain, vaultAccountId } = req.params;
    try {
      const sdk = await this.sdkManager.getSdk(
        vaultAccountId,
        chain as SupportedBlockchains
      );
      const addresses = await sdk.getVaultAccountAddresses(vaultAccountId);
      res.status(200).json({ addresses: addresses });
    } catch (error: any) {
      console.error("Error in getVaultAccountAddresses:", error.message);
      res.status(500).json({ error: error.message });
    }
  };
}
