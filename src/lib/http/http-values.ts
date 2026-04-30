import type { Request } from "express";

export function getStringRouteParam(req: Request, key: string): string {
  const value = req.params[key];
  return typeof value === "string" ? value : "";
}

export function getStringQueryParam(req: Request, key: string): string {
  const value = req.query[key];
  return typeof value === "string" ? value.trim() : "";
}
