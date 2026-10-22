import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireStaff: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Please sign in to access incident records." });
    return;
  }

  next();
};
