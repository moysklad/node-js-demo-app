import type { WidgetContext } from "../types";

export function resolveWidgetEntity(pathname: string): WidgetContext["entity"] | null {
  if (pathname === "/entry/widget-customerorder") {
    return "customerorder";
  }

  if (pathname === "/entry/widget-invoiceout") {
    return "invoiceout";
  }

  return null;
}
