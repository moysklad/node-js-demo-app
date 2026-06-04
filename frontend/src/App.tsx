import IframePage from "./pages/IframePage";
import PopupPage from "./pages/PopupPage";
import WidgetPage from "./pages/WidgetPage";

function getPathname(): string {
  return window.location.pathname;
}

export default function App() {
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
}
