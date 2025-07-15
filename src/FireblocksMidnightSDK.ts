import dotenv from "dotenv";
import { readFileSync } from "fs";
import { BasePath, SignedMessageAlgorithmEnum } from "@fireblocks/ts-sdk";

import { FireblocksService } from "./services/fireblocks.service.js";
import { ClaimApiService } from "./services/claim.api.service.js";
import { ProvetreeService } from "./services/provetree.service.js";
import { SupportedAssetIds, SupportedBlockchains } from "./types.js";
import { getAssetIdsByBlockchain } from "./utils/general.js";
dotenv.config();

export class FireblocksMidnightSDK {
  private fireblocksService: FireblocksService;
  private claimApiService: ClaimApiService;
  private provetreeService: ProvetreeService;
  private assetId: SupportedAssetIds;
  private vaultAccountId: string;
  private address: string;
  private blockfrostProjectId: string;

  constructor(
    fireblocksService: FireblocksService,
    claimApiService: ClaimApiService,
    provetreeService: ProvetreeService,
    assetId: SupportedAssetIds,
    vaultAccountId: string,
    address: string,
    blockfrostProjectId: string
  ) {
    this.fireblocksService = fireblocksService;
    this.claimApiService = claimApiService;
    this.provetreeService = provetreeService;
    this.assetId = assetId;
    this.vaultAccountId = vaultAccountId;
    this.address = address;
    this.blockfrostProjectId = blockfrostProjectId;
  }

  public static create = async (
    vaultAccountId: string,
    assetId: SupportedAssetIds
  ) => {
    const secretKeyPath = process.env.FIREBLOCKS_SECRET_KEY_PATH!;

    const secretKey = readFileSync(secretKeyPath, "utf-8");

    const fireblocksConfig = {
      apiKey: process.env.FIREBLOCKS_API_KEY || "",
      secretKey: secretKey,
      basePath: (process.env.BASE_PATH as BasePath) || BasePath.US,
    };

    const fireblocksService = new FireblocksService(fireblocksConfig);
    const address = await fireblocksService.getVaultAccountAddress(
      vaultAccountId,
      assetId
    );

    const blockfrostProjectId = process.env.BLOCKFROST_PROJECT_ID || "";

    const claimApiService = new ClaimApiService();
    const provetreeService = new ProvetreeService();

    const fireblocksMidnighSDK = new FireblocksMidnightSDK(
      fireblocksService,
      claimApiService,
      provetreeService,
      assetId,
      vaultAccountId,
      address,
      blockfrostProjectId
    );

    return fireblocksMidnighSDK;
  };

  public checkAddress = async (chain: SupportedBlockchains) => {
    try {
      const assetId = getAssetIdsByBlockchain(chain as SupportedBlockchains)[0];
      console.log("checkAddress", assetId);

      const value = await this.provetreeService.checkAddress(
        this.address,
        chain as SupportedBlockchains
      );
      return value;
    } catch (error: any) {
      throw new Error(
        `Error in checkAddress:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  public getClaims = async (chain: SupportedBlockchains) => {
    try {
      const claimResponse = await this.claimApiService.getClaims(
        chain as SupportedBlockchains,
        this.address
      );

      return claimResponse.data;
    } catch (error: any) {
      throw new Error(
        `Error in getClaims:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  public makeClaims = async (
    chain: SupportedBlockchains,
    assetId: SupportedAssetIds,
    destinationAddress: string
  ) => {
    try {
      const originAddress = this.address;
      const amount = await this.provetreeService.checkAddress(
        originAddress,
        chain as SupportedBlockchains
      );

      const fbResoponse = await this.fireblocksService.signMessage(
        chain as SupportedBlockchains,
        assetId,
        this.vaultAccountId,
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
        if (assetId === SupportedAssetIds.BTC) {
          const encodedSig =
            Buffer.from([Number.parseInt(String(v), 16) + 31]).toString("hex") +
            fbResoponse.signature.fullSig;

          signature = Buffer.from(encodedSig, "hex").toString("base64");
        } else {
          const ethV = v + 27;

          signature = r + s + ethV.toString(16).padStart(2, "0");
        }
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

      return claimResponse.data;
    } catch (error: any) {
      throw new Error(
        `Error in makeClaims:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };
}
