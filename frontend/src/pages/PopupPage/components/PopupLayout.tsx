import type { PropsWithChildren } from "react";
import { VStack } from "@moysklad/uikit/components/VStack";

export function PopupSection({ children }: PropsWithChildren) {
  return (
    <VStack size="s12" style={{ padding: "12px 0" }}>
      {children}
    </VStack>
  );
}

export function PopupActionRow({ children }: PropsWithChildren) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{children}</div>;
}

export function PopupLogCard({ children }: PropsWithChildren) {
  return (
    <section
      className="card"
      style={{ alignSelf: "start", display: "flex", flexDirection: "column", maxHeight: "100vh", padding: 0 }}
    >
      {children}
    </section>
  );
}

export function PopupLogBody({ children }: PropsWithChildren) {
  return (
    <VStack
      size="s12"
      style={{ display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0 }}
    >
      {children}
    </VStack>
  );
}

export function PopupScrollableLogList({ children }: PropsWithChildren) {
  return (
    <div className="log-list" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", paddingRight: 4, paddingBottom: 20 }}>
      {children}
    </div>
  );
}
