import { readFileSync } from "fs";
import dotenv from "dotenv";
import { BasePath } from "@fireblocks/ts-sdk";
import { Request, Response } from "express";
import { ClaimApiService } from "../services/claim.api.service";
import { ProvetreeService } from "../services/provetree.service";
import { FireblocksService } from "../services/fireblocks.service";
import { SupportedBlockchains } from "../types";
dotenv.config();

export class ApiController {
  private fireblocksService: FireblocksService;
  private claimApiService: ClaimApiService;
  private provetreeService: ProvetreeService;
  constructor() {
    const secretKeyPath = process.env.FIREBLOCKS_SECRET_KEY_PATH;

    const secretKey = readFileSync(secretKeyPath || "", "utf-8");

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
    const { address, chain } = req.params;
    try {
      const value = await this.provetreeService.checkAddress(
        address,
        chain as SupportedBlockchains
      );
      res.status(200).json(value);
    } catch (error) {
      console.error("Error in checkAddress:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : error,
      });
    }
  };

  public makeClaim = async (req: Request, res: Response) => {
    const {
      chain,
      assetId,
      originVaultAccountId,
      destinationVaultAccountId,
      amount,
    } = req.body;
    try {
      const fbResoponse = await this.fireblocksService.signMessage(
        chain,
        assetId,
        originVaultAccountId,
        destinationVaultAccountId,
        amount
      );

      if (
        !fbResoponse ||
        !fbResoponse.signature.fullSig ||
        !fbResoponse.publicKey
      ) {
        throw new Error(
          "Invalid Fireblocks response: missing signature or public key"
        );
      }

      const claimResponse = await this.claimApiService.makeClaim(
        originVaultAccountId,
        amount,
        fbResoponse.signature.fullSig,
        destinationVaultAccountId,
        fbResoponse.publicKey
      );
      res.status(200).json(claimResponse);
    } catch (error) {
      console.error("Error in makeClaim:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : error,
      });
    }
  };
}
