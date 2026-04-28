import type { Response } from "express";

export function sendUnauthorized(res: Response, message?: string): void {
  if (message == null) {
    res.status(401).end();
    return;
  }
  res.status(401).send(message);
}

export function sendForbidden(res: Response, message = "Недостаточно прав"): void {
  res.status(403).send(message);
}

export function sendBadRequest(res: Response, message: string): void {
  res.status(400).send(message);
}

export function sendBadGateway(res: Response, message: string): void {
  res.status(502).send(message);
}
