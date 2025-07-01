import { Router, Request, Response } from "express";

const router: Router = Router();

router.get("/health", (_req: Request, res: Response) => {
  console.log("alive");
  res.status(200).send("Alive");
});

export default router;
