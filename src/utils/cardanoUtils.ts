import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { nightTokenName } from "../constants";
import { Utxo } from "../types";

export const fetchUtxos = async (
  blockfrostContext: BlockFrostAPI,
  address: string
) => {
  try {
    const utxos = await blockfrostContext.addressesUtxos(address);

    return utxos;
  } catch (error: any) {
    throw new Error(`fb service error: ${error.message}`);
  }
};

export const calculateTokenAmount = (
  utxo: Utxo,
  policyId: string,
  tokenName: string
): number => {
  if (tokenName === "ADA" && policyId === "") {
    const ada = utxo.amount.find((a) => a.unit === "lovelace");
    return ada ? parseInt(ada.quantity, 10) : 0;
  }

  const assetUnit = policyId + Buffer.from(tokenName, "utf8").toString("hex");
  const token = utxo.amount.find((a) => a.unit === assetUnit);
  return token ? parseInt(token.quantity, 10) : 0;
};

export const getLovelaceAmount = (utxo: Utxo): number => {
  const ada = utxo.amount.find((a) => a.unit === "lovelace");
  return ada ? parseInt(ada.quantity, 10) : 0;
};

export const filterUtxos = (utxos: Utxo[], tokenPolicyId: string): Utxo[] => {
  try {
    const filtered = utxos.filter(
      (utxo) => calculateTokenAmount(utxo, tokenPolicyId, nightTokenName) > 0
    );

    if (filtered.length === 0) {
      throw new Error(
        `No UTXOs found containing token '${nightTokenName}' with policy ID '${tokenPolicyId}'.`
      );
    }

    return filtered;
  } catch (err: any) {
    throw new Error(
      `An unexpected error occurred while filtering UTXOs. ${err.message}`
    );
  }
};

export const buildTransaction = ({
  txInputs,
  txOutputs,
  fee,
  ttl,
}: {
  txInputs: any[];
  txOutputs: any[];
  fee: number;
  ttl: number;
}): any => {
  return {
    inputs: txInputs,
    outputs: txOutputs,
    fee,
    ttl,
  };
};
