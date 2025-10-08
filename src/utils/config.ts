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
  CLIENT_PORT: number;
  FIREBLOCKS: FireblocksConfig;
  BLOCKFROST_PROJECT_ID?: string;
} = {
  PORT: Number(process.env.PORT) || 8000,
  CLIENT_PORT: Number(process.env.CLIENT_PORT) || 3000,
  FIREBLOCKS: {
    apiKey: process.env.FIREBLOCKS_API_KEY || "",
    secretKey: secretKey,
    basePath: (process.env.FIREBLOCKS_BASE_PATH as BasePath) || BasePath.EU,
  },
  BLOCKFROST_PROJECT_ID: process.env.BLOCKFROST_PROJECT_ID || "",
};
