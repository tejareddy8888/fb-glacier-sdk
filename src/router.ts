import { Router, Request, Response } from "express";
import { ApiController } from "./controllers/controller.js";

const router: Router = Router();

const apiController = new ApiController();

router
  .get("/health", (_req: Request, res: Response) => {
    console.log("alive");
    res.status(200).send("Alive");
  })
  .get("/provetree/check/:chain/:vaultAccountId", apiController.checkAddress)
  .get("/claim/claims/:chain/:vaultAccountId", apiController.getClaims);

router.post("/claim/claims/:chain", apiController.makeClaims);

export default router;
