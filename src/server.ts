import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { config } from "./utils/config.js";
import { Express } from "express-serve-static-core";
import router from "./router.js";
import { swaggerSpec, swaggerUi } from "./utils/swagger.js";

const startServer = () => {
  const app = express();

  configureMiddlewares(app);

  app.use('/api',router);
  app.get("/health", (_req: Request, res: Response) => {
    console.log("alive");
    res.status(200).send("Alive");
  });
  
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs-json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});
  app.use(cors());

  app.listen(config.PORT, () => {
    console.log(`Example app listening on port ${config.PORT}`);
  });
};

const configureMiddlewares = (app: Express) => {
  app.use(
    cors({
      origin: ["http://localhost:3000"],
      credentials: true,
      exposedHeaders: ["Authorization"],
    })
  );
  app.use(bodyParser.json());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};

export default startServer;
