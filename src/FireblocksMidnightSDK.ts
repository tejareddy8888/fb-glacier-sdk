import {
  SignedMessageAlgorithmEnum,
  TransactionOperation,
  TransferPeerPathType,
  VaultWalletAddress,
} from "@fireblocks/ts-sdk";
import * as lucid from "lucid-cardano";
import * as C from "lucid-cardano";
import { FireblocksService } from "./services/fireblocks.service.js";
import { ClaimApiService } from "./services/claim.api.service.js";
import { ProvetreeService } from "./services/provetree.service.js";
import { SupportedAssetIds, SupportedBlockchains } from "./types.js";
import {
  blockfrostUrl,
  nightTokenName,
  tokenTransactionFee,
} from "./constants.js";
import { getAssetIdsByBlockchain } from "./utils/general.js";
import {
  calculateTtl,
  fetchAndSelectUtxos,
} from "./utils/cardano.utils.js";

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

  public checkAddress = async (chain: SupportedBlockchains) => {
    try {
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
        this.assetId,
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

  public transferClaims = async (
    recipientAddress: string,
    tokenPolicyId: string,
    requiredTokenAmount: number,
    minRecipientLovelace = 1_200_000,
    minChangeLovelace = 1_200_000
  ) => {
    try {
      const transactionFee = BigInt(tokenTransactionFee);

      // 1. Fetch UTXOs & validate
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

      // 2. Convert selected UTXOs to Lucid UTxO format
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

      // 3. Build the transaction

      const assetNameUnit =
        tokenPolicyId + lucid.toHex(Buffer.from(nightTokenName, "utf8"));

      const dummyWallet: lucid.WalletApi = {
        getNetworkId: async () => 1, // or 0 for testnet
        getUtxos: async () => [], // empty or mock utxo if needed
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

      // 1. Complete unsigned transaction (TxComplete)
      const unsignedTx = await tx.complete();

      const txHash = unsignedTx.toHash();

      // 5. Fireblocks raw signing request
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

      // 🔧 6. Manually construct witness from raw signature
      const publicKeyBytes = Buffer.from(fbResponse.publicKey, "hex");
      const signatureBytes = Buffer.from(fbResponse.signature.fullSig, "hex");
      const publicKey = C.C.PublicKey.from_bytes(publicKeyBytes);

      const vkey = C.C.Vkey.new(publicKey);

      const signature = C.C.Ed25519Signature.from_bytes(signatureBytes);
      const vkeyWitness = C.C.Vkeywitness.new(vkey, signature);
      const vkeyWitnesses = C.C.Vkeywitnesses.new();
      vkeyWitnesses.add(vkeyWitness);
      const witnessSet = C.C.TransactionWitnessSet.new();
      witnessSet.set_vkeys(vkeyWitnesses);

      // 2. Serialize witness set to bytes and convert to hex string
      const witnessHex = Buffer.from(witnessSet.to_bytes()).toString("hex");

      // 3. Call assemble with array of hex strings
      const signedTxComplete = unsignedTx.assemble([witnessHex]);

      // 3. Complete the signed transaction (TxSigned)
      const signedTx = await signedTxComplete.complete();

      // 4. Serialize and submit the signed transaction
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

  public getVaultAccountAddresses = async (
    vaultAccountId: string
  ): Promise<VaultWalletAddress[]> => {
    try {
      const addresses = await this.fireblocksService.getVaultAccountAddresses(
        vaultAccountId,
        this.assetId
      );
      return addresses;
    } catch (error: any) {
      throw new Error(
        `Error in getVaultAccountAddresses:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };
}
