export type LoyaltyConnectPayload = {
  message?: string;
  loyalty?: {
    className?: string;
    title?: string;
    details?: string;
  };
};

export async function readLoyaltyConnectResponse(response: Response): Promise<LoyaltyConnectPayload | string> {
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(body) as LoyaltyConnectPayload;
    } catch {
      return body;
    }
  }

  return body;
}
