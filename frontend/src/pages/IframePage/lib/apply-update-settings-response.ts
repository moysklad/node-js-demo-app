import type { IframeContext, UpdateSettingsResponse } from "../types";

export function applyUpdateSettingsResponse(
  current: IframeContext,
  payload: UpdateSettingsResponse | null,
  draftMessage: string,
  draftStore: string
): { nextData: IframeContext; nextDraftMessage: string; nextDraftStore: string } {
  const persistedMessage = payload?.status?.infoMessage ?? draftMessage;
  const persistedStore = payload?.status?.store ?? draftStore;

  return {
    nextData: {
      ...current,
      infoMessage: persistedMessage,
      isSettingsRequired: !Boolean(payload?.status?.showDetails),
      store: persistedStore,
    },
    nextDraftMessage: persistedMessage,
    nextDraftStore: persistedStore,
  };
}
