import type { Request, Response } from "express";
import { ENV } from "./_core/env";

export function getBetaOpenStatus() {
  return {
    betaOpen: ENV.betaOpenMode,
    authentication: ENV.betaOpenMode ? "temporary-beta-session" : "normal-authentication",
    ownerPrivileges: false,
  } as const;
}

export function betaOpenStatusHandler(_req: Request, res: Response): void {
  res.json(getBetaOpenStatus());
}
