import type { WidgetOpenMessage } from "../../../lib/widget-sdk";

export type OpenFeedbackDecision =
  | { kind: "idle" }
  | { kind: "skip"; reason: "missing-message-id" | "already-sent" }
  | { kind: "wait"; messageId: number }
  | { kind: "send"; messageId: number };

type ResolveOpenFeedbackDecisionParams = {
  isContextLoading: boolean;
  latestOpenMessage: WidgetOpenMessage | null;
  lastSentMessageId: number | null;
};

export function resolveOpenFeedbackDecision({
  isContextLoading,
  latestOpenMessage,
  lastSentMessageId,
}: ResolveOpenFeedbackDecisionParams): OpenFeedbackDecision {
  if (!latestOpenMessage) {
    return { kind: "idle" };
  }

  const messageId = latestOpenMessage.messageId;

  if (messageId === undefined) {
    return { kind: "skip", reason: "missing-message-id" };
  }

  if (lastSentMessageId === messageId) {
    return { kind: "skip", reason: "already-sent" };
  }

  if (isContextLoading) {
    return { kind: "wait", messageId };
  }

  return { kind: "send", messageId };
}
