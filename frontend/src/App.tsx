import { IframePage, PopupPage, WidgetPage } from "./pages";

function getPathname(): string {
  return window.location.pathname;
}

export const App = () => {
  const pathname = getPathname();

  if (pathname === "/entry/iframe") {
    return <IframePage />;
  }

  if (pathname === "/entry/popup") {
    return <PopupPage />;
  }

  if (pathname === "/entry/widget-customerorder" || pathname === "/entry/widget-invoiceout") {
    return <WidgetPage />;
  }

  return null;
};
