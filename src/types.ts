import { BasePath } from "@fireblocks/ts-sdk";
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

export interface ApiServiceConfig {
  apiKey: string;
  secretKey: string;
  basePath: BasePath | string;
  poolConfig?: Partial<PoolConfig>;
}

export enum TransactionType {
  CHECK_ADDRESS_ALLOCATION = "checkAddressAllocation",
  GET_CLAIMS_HISTORY = "getClaimsHistory",
  MAKE_CLAIMS = "makeClaims",
  TRANSFER_CLAIMS = "transferClaims",
  GET_VAULT_ACCOUNT_ADDRESSES = "getVaultAccountAddresses",
  GET_PHASE_CONFIG = "getPhaseConfig",
  GET_THAW_SCHEDULE = "getThawSchedule",
  GET_THAW_STATUS = "getThawStatus",
  REDEEM_NIGHT = "redeemNight",
}

export enum ThawStatusSchedule {
  UPCOMING = "upcoming",
  QUEUED = "queued",
  REDEEMABLE = "redeemable",
  SUBMITTED = "submitted",
  FAILED = "failed",
  CONFIRMING = "confirming",
  CONFIRMED = "confirmed",
  SKIPPED = "skipped",
}

export interface checkAddressAllocationOpts {
  chain: SupportedBlockchains;
}

export interface getClaimsHistoryOpts {
  chain: SupportedBlockchains;
}

export interface makeClaimsOpts {
  chain: SupportedBlockchains;
  destinationAddress: string;
}

export interface trasnsferClaimsOpts {
  recipientAddress: string;
  tokenPolicyId: string;
  requiredTokenAmount: number;
  minRecipientLovelace?: number;
  minChangeLovelace?: number;
}

export interface getVaultAccountAddressesOpts {
  vaultAccountId: string;
}

export interface thawScheduleOpts {
  vaultAccountId: string;
  index: number;
}

export interface thawStatusOpts {
  destAddress: string;
  transactionId: string;
}

export interface redeemNightOpts {
  vaultAccountId: string;
  index: number;
  waitForConfirmation?: boolean;
  pollingIntervalMs?: number;
  timeoutMs?: number;
}

export interface PhaseConfigResponse {
  genesis_timestamp: number;
  jitter_strata_count: number;
  redemption_increment_period: number;
  redemption_increments: number;
  redemption_initial_delay: number;
}

export interface Thaw {
  amount: number;
  queue_position?: number;
  status: ThawStatusSchedule;
  thawing_period_start: string;
  transaction_id?: string;
}

export interface ThawScheduleResponse {
  number_of_claimed_allocations: number;
  thaws: Thaw[];
}

export interface TransactionBuildRequest {
  change_address: string;
  collateral_utxos: string[];
  funding_utxos: string[];
}

export interface TransactionBuildResponse {
  redeemed_amount: number;
  require_thawing_extra_signature: boolean;
  transaction: string;
  transaction_id: string;
}

export interface TransactionSubmissionRequest {
  transaction: string;
  transaction_witness_set: string;
}

export interface ThawTransactionResponse {
  estimated_submission_time: number;
  transaction_id: string;
}

export interface ThawTransactionStatus {
  redeemed_amount: number;
  status: ThawStatusSchedule;
  transaction_id: string;
}

export interface ExecuteTransactionOpts {
  vaultAccountId: string;
  chain: SupportedBlockchains;
  transactionType: TransactionType;
  params:
    | checkAddressAllocationOpts
    | getClaimsHistoryOpts
    | makeClaimsOpts
    | trasnsferClaimsOpts
    | getVaultAccountAddressesOpts
    | thawScheduleOpts
    | thawStatusOpts
    | redeemNightOpts
    | Record<string, never>;
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

export interface TransferClaimsResponse {
  txHash: string;
  senderAddress: string;
  tokenName: SupportedAssetIds;
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
