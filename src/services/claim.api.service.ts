import axios from "axios";
import { midnightClaimAdress } from "../constants";
import { SupportedBlockchains } from "../types";

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
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      console.error(
        `Error fetching claims for address ${address}:`,
        error.error
      );
      throw error;
    }
  };
  public makeClaim = async (
    chain: SupportedBlockchains,
    originAddress: string,
    amount: number,
    fullSig: string,
    destinationAddress: string,
    publicKey: string
  ): Promise<any> => {
    try {
      const params = {
        address:
          "addr1qx04aad538pz2nxreh89wwr7vlzt7r2vq9np9y8l4xgmtt7cmxdvdp35gv3ym76dmu2k9z5dpzsdy8ah88tnfxaz30fqemenu2",
        amount: amount,
        cose_sign1: fullSig,
        dest_address:
          "addr_test1qpkpnd8tkksxlckh86wdrt2ahqc27f2kje8dnurxwdztksmcerg8kjmdyyq2azws45wx2ldn8wgsgjqr35yyhz05h4rqc04lcv",
        public_key: publicKey,
      };
      console.log(params);

      const response = await axios.post(
        `${midnightClaimAdress}/claims/${chain}`,
        params
      );

      console.log("midnight makeClame response", params);

      return response;
    } catch (error: any) {
      console.error(
        `Error fetching making claim for va ${originAddress}:`,
        error
      );
      throw error.message;
    }
  };
}
