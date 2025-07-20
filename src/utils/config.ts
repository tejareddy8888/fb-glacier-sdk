import dotenv from "dotenv";
import {
  BasePath,
  ConfigurationOptions as FireblocksConfig,
} from "@fireblocks/ts-sdk";
import { readFileSync } from "fs";
dotenv.config();

const secretKeyPath = process.env.FIREBLOCKS_SECRET_KEY_PATH!;
const secretKey = readFileSync(secretKeyPath, "utf-8");

export const config: {
  PORT: number;
  FIREBLOCKS: FireblocksConfig;
  BLOCKFROST_PROJECT_ID?: string;
} = {
  PORT: Number(process.env.PORT) || 8000,
  FIREBLOCKS: {
    apiKey: process.env.FIREBLOCKS_API_KEY || "",
    secretKey: secretKey,
    basePath: (process.env.BASE_PATH as BasePath) || BasePath.US,
  },
  BLOCKFROST_PROJECT_ID: process.env.BLOCKFROST_PROJECT_ID || "",
};
