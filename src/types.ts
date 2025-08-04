import { FireblocksMidnightSDK } from "./FireblocksMidnightSDK.js";

export interface SdkPoolItem {
  sdk: FireblocksMidnightSDK;
  lastUsed: Date;
  isInUse: boolean;
}

export interface PoolConfig {
  maxPoolSize: number;
  idleTimeoutMs: number;
  cleanupIntervalMs: number;
  connectionTimeoutMs: number;
  retryAttempts: number;
}

export interface SdkManagerMetrics {
  totalInstances: number;
  activeInstances: number;
  idleInstances: number;
  instancesByVaultAccount: Record<string, boolean>;
}

export enum SupportedBlockchains {
  AVALANCHE = "avax",
  BAT = "bat",
  BITCOIN = "bitcoin",
  BNB = "bnb",
  CARDANO = "cardano",
  CARDANO_TESTNET = "cardano_testnet",
  ETHEREUM = "ethereum",
  SOLANA = "solana",
  XRP = "xrp",
}

export enum SupportedAssetIds {
  ADA = "ADA",
  ADA_TEST = "ADA_TEST",
  AVAX = "AVAX",
  BAT = "BAT",
  BTC = "BTC",
  BNB = "BNB",
  ETH = "ETH",
  SOL = "SOL",
  XRP = "XRP",
}

export interface Utxo {
  address: string;
  tx_hash: string;
  tx_index: number;
  output_index: number;
  amount: {
    unit: string;
    quantity: string;
  }[];
  block: string;
  data_hash: string | null;
  inline_datum: string | null;
  reference_script_hash: string | null;
}

export interface SubmitClaimResponse {
  address: string;
  amount: number;
  claim_id: string;
  dest_address: string;
}

export interface ClaimHistoryResponse {
  address: string;
  amount: number;
  blockchain: SupportedBlockchains;
  claim_id: string;
  confirmation_blocks: any | null;
  failure: any | null;
  leaf_index: number;
  status: string;
  transaction_id: string | number | null;
}
