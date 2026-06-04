import path from "node:path";
import { Router, type Request, type Response } from "express";
import { sendUnauthorized } from "../lib/http/http-responses";
import { getUserContextFromLocals, loadUserContextMiddleware } from "../lib/session/user-context";

function serveFrontendShell() {
  return (req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);

    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: не удалось получить контекст пользователя");
      return;
    }

    res.sendFile(resolveFrontendIndexPath());
  };
}

export function createEntryRouter(): Router {
  const router = Router();

  router.get("/iframe", loadUserContextMiddleware(), async (_req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);

    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: не удалось получить контекст пользователя");
      return;
    }

    res.sendFile(resolveFrontendIndexPath());
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), serveFrontendShell());
  router.get("/widget-invoiceout", loadUserContextMiddleware(), serveFrontendShell());

  router.get("/popup", (_req: Request, res: Response) => {
    res.sendFile(resolveFrontendIndexPath());
  });

  return router;
}

function resolveFrontendIndexPath(): string {
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "dist/frontend/index.html");
  }

  return path.join(process.cwd(), "frontend/dist/index.html");
}
