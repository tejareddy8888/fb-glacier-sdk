import axios from "axios";
import { midnightClainAdress } from "../constants";
import { SupportedBlockchains } from "../types";

export class ClaimApiService {
  constructor() {}
  public claimByAddress = async (
    address: string,
    blockchainId: SupportedBlockchains
  ) => {
    try {
      let params = {
        // address: address,
        // amount: provtree_response_amount,
        // cose_sign1: message.signature,
        // dest_address: destination_address,
        // cose_key: message.key,
      };
      const response = await axios.get(
        `${midnightClainAdress}/claims/${blockchainId}?address=${address}`,
        {
          headers: {
            Accept: "application/json;charset=utf-8",
          },
        }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error fetching claims for address ${address}:`, error);
      throw error;
    }
  };
  public makeClaim = async (
    originVaultAccountId: string,
    amount: number,
    fullSig: string,
    destinationAddress: string,
    publicKey: string
  ): Promise<any> => {
    try {
    } catch (error) {}
  };
}
