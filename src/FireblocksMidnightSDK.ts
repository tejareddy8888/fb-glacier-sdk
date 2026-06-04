import {
  ConfigurationOptions,
  SignedMessageAlgorithmEnum,
  TransactionOperation,
  TransferPeerPathType,
  VaultWalletAddress,
} from "@fireblocks/ts-sdk";
import * as lucid from "lucid-cardano";
import { FireblocksService } from "./services/fireblocks.service.js";
import { ClaimApiService } from "./services/claim.api.service.js";
import { ProvetreeService } from "./services/provetree.service.js";
import { ThawsService } from "./services/thaws.service.js";
import {
  checkAddressAllocationOpts,
  ClaimHistoryResponse,
  getClaimsHistoryOpts,
  getVaultAccountAddressesOpts,
  makeClaimsOpts,
  PhaseConfigResponse,
  redeemNightOpts,
  SubmitClaimResponse,
  SupportedAssetIds,
  SupportedBlockchains,
  thawScheduleOpts,
  thawStatusOpts,
  ThawScheduleResponse,
  ThawStatusSchedule,
  ThawTransactionResponse,
  ThawTransactionStatus,
  TransactionBuildRequest,
  TransactionBuildResponse,
  TransactionSubmissionRequest,
  TransferClaimsResponse,
  trasnsferClaimsOpts,
} from "./types.js";
import { nightTokenName, tokenTransactionFee } from "./constants.js";
import { getAssetIdsByBlockchain } from "./utils/general.js";
import { calculateTtl, fetchAndSelectUtxos } from "./utils/cardano.utils.js";

import { config } from "./utils/config.js";

export class FireblocksMidnightSDK {
  private fireblocksService: FireblocksService;
  private claimApiService: ClaimApiService;
  private provetreeService: ProvetreeService;
  private thawsService: ThawsService;
  private assetId: SupportedAssetIds;
  private vaultAccountId: string;
  private address: string;
  private blockfrostProjectId?: string;
  private lucid?: lucid.Lucid;

  constructor(params: {
    fireblocksService: FireblocksService;
    claimApiService: ClaimApiService;
    provetreeService: ProvetreeService;
    thawsService: ThawsService;
    assetId: SupportedAssetIds;
    vaultAccountId: string;
    address: string;
    blockfrostProjectId?: string;
  }) {
    this.fireblocksService = params.fireblocksService;
    this.claimApiService = params.claimApiService;
    this.provetreeService = params.provetreeService;
    this.thawsService = params.thawsService;
    this.assetId = params.assetId;
    this.vaultAccountId = params.vaultAccountId;
    this.address = params.address;
    this.blockfrostProjectId = params.blockfrostProjectId;
  }

