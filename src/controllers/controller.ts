import { Request, Response } from "express";
import { SupportedBlockchains } from "../types.js";
import { SdkManager } from "../pool/sdkManager.js";

export class ApiController {
  private sdkManager: SdkManager;

  constructor() {
    this.sdkManager = new SdkManager();
  }

  /**
   * Handles the request to check address allocation for a given vault account and blockchain.
   * Responds with the allocation value or an error message if the operation fails.
   *
   * @remarks
   * This method retrieves the SDK instance for the specified vault account and blockchain,
   * then checks the address allocation status and returns the result in the response.
   */
  public checkAddressAllocation = async (req: Request, res: Response) => {
    const { vaultAccountId, chain } = req.params;
    try {
      const sdk = await this.sdkManager.getSdk(
        vaultAccountId,
        chain as SupportedBlockchains
      );
      const result = await sdk.checkAddressAllocation(chain as SupportedBlockchains);

      res.status(200).json({ value: result });
    } catch (error: any) {
      console.error("Error in checkAddressAllocation:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Handles the request to retrieve the claims history for a specific vault account and blockchain.
   * 
   * Responds with the claims history as JSON on success, or an error message on failure.
   * 
   * @remarks
   * This method expects `vaultAccountId` and `chain` to be present in the request parameters.
   */
  public getClaimsHistory = async (req: Request, res: Response) => {
    const { vaultAccountId, chain } = req.params;
    try {
      const sdk = await this.sdkManager.getSdk(
        vaultAccountId,
        chain as SupportedBlockchains
      );
      const result = await sdk.getClaimsHistory(chain as SupportedBlockchains);
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error in getClaimsHistory:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Handles the claim creation process for a given blockchain and destination address.
   * 
   * This method retrieves the appropriate SDK instance and initiates the claim process.
   * On success, it responds with the claim details; on failure, it returns an error response.
   * 
   * @remarks
   * Expects `chain` in request parameters and `originVaultAccountId`, `destinationAddress` in request body.
   */
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

  /**
   * Handles the transfer of claims from a specified vault account to a recipient address.
   * 
   * This method extracts transfer details from the request body, initiates the transfer using the SDK,
   * and responds with the transaction details upon success.
   */
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

  /**
   * Handles the request to retrieve vault account addresses for a specific blockchain and vault account.
   * Responds with a JSON object containing the addresses or an error message if the operation fails.
   *
   * @remarks
   * This method expects `chain` and `vaultAccountId` as route parameters.
   *
   * @returns A JSON response with the vault account addresses or an error message.
   */
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
