export async function readLoyaltyConnectResponse(response: Response): Promise<{ message?: string } | string> {
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(body) as { message?: string };
    } catch {
      return body;
    }
  }

  return body;
}
