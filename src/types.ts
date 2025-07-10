import { TransactionOperation, TransferPeerPathType } from "@fireblocks/ts-sdk";

export enum SupportedBlockchains {
  CARDANO = "cardano",
  BITCOIN = "bitcoin",
  ETHEREUM = "ethereum",
  EVM = "evm",
  SOLANA = "solana",
  AVALANCHE = "avax",
  XRP = "xrp",
}

export enum SupportedAssetIds {
  ADA = "ADA",
  BTC = "BTC",
  ETH = "ETH",
  BNB = "BNB",
  BAT = "BAT",
  SOL = "SOL",
  AVAX = "AVAX",
  XRP = "XRP",
}

enum TypedMessagesTypes {
  EIP191 = "EIP191",
  EIP712 = "EIP712",
  BTC = "BTC_MESSAGE",
}

interface MessagePayloadSource {
  type: TransferPeerPathType;
  id: string;
}

interface TypedMessages {
  content: any;
  type: TypedMessagesTypes;
}

interface RawMessageData {
  messages: TypedMessages[];
}

interface MessagePayloadSourceExtraParameters {
  rawMessageData: RawMessageData;
}

interface MessagePayload {
  operation?: TransactionOperation;
  assetId: SupportedBlockchains;
  source?: MessagePayloadSource;
  note?: string;
  vaultAccountId?: string;
  bip44addressIndex?: number;
  message?: string;
  extraParameters?: MessagePayloadSourceExtraParameters;
}

interface RawSigningConfig {
  assetId: string;
  message: string;
  vaultAccountId: string;
  bip44addressIndex?: number;
  note?: string;
  extraParameters?: Record<string, any>;
}
