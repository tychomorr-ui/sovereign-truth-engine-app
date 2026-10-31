import type { Request, Response } from "express";
import { ENV } from "./_core/env";

export function getBetaOpenStatus(betaOpen = ENV.betaOpenMode) {
  return {
    betaOpen,
    authentication: "normal-authentication",
    ownerPrivileges: false,
  } as const;
}

export function betaOpenStatusHandler(_req: Request, res: Response): void {
  res.json(getBetaOpenStatus());
}
