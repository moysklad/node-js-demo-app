import type { PropsWithChildren } from "react";
import { VStack } from "@moysklad/uikit/components/VStack";

export const WidgetSection = ({ children }: PropsWithChildren<{ padding?: string }>) => {
  return <VStack size="s12">{children}</VStack>;
};

export const WidgetSectionDivider = () => {
  return <div style={{ borderTop: "1px solid var(--app-border)" }} />;
};

export const WidgetActionRow = ({ children }: PropsWithChildren) => {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{children}</div>;
};

export const WidgetScrollBody = ({ children }: PropsWithChildren) => {
  return <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", paddingRight: 4 }}>{children}</div>;
};

export const WidgetScrollableLogList = ({ children }: PropsWithChildren) => {
  return (
    <div className="log-list" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", paddingRight: 4 }}>
      {children}
    </div>
  );
};
