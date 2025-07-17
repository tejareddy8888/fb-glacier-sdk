import axios from "axios";
import { midnightClaimAdress } from "../constants.js";
import { SupportedBlockchains } from "../types.js";
import { MSL } from "cardano-web3-js";

export class ClaimApiService {
  constructor() {}
  public claimByAddress = async (
    address: string,
    blockchainId: SupportedBlockchains
  ) => {
    try {
      const response = await axios.get(
        `${midnightClaimAdress}/claims/${blockchainId}?address=${address}`,
        {
          headers: {
            Accept: "application/json;charset=utf-8",
          },
        }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error(`Unexpected response s  tatus: ${response.status}`);
      }
    } catch (error: any) {
      console.error(
        `Error fetching claims for address ${address}:`,
        error.error
      );
      throw error;
    }
  };

  public getClaims = async (
    chain: SupportedBlockchains,
    address: string
  ): Promise<any> => {
    try {
      const response = await axios.get(
        `${midnightClaimAdress}/claims/${chain}?address=${encodeURIComponent(
          address
        )}`
      );

      return response;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error!");
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Response Data:", error.response?.data);
        console.error("Request URL:", error.config?.url);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  };

  public makeClaims = async (
    chain: SupportedBlockchains,
    originAddress: string,
    amount: number,
    message: string,
    fullSig: string,
    destinationAddress: string,
    publicKey: string
  ): Promise<any> => {
    try {
      let coseSign1Hex: string = "";
      let params: any = {};

      switch (chain) {
        case SupportedBlockchains.CARDANO:
          const protectedHeaders = MSL.HeaderMap.new();
          protectedHeaders.set_algorithm_id(
            MSL.Label.from_algorithm_id(MSL.AlgorithmId.EdDSA)
          );

          const protectedSerialized =
            MSL.ProtectedHeaderMap.new(protectedHeaders);
          const unprotectedHeaders = MSL.HeaderMap.new();
          const headers = MSL.Headers.new(
            protectedSerialized,
            unprotectedHeaders
          );

          const messageBytes = new Uint8Array(Buffer.from(message, "utf8"));

          const builder = MSL.COSESign1Builder.new(
            headers,
            messageBytes,
            false
          );
          const hexSig = new Uint8Array(Buffer.from(fullSig, "hex"));
          const coseSign1 = builder.build(hexSig);

          coseSign1Hex = Buffer.from(coseSign1.to_bytes()).toString("hex");

          params = [
            {
              address: originAddress,
              amount,
              cose_sign1: coseSign1Hex,
              dest_address: destinationAddress,
              public_key: publicKey,
            },
          ];
          break;

        case SupportedBlockchains.BITCOIN:
        case SupportedBlockchains.ETHEREUM:
        case SupportedBlockchains.BAT:
        case SupportedBlockchains.BNB:
        case SupportedBlockchains.SOLANA:
        case SupportedBlockchains.AVALANCHE:
          params = [
            {
              address: originAddress,
              amount,
              dest_address: destinationAddress,
              signature: fullSig,
            },
          ];
          break;

        default:
          throw new Error(`chain ${chain} is not supported.`);
      }

      console.log("makeClaim params", params);

      const response = await axios.post(
        `${midnightClaimAdress}/claims/${chain}`,
        params
      );

      console.log("midnight makeClame success");

      return response;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error!");
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Response Data:", error.response?.data);
        console.error("Request URL:", error.config?.url);
      } else {
        console.error("Unexpected error:", error);
      }
      throw error;
    }
  };
}
