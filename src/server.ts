import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { config } from "./utils/config.js";
import { Express } from "express-serve-static-core";
import { configureRouter } from "./api/router.js";
import { swaggerSpec, swaggerUi } from "./utils/swagger.js";
import path from "path";
import { FbNightApiService } from "./api/apiService.js";
import { ApiServiceConfig } from "./types.js";
import { BasePath } from "@fireblocks/ts-sdk";
import { fileURLToPath } from "url";
import { dirname } from "path";

const fbNightApiServiceConfigs: ApiServiceConfig = {
  apiKey: config.FIREBLOCKS.apiKey || "",
  secretKey: config.FIREBLOCKS.secretKey || "",
  basePath: (config.FIREBLOCKS.basePath as BasePath) || BasePath.US,
  poolConfig: {
    maxPoolSize: parseInt(process.env.POOL_MAX_SIZE || "100"),
    idleTimeoutMs: parseInt(process.env.POOL_IDLE_TIMEOUT_MS || "1800000"),
    cleanupIntervalMs: parseInt(
      process.env.POOL_CLEANUP_INTERVAL_MS || "300000"
    ),
  },
};

const startServer = () => {
  const app = express();

  configureMiddlewares(app);

  const fbNightApiService = new FbNightApiService(fbNightApiServiceConfigs);
  const router = configureRouter(fbNightApiService);
  app.use("/api", router);

  app.get("/health", (_req: Request, res: Response) => {
    console.log("alive");
    res.status(200).send("Alive");
  });

  app.get("/metrics", (_req: Request, res: Response) => {
    const metrics = fbNightApiService.getPoolMetrics();
    res.status(200).json(metrics);
  });

  app.post("/clear-pool", (_req: Request, res: Response) => {
    console.log("Clearing SDK pool...");
    fbNightApiService.clearPool();
    res.status(200).json({ message: "Pool cleared successfully" });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs-json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  app.use("/docs", express.static(path.join(__dirname, "../docs")));

  app.listen(config.PORT, () => {
    console.log(`Example app listening on port ${config.PORT}`);
  });
};

const configureMiddlewares = (app: Express) => {
  app.use(
    cors({
      origin: [`http://localhost:${config.CLIENT_PORT}`],
    })
  );
  app.use(bodyParser.json());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};

export default startServer;