  /**
   * Creates a new instance of `FireblocksMidnightSDK` with the provided parameters.
   *
   * This method initializes required services, validates configuration, and sets up the SDK instance
   * for interacting with Fireblocks and Blockfrost. It throws an error if any required configuration
   * is missing or if the blockchain is unsupported.
   *
   * @param params - The parameters required to create the SDK instance.
   * @param {string} params.vaultAccountId - The Fireblocks vault account ID to use.
   * @param {SupportedBlockchains} params.chain - The blockchain to operate on. Must be a supported blockchain.
   * @returns A promise that resolves to a configured `FireblocksMidnightSDK` instance.
   * @throws {Error} If the blockchain is unsupported or required configuration is missing.
   */
  public static create = async (params: {
    fireblocksConfig: ConfigurationOptions;
    vaultAccountId: string;
    chain: SupportedBlockchains;
  }): Promise<FireblocksMidnightSDK> => {
    try {
      const { fireblocksConfig, vaultAccountId, chain } = params;
      const assetId = getAssetIdsByBlockchain(chain);
      if (!assetId) {
        throw new Error(`Unsupported blockchain: ${chain}`);
      }

      const fireblocksService = new FireblocksService(fireblocksConfig);
      const address = await fireblocksService.getVaultAccountAddress(
        vaultAccountId,
        assetId
      );

      const blockfrostProjectId = config.BLOCKFROST_PROJECT_ID;
      if (!blockfrostProjectId) {
        console.warn(
          "[warn] BLOCKFROST_PROJECT_ID is not configured. Some features may not work."
        );
      }

      const claimApiService = new ClaimApiService();
      const provetreeService = new ProvetreeService();
      const thawsService = new ThawsService();

      const sdkInstance = new FireblocksMidnightSDK({
        fireblocksService,
        claimApiService,
        provetreeService,
        thawsService,
        assetId,
        vaultAccountId,
        address,
        blockfrostProjectId,
      });

      // Only initialize Lucid if blockfrostProjectId is available
      if (blockfrostProjectId) {
        const network = blockfrostProjectId.includes("mainnet")
          ? "Mainnet"
          : blockfrostProjectId.includes("preprod")
          ? "Preprod"
          : "Preview";
        sdkInstance.lucid = await lucid.Lucid.new(
          new lucid.Blockfrost(blockfrostProjectId, blockfrostProjectId),
          network
        );
      }
      return sdkInstance;
    } catch (error: any) {
      throw new Error(
        `Error creating FireblocksMidnightSDK: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  };

  /**
   * Checks if the current address is valid for the specified blockchain and fetches its allocation value.
   *
   * @param {SupportedBlockchains} chain - The blockchain to check the address against.
   * @returns {Promise<number>} Returns a numeric result indicating address allocation value.
   * @throws {Error} If address validation fails or allocation cannot be fetched.
   */
  public checkAddressAllocation = async ({
    chain,
  }: checkAddressAllocationOpts): Promise<number> => {
    try {
      return await this.provetreeService.checkAddressAllocation(
        this.address,
        chain
      );
    } catch (error: any) {
      throw new Error(
        `Error in checkAddressAllocation: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  };

  /**
   * Retrieves the claims history for the specified blockchain and address.
   *
   * @param {SupportedBlockchains} chain - The blockchain to fetch claims history from.
   * @returns {Promise<ClaimHistoryResponse[]>} A promise that resolves to an array of claim history responses.
   * @throws {Error} Throws an error if the claims history cannot be retrieved.
   */
  public getClaimsHistory = async ({
    chain,
  }: getClaimsHistoryOpts): Promise<ClaimHistoryResponse[]> => {
    try {
      return await this.claimApiService.getClaimsHistory(
        chain as SupportedBlockchains,
        this.address
      );
    } catch (error: any) {
      throw new Error(
        `Error in getClaimsHistory:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  /**
   * Submits a claim transaction for the specified blockchain and destination address.
   *
   * This method performs multiple steps using the Fireblocks and ProveTree services.
   *
   * @param {makeClaimsOpts} opts - The options for the claim (chain, destinationAddress).
   * @param {SupportedBlockchains} opts.chain - The blockchain network on which to execute the claim.
   * @param {string} opts.destinationAddress - The destination address for the claim.
   * @returns {Promise<SubmitClaimResponse[]>} Resolves with claim submission result.
   * @throws {Error} On signature or service errors.
   */
  public makeClaims = async ({
    chain,
    destinationAddress,
  }: makeClaimsOpts): Promise<SubmitClaimResponse[]> => {
    try {
      const originAddress = this.address;
      const allocationValue =
        await this.provetreeService.checkAddressAllocation(
          originAddress,
          chain as SupportedBlockchains
        );

      const fbResoponse = await this.fireblocksService.signMessage(
        chain as SupportedBlockchains,
        this.assetId,
        this.vaultAccountId,
        destinationAddress,
        allocationValue,
        this.vaultAccountId,
        originAddress
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
        if (this.assetId === SupportedAssetIds.BTC) {
          const encodedSig =
            Buffer.from([Number.parseInt(String(v), 16) + 31]).toString("hex") +
            fbResoponse.signature.fullSig;

          signature = Buffer.from(encodedSig, "hex").toString("base64");
        } else if (this.assetId === SupportedAssetIds.XRP) {
          signature = (r + s).toUpperCase();
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
        allocationValue,
        message,
        signature,
        destinationAddress,
        publicKey
      );

      return claimResponse;
    } catch (error: any) {
      throw new Error(error instanceof Error ? error.message : error);
    }
  };

  /**
   * Transfers native tokens and ADA to a recipient address on Cardano.
   *
   * This method:
   * - Selects UTXOs to cover the required token and ADA amounts.
   * - Constructs and signs the transaction using Fireblocks.
   * - Submits the transaction to the Cardano network.
   *
   * @param {trasnsferClaimsOpts} opts - Options for transferring claims.
   * @param {string} opts.recipientAddress - Recipient's Bech32 address.
   * @param {string} opts.tokenPolicyId - Native token policy ID.
   * @param {number} opts.requiredTokenAmount - Amount of token to transfer.
   * @param {number} [opts.minRecipientLovelace=1_200_000] - Minimum ADA for recipient (default: 1,200,000).
   * @param {number} [opts.minChangeLovelace=1_200_000] - Minimum ADA for change (default: 1,200,000).
   * @returns {Promise<TransferClaimsResponse>} Transaction hash, sender address, and token name.
   * @throws {Error} If UTXOs/balance are insufficient, or Fireblocks signing fails.
   */
  public transferClaims = async ({
    recipientAddress,
    tokenPolicyId,
    requiredTokenAmount,
    minRecipientLovelace = 1_200_000,
    minChangeLovelace = 1_200_000,
  }: trasnsferClaimsOpts): Promise<TransferClaimsResponse> => {
    if (!this.blockfrostProjectId) {
      throw new Error("Blockfrost project id was not provided.");
    }
    try {
      const transactionFee = BigInt(tokenTransactionFee);

      if (!this.blockfrostProjectId) {
        throw new Error("BLOCKFROST_PROJECT_ID is not configured.");
      }

      // Initialize Lucid if not already initialized
      if (!this.lucid) {
        const network = this.blockfrostProjectId.includes("mainnet")
          ? "Mainnet"
          : this.blockfrostProjectId.includes("preprod")
          ? "Preprod"
          : "Preview";
        this.lucid = await lucid.Lucid.new(
          new lucid.Blockfrost(this.blockfrostProjectId, this.blockfrostProjectId),
          network
        );
      }

      const utxoResult = await fetchAndSelectUtxos(
        this.address,
        this.blockfrostProjectId,
        tokenPolicyId,
        requiredTokenAmount,
        Number(transactionFee),
        minRecipientLovelace,
        minChangeLovelace
      );

      if (!utxoResult) throw new Error("No UTXOs found");

      const {
        blockfrost,
        selectedUtxos,
        accumulatedAda,
        accumulatedTokenAmount,
      } = utxoResult;

      const adaTarget = BigInt(minRecipientLovelace) + transactionFee;

      if (
        BigInt(accumulatedTokenAmount) < BigInt(requiredTokenAmount) ||
        BigInt(accumulatedAda) < adaTarget
      ) {
        throw {
          code: "INSUFFICIENT_BALANCE",
          message: "Insufficient balance for token or ADA.",
          details: {
            requiredTokenAmount,
            accumulatedTokenAmount,
            requiredAda: Number(adaTarget),
            accumulatedAda,
          },
        };
      }

      const convertedUtxos: lucid.UTxO[] = selectedUtxos.map((utxo) => {
        const assets: Record<string, bigint> = {};
        utxo.amount.forEach(({ unit, quantity }) => {
          assets[unit] = BigInt(quantity);
        });
        return {
          txHash: utxo.tx_hash,
          outputIndex: utxo.output_index,
          address: utxo.address,
          assets,
        };
      });

      const assetNameUnit =
        tokenPolicyId + lucid.toHex(Buffer.from(nightTokenName, "utf8"));

      const dummyWallet: lucid.WalletApi = {
        getNetworkId: async () => 1, // or 0 for testnet
        getUtxos: async () => [],
        getBalance: async () => "0",
        getUsedAddresses: async () => [
          Buffer.from(
            lucid.C.Address.from_bech32(this.address).to_bytes()
          ).toString("hex"),
        ],
        getUnusedAddresses: async () => [],
        getChangeAddress: async () =>
          Buffer.from(
            lucid.C.Address.from_bech32(this.address).to_bytes()
          ).toString("hex"),
        getRewardAddresses: async () => [],
        signTx: async () => {
          throw new Error("signTx not implemented in dummy wallet");
        },
        signData: async () => {
          throw new Error("signData not implemented in dummy wallet");
        },
        submitTx: async () => {
          throw new Error("submitTx not implemented in dummy wallet");
        },
        getCollateral: async () => [],
        experimental: {
          getCollateral: async () => [],
          on: () => {},
          off: () => {},
        },
      };
      this.lucid.selectWallet(dummyWallet);
      let tx = this.lucid
        .newTx()
        .collectFrom(convertedUtxos)
        .payToAddress(recipientAddress, {
          lovelace: BigInt(minRecipientLovelace),
          [assetNameUnit]: BigInt(requiredTokenAmount),
        })
        .payToAddress(this.address, {
          lovelace: BigInt(accumulatedAda) - adaTarget,
          [assetNameUnit]:
            BigInt(accumulatedTokenAmount) - BigInt(requiredTokenAmount),
        });

      const ttl = await calculateTtl(blockfrost, this.lucid, 2600);
      tx = tx.validTo(ttl);

      const unsignedTx = await tx.complete();

      const txHash = unsignedTx.toHash();

      const transactionPayload = {
        assetId: this.assetId,
        operation: TransactionOperation.Raw,
        source: {
          type: TransferPeerPathType.VaultAccount,
          id: this.vaultAccountId,
        },
        note: "transfer ADA native tokens",
        extraParameters: {
          rawMessageData: {
            messages: [
              {
                content: txHash,
              },
            ],
          },
        },
      };

      const fbResponse = await this.fireblocksService.broadcastTransaction(
        transactionPayload
      );
      if (
        !fbResponse?.publicKey ||
        !fbResponse?.signature ||
        !fbResponse.signature.fullSig
      ) {
        throw new Error("Missing publicKey or signature from Fireblocks");
      }

      const publicKeyBytes = Buffer.from(fbResponse.publicKey, "hex");
      const signatureBytes = Buffer.from(fbResponse.signature.fullSig, "hex");
      const publicKey = lucid.C.PublicKey.from_bytes(publicKeyBytes);

      const vkey = lucid.C.Vkey.new(publicKey);

      const signature = lucid.C.Ed25519Signature.from_bytes(signatureBytes);
      const vkeyWitness = lucid.C.Vkeywitness.new(vkey, signature);
      const vkeyWitnesses = lucid.C.Vkeywitnesses.new();
      vkeyWitnesses.add(vkeyWitness);
      const witnessSet = lucid.C.TransactionWitnessSet.new();
      witnessSet.set_vkeys(vkeyWitnesses);

      const witnessHex = Buffer.from(witnessSet.to_bytes()).toString("hex");

      const signedTxComplete = unsignedTx.assemble([witnessHex]);

      const signedTx = await signedTxComplete.complete();

      const txHexString = signedTx.toString();
      const submittedHash = await this.lucid.provider.submitTx(txHexString);
      return {
        txHash: submittedHash,
        senderAddress: this.address,
        tokenName: this.assetId,
      };
    } catch (error: any) {
      throw new Error(
        `Error in transferClaims: ${
          error instanceof Error ? error.message : JSON.stringify(error)
        }`
      );
    }
  };

  /**
   * Retrieves the wallet addresses associated with a specific Fireblocks vault account.
   *
   * @param {string} vaultAccountId - The unique identifier of the vault account to fetch addresses for.
   * @returns {Promise<VaultWalletAddress[]>} A promise that resolves to an array of VaultWalletAddress objects.
   * @throws {Error} Throws an error if the retrieval fails.
   */
  public getVaultAccountAddresses = async ({
    vaultAccountId,
  }: getVaultAccountAddressesOpts): Promise<VaultWalletAddress[]> => {
    try {
      return await this.fireblocksService.getVaultAccountAddresses(
        vaultAccountId,
        this.assetId
      );
    } catch (error: any) {
      throw new Error(
        `Error in getVaultAccountAddresses:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  /**
   * Returns the redemption phase configuration (window start, increments, etc.)
   * from the Midnight claim service.
   */
  public getPhaseConfig = async (): Promise<PhaseConfigResponse> => {
    try {
      return await this.thawsService.getPhaseConfig();
    } catch (error: any) {
      throw new Error(
        `Error in getPhaseConfig: ${error instanceof Error ? error.message : error}`
      );
    }
  };

  /**
   * Returns the thaw schedule for the Cardano address at the given vault
   * account / address index pair.
   */
  public getThawSchedule = async ({
    vaultAccountId,
    index,
  }: thawScheduleOpts): Promise<ThawScheduleResponse> => {
    try {
      const destAddress = await this.resolveAdaAddressAtIndex(
        vaultAccountId,
        index
      );
      return await this.thawsService.getThawSchedule(destAddress);
    } catch (error: any) {
      throw new Error(
        `Error in getThawSchedule: ${error instanceof Error ? error.message : error}`
      );
    }
  };

  /**
   * Returns the status of an already-submitted thaw transaction.
   */
  public getThawTransactionStatus = async ({
    destAddress,
    transactionId,
  }: thawStatusOpts): Promise<ThawTransactionStatus> => {
    try {
      return await this.thawsService.getTransactionStatus(
        destAddress,
        transactionId
      );
    } catch (error: any) {
      throw new Error(
        `Error in getThawTransactionStatus: ${error instanceof Error ? error.message : error}`
      );
    }
  };

  /**
   * Executes the full redeem flow for a vault address: validates the
   * redemption window, picks funding/collateral UTXOs, builds an unsigned
   * thaw transaction via the Midnight API, signs the transaction hash with
   * Fireblocks, and submits the witness back to the API. Optionally polls
   * the API for confirmation.
   */
  public redeemNight = async (
    params: redeemNightOpts
  ): Promise<ThawTransactionResponse & { finalStatus?: string }> => {
    try {
      const {
        vaultAccountId,
        index,
        waitForConfirmation,
        pollingIntervalMs,
        timeoutMs,
      } = params;

      if (!this.blockfrostProjectId) {
        throw new Error("Blockfrost project ID is required for redemption");
      }
      await this.ensureLucid();

      const destAddress = await this.resolveAdaAddressAtIndex(
        vaultAccountId,
        index
      );
      console.log(`Using address at index ${index}: ${destAddress}`);

      await this.validateRedemptionWindow();

      const schedule = await this.thawsService.getThawSchedule(destAddress);
      const redeemableThaws = schedule.thaws.filter(
        (t) => t.status === ThawStatusSchedule.REDEEMABLE
      );
      if (redeemableThaws.length === 0) {
        throw new Error(
          `No redeemable thaws available for address: ${destAddress}`
        );
      }
      console.log(
        `Found ${redeemableThaws.length} redeemable thaw(s) for ${destAddress}`
      );

      const fundingUtxoHex = await this.fetchFundingUtxoHex(destAddress);
      const collateralUtxos = await this.fetchCollateralUtxoHexList(destAddress);

      const buildRequest: TransactionBuildRequest = {
        change_address: destAddress,
        funding_utxos: [fundingUtxoHex],
        collateral_utxos: collateralUtxos,
      };
      const txBuildResponse = await this.thawsService.buildThawTransaction(
        destAddress,
        buildRequest
      );

      if (txBuildResponse.require_thawing_extra_signature) {
        throw new Error(
          "Additional thawing signature required but not implemented."
        );
      }
      console.log(
        `Built thaw transaction ${txBuildResponse.transaction_id}, redeems ${txBuildResponse.redeemed_amount} NIGHT`
      );

      const witnessSetHex = await this.signRedemptionTransaction(
        vaultAccountId,
        txBuildResponse.transaction_id,
        index
      );

      const submitRequest: TransactionSubmissionRequest = {
        transaction: txBuildResponse.transaction,
        transaction_witness_set: witnessSetHex,
      };
      const submitResponse = await this.thawsService.submitThawTransaction(
        destAddress,
        submitRequest
      );
      console.log(
        `Submitted thaw transaction ${submitResponse.transaction_id}, eta ${submitResponse.estimated_submission_time}`
      );

      if (waitForConfirmation) {
        const finalStatus = await this.waitForConfirmation(
          destAddress,
          submitResponse.transaction_id,
          timeoutMs ?? 300_000,
          pollingIntervalMs ?? 15_000
        );
        return { ...submitResponse, finalStatus };
      }

      return submitResponse;
    } catch (error: any) {
      throw new Error(
        `Error in redeemNight: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      );
    }
  };

  private ensureLucid = async (): Promise<lucid.Lucid> => {
    if (this.lucid) return this.lucid;
    if (!this.blockfrostProjectId) {
      throw new Error("Blockfrost project ID is required");
    }
    const network = this.blockfrostProjectId.includes("mainnet")
      ? "Mainnet"
      : this.blockfrostProjectId.includes("preprod")
        ? "Preprod"
        : "Preview";
    this.lucid = await lucid.Lucid.new(
      new lucid.Blockfrost(this.blockfrostProjectId, this.blockfrostProjectId),
      network
    );
    return this.lucid;
  };

  private resolveAdaAddressAtIndex = async (
    vaultAccountId: string,
    index: number
  ): Promise<string> => {
    const adaAssetId =
      this.assetId === SupportedAssetIds.ADA_TEST
        ? SupportedAssetIds.ADA_TEST
        : SupportedAssetIds.ADA;
    const addresses = await this.fireblocksService.getVaultAccountAddresses(
      vaultAccountId,
      adaAssetId
    );
    const match = addresses.find((a) => a.bip44AddressIndex === index);
    if (!match || !match.address) {
      throw new Error(
        `No ADA address at index ${index} for vault ${vaultAccountId}`
      );
    }
    return match.address;
  };

  private validateRedemptionWindow = async (): Promise<void> => {
    const config = await this.thawsService.getPhaseConfig();
    const windowInfo = this.thawsService.getRedemptionWindowTimes(config);
    if (!windowInfo.isOpen) {
      throw new Error(
        `Redemption window is not open. Window: ${windowInfo.startTime.toISOString()} - ${windowInfo.endTime.toISOString()}`
      );
    }
  };

  private fetchFundingUtxoHex = async (
    destAddress: string
  ): Promise<string> => {
    const l = await this.ensureLucid();
    const utxos = await l.utxosAt(destAddress);
    if (!utxos || utxos.length === 0) {
      throw new Error(`No UTXOs found for address: ${destAddress}`);
    }

    const COLLATERAL_EXACT = 5_000_000n;
    const fundingCandidates = utxos.filter((u) => {
      const lovelaceOnly =
        Object.keys(u.assets).length === 1 && u.assets.lovelace !== undefined;
      const isExactCollateral =
        lovelaceOnly && u.assets.lovelace === COLLATERAL_EXACT;
      return !isExactCollateral;
    });

    const pool = fundingCandidates.length > 0 ? fundingCandidates : utxos;
    const largest = pool
      .slice()
      .sort((a, b) =>
        Number((b.assets.lovelace ?? 0n) - (a.assets.lovelace ?? 0n))
      )[0];
    return this.utxoToHex(largest, destAddress);
  };

  private fetchCollateralUtxoHexList = async (
    destAddress: string
  ): Promise<string[]> => {
    const l = await this.ensureLucid();
    const utxos = await l.utxosAt(destAddress);
    if (!utxos || utxos.length === 0) return [];

    const MIN_COLLATERAL_LOVELACE = 5_000_000n;
    const candidates = utxos.filter((u) => {
      const lovelaceOnly =
        Object.keys(u.assets).length === 1 && u.assets.lovelace !== undefined;
      const enough = (u.assets.lovelace ?? 0n) >= MIN_COLLATERAL_LOVELACE;
      return lovelaceOnly && enough;
    });
    return candidates.slice(0, 3).map((u) => this.utxoToHex(u, destAddress));
  };

  private utxoToHex = (utxo: lucid.UTxO, destAddress: string): string => {
    const txHash = lucid.C.TransactionHash.from_hex(utxo.txHash);
    const txIn = lucid.C.TransactionInput.new(
      txHash,
      lucid.C.BigNum.from_str(utxo.outputIndex.toString())
    );
    const address = lucid.C.Address.from_bech32(destAddress);
    const lovelace = utxo.assets.lovelace ?? 0n;
    const amount = lucid.C.Value.new(
      lucid.C.BigNum.from_str(lovelace.toString())
    );
    const txOut = lucid.C.TransactionOutput.new(address, amount);
    const unspent = lucid.C.TransactionUnspentOutput.new(txIn, txOut);
    return Buffer.from(unspent.to_bytes()).toString("hex");
  };

  private signRedemptionTransaction = async (
    vaultAccountId: string,
    transactionId: string,
    addressIndex: number
  ): Promise<string> => {
    const transactionPayload = {
      assetId: SupportedAssetIds.ADA,
      operation: TransactionOperation.Raw,
      source: {
        type: TransferPeerPathType.VaultAccount,
        id: vaultAccountId,
      },
      note: `Redeem NIGHT tokens from vault account ${vaultAccountId} address index ${addressIndex}`,
      extraParameters: {
        rawMessageData: {
          messages: [
            {
              content: transactionId,
              bip44addressIndex: addressIndex,
            },
          ],
        },
      },
    };

    const fbResponse = await this.fireblocksService.broadcastTransaction(
      transactionPayload
    );
    if (!fbResponse?.signature?.fullSig) {
      throw new Error("Missing signature from Fireblocks");
    }
    if (!fbResponse.publicKey) {
      throw new Error("Missing public key from Fireblocks");
    }

    const publicKeyBytes = Buffer.from(fbResponse.publicKey, "hex");
    const signatureBytes = Buffer.from(fbResponse.signature.fullSig, "hex");
    const publicKey = lucid.C.PublicKey.from_bytes(publicKeyBytes);
    const vkey = lucid.C.Vkey.new(publicKey);
    const signature = lucid.C.Ed25519Signature.from_bytes(signatureBytes);
    const vkeyWitness = lucid.C.Vkeywitness.new(vkey, signature);
    const vkeyWitnesses = lucid.C.Vkeywitnesses.new();
    vkeyWitnesses.add(vkeyWitness);
    const witnessSet = lucid.C.TransactionWitnessSet.new();
    witnessSet.set_vkeys(vkeyWitnesses);
    return Buffer.from(witnessSet.to_bytes()).toString("hex");
  };

  private waitForConfirmation = async (
    destAddress: string,
    transactionId: string,
    timeoutMs: number,
    intervalMs: number
  ): Promise<string> => {
    const start = Date.now();
    let lastStatus: string = "unknown";
    while (Date.now() - start < timeoutMs) {
      try {
        const status = await this.thawsService.getTransactionStatus(
          destAddress,
          transactionId
        );
        lastStatus = status.status;
        console.log(
          `Transaction ${transactionId} status: ${status.status} (${status.redeemed_amount} NIGHT)`
        );
        if (status.status === ThawStatusSchedule.CONFIRMED) {
          return status.status;
        }
        if (status.status === ThawStatusSchedule.FAILED) {
          throw new Error(
            `Transaction ${transactionId} failed during confirmation`
          );
        }
      } catch (error: any) {
        console.warn(
          `Error checking status (will retry): ${error.message ?? error}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
      `Transaction confirmation timeout after ${timeoutMs}ms. Last status: ${lastStatus}`
    );
  };
}
