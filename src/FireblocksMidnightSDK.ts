import {
  SignedMessageAlgorithmEnum,
  TransactionOperation,
  TransferPeerPathType,
  VaultWalletAddress,
} from "@fireblocks/ts-sdk";
import * as lucid from "lucid-cardano";
import { FireblocksService } from "./services/fireblocks.service.js";
import { ClaimApiService } from "./services/claim.api.service.js";
import { ProvetreeService } from "./services/provetree.service.js";
import {
  ClaimHistoryResponse,
  SubmitClaimResponse,
  SupportedAssetIds,
  SupportedBlockchains,
} from "./types.js";
import {
  blockfrostUrl,
  nightTokenName,
  tokenTransactionFee,
} from "./constants.js";
import { getAssetIdsByBlockchain } from "./utils/general.js";
import { calculateTtl, fetchAndSelectUtxos } from "./utils/cardano.utils.js";

import { config } from "./utils/config.js";

export class FireblocksMidnightSDK {
  private fireblocksService: FireblocksService;
  private claimApiService: ClaimApiService;
  private provetreeService: ProvetreeService;
  private assetId: SupportedAssetIds;
  private vaultAccountId: string;
  private address: string;
  private blockfrostProjectId: string;
  private lucid!: lucid.Lucid;

  constructor(params: {
    fireblocksService: FireblocksService;
    claimApiService: ClaimApiService;
    provetreeService: ProvetreeService;
    assetId: SupportedAssetIds;
    vaultAccountId: string;
    address: string;
    blockfrostProjectId: string;
  }) {
    this.fireblocksService = params.fireblocksService;
    this.claimApiService = params.claimApiService;
    this.provetreeService = params.provetreeService;
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
    vaultAccountId: string;
    chain: SupportedBlockchains;
  }): Promise<FireblocksMidnightSDK> => {
    try {
      const { vaultAccountId, chain } = params;
      const assetId = getAssetIdsByBlockchain(chain);
      if (!assetId) {
        throw new Error(`Unsupported blockchain: ${chain}`);
      }

      const fireblocksConfig = config.FIREBLOCKS;

      const fireblocksService = new FireblocksService(fireblocksConfig);
      const address = await fireblocksService.getVaultAccountAddress(
        vaultAccountId,
        assetId
      );

      const blockfrostProjectId = config.BLOCKFROST_PROJECT_ID;
      if (!blockfrostProjectId) {
        throw new Error("BLOCKFROST_PROJECT_ID is not configured.");
      }

      const claimApiService = new ClaimApiService();
      const provetreeService = new ProvetreeService();

      const sdkInstance = new FireblocksMidnightSDK({
        fireblocksService,
        claimApiService,
        provetreeService,
        assetId,
        vaultAccountId,
        address,
        blockfrostProjectId,
      });

      const network = blockfrostUrl.includes("mainnet")
        ? "Mainnet"
        : blockfrostUrl.includes("preprod")
        ? "Preprod"
        : "Preview";
      sdkInstance.lucid = await lucid.Lucid.new(
        new lucid.Blockfrost(blockfrostUrl, blockfrostProjectId),
        network
      );
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
   * Checks if the current address is valid for the specified blockchain and fetches it's allocation value.
   *
   * @param {SupportedBlockchains} chain - The blockchain to check the address against.
   * @returns {Promise<number>} Returns a numeric result indicating address validity.
   * @throws {Error} If address validation fails.
   */
  public checkAddressAllocation = async (
    chain: SupportedBlockchains
  ): Promise<number> => {
    try {
      return await this.provetreeService.checkAddressAllocation(
        this.address,
        chain as SupportedBlockchains
      );
    } catch (error: any) {
      throw new Error(
        `Error in checkAddressAllocation:
        ${error instanceof Error ? error.message : error}`
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
  public getClaimsHistory = async (
    chain: SupportedBlockchains
  ): Promise<ClaimHistoryResponse[]> => {
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
   * This method performs the following steps:
   * 1. Retrieves the origin address from the current instance context.
   * 2. Determines the claimable amount for the origin address on the specified blockchain using the ProveTree service.
   * 3. Obtains a message signature and public key from the Fireblocks service, including algorithm and fullSig encoding details.
   * 4. Handles signature formatting differences—encoding for BTC, ETH, and other asset types as required.
   * 5. Calls the claims API service to finalize and submit the claim.
   *
   * @param {SupportedBlockchains} chain - The blockchain network on which to execute the claim.
   * @param {string} destinationAddress - The destination address to which the claim is made.
   * @returns {Promise<SubmitClaimResponse[]>} Resolves with an array of SubmitClaimResponse on successful claim submission.
   * @throws {Error} Throws on any failure, including missing signature data, Fireblocks response issues, or claim API errors.
   */
  public makeClaims = async (
    chain: SupportedBlockchains,
    destinationAddress: string
  ): Promise<SubmitClaimResponse[]> => {
    try {
      const originAddress = this.address;
      const allocationValue = await this.provetreeService.checkAddressAllocation(
        originAddress,
        chain as SupportedBlockchains
      );

      const fbResoponse = await this.fireblocksService.signMessage(
        chain as SupportedBlockchains,
        this.assetId,
        this.vaultAccountId,
        destinationAddress,
        allocationValue
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
        } else {
          const ethV = v + 27;

          signature = r + s + ethV.toString(16).padStart(2, "0");
        }
      } else {
        signature = fbResoponse.signature.fullSig;
      }

      return await this.claimApiService.makeClaims(
        chain as SupportedBlockchains,
        originAddress,
        allocationValue,
        message,
        signature,
        destinationAddress,
        publicKey
      );
    } catch (error: any) {
      throw new Error(
        `Error in makeClaims:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  /**
   * Transfers a specified amount of native tokens and ADA to a recipient address, handling UTXO selection,
   * transaction construction, signing via Fireblocks, and submission to the Cardano network.
   *
   * @param {string} recipientAddress - The Bech32 address of the recipient to receive tokens and ADA.
   * @param {string} tokenPolicyId - The policy ID of the native token to transfer.
   * @param {number} requiredTokenAmount - The amount of the token to transfer.
   * @param {number} [minRecipientLovelace=1_200_000] - The minimum amount of ADA (in lovelace) to send to the recipient. Defaults to 1,200,000.
   * @param {number} [minChangeLovelace=1_200_000] - The minimum amount of ADA (in lovelace) to keep as change. Defaults to 1,200,000.
   * @returns {Promise<{ txHash: string; senderAddress: string; tokenName: SupportedAssetIds; }>} An object containing the transaction hash, sender address, and token name.
   * @throws {Error} Throws if there are insufficient UTXOs, insufficient balance, or Fireblocks signing fails.
   */
  public transferClaims = async (
    recipientAddress: string,
    tokenPolicyId: string,
    requiredTokenAmount: number,
    minRecipientLovelace: number = 1_200_000,
    minChangeLovelace: number = 1_200_000
  ): Promise<{
    txHash: string;
    senderAddress: string;
    tokenName: SupportedAssetIds;
  }> => {
    try {
      const transactionFee = BigInt(tokenTransactionFee);

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
                type: "RAW",
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
  public getVaultAccountAddresses = async (
    vaultAccountId: string
  ): Promise<VaultWalletAddress[]> => {
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
}
