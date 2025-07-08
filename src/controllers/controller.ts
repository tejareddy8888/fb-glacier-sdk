import { readFileSync } from "fs";
import dotenv from "dotenv";
import { BasePath, SignedMessageAlgorithmEnum } from "@fireblocks/ts-sdk";
import { Request, Response } from "express";
import { ClaimApiService } from "../services/claim.api.service";
import { ProvetreeService } from "../services/provetree.service";
import { FireblocksService } from "../services/fireblocks.service";
import { SupportedBlockchains } from "../types";
import { getAssetIdsByBlockchain } from "../utils/general";

dotenv.config();

export class ApiController {
  private fireblocksService: FireblocksService;
  private claimApiService: ClaimApiService;
  private provetreeService: ProvetreeService;
  constructor() {
    const secretKeyPath = process.env.FIREBLOCKS_SECRET_KEY_PATH!;

    const secretKey = readFileSync(secretKeyPath, "utf-8");

    const fireblocksConfig = {
      apiKey: process.env.FIREBLOCKS_API_KEY || "",
      secretKey: secretKey,
      basePath: (process.env.BASE_PATH as BasePath) || BasePath.US,
    };

    this.fireblocksService = new FireblocksService(fireblocksConfig);
    this.claimApiService = new ClaimApiService();
    this.provetreeService = new ProvetreeService();
  }

  public checkAddress = async (req: Request, res: Response) => {
    const { vaultAccountId, chain } = req.params;
    try {
      const assetId = getAssetIdsByBlockchain(chain as SupportedBlockchains)[0];
      console.log("checkAddress", assetId);
      const address = await this.fireblocksService.getVaultAccountAddress(
        vaultAccountId,
        assetId
      );

      const value = await this.provetreeService.checkAddress(
        address,
        chain as SupportedBlockchains
      );
      res.status(200).json(value);
    } catch (error: any) {
      console.error("Error in checkAddress:", error.message);
      res.status(500).json({
        error: error instanceof Error ? error.message : error,
      });
    }
  };

  public getClaims = async (req: Request, res: Response) => {
    const { chain, vaultAccountId } = req.params;
    try {
      const assetId = getAssetIdsByBlockchain(chain as SupportedBlockchains)[0];
      const address = await this.fireblocksService.getVaultAccountAddress(
        vaultAccountId,
        assetId
      );

      const claimResponse = await this.claimApiService.getClaims(
        chain as SupportedBlockchains,
        address
      );

      res.status(200).json(claimResponse.data);
    } catch (error: any) {
      console.error("Error in getClaims:", error.message);
      res.status(500).json({
        error: error instanceof Error ? error.message : error,
      });
    }
  };

  public makeClaims = async (req: Request, res: Response) => {
    const { chain } = req.params;
    const { assetId, originVaultAccountId, destinationAddress } = req.body;
    try {
      const originAddress = await this.fireblocksService.getVaultAccountAddress(
        originVaultAccountId,
        assetId
      );
      const amount = await this.provetreeService.checkAddress(
        originAddress,
        chain as SupportedBlockchains
      );

      const fbResoponse = await this.fireblocksService.signMessage(
        chain as SupportedBlockchains,
        assetId,
        String(originVaultAccountId),
        destinationAddress,
        amount
      );

      if (
        !fbResoponse ||
        !fbResoponse.publicKey ||
        !fbResoponse.algorithm ||
        !fbResoponse.signature ||
        !fbResoponse.signature.fullSig
      ) {
        throw new Error(
          "Invalid Fireblocks response: missing signature or public key"
        );
      }

      const message = fbResoponse.message;
      const publicKey = fbResoponse.publicKey;
      let signature: string = "";
      if (fbResoponse.algorithm === SignedMessageAlgorithmEnum.EcdsaSecp256K1) {
        const { r, s, v } = fbResoponse.signature;
        if (!r || !s || v === undefined)
          throw new Error("ecdsa signature error.");

        const ethV = v + 27;

        signature = r + s + ethV.toString(16).padStart(2, "0");
      } else {
        signature = fbResoponse.signature.fullSig;
      }

      const claimResponse = await this.claimApiService.makeClaims(
        chain as SupportedBlockchains,
        originAddress,
        amount,
        message,
        signature,
        destinationAddress,
        publicKey
      );

      res.status(200).json(claimResponse.data);
    } catch (error: any) {
      console.error("Error in makeClaims:", error.message);
      res.status(500).json({
        error: error instanceof Error ? error.message : error,
      });
    }
  };
}
