import { Router, Request, Response } from "express";
import { ApiController } from "./controllers/controller";

const router: Router = Router();

const apiController = new ApiController();

router
  .get("/health", (_req: Request, res: Response) => {
    console.log("alive");
    res.status(200).send("Alive");
  })
  .get("/provetree/check/:chain/:address", apiController.checkAddress)
  .get("/claim/check/:chain/:address", apiController.checkAddress);

router.post("/claim/claims/:chain/:address", apiController.makeClaim);

export default router;
