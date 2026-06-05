import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@moysklad/uikit/colorVariables.css";
import { Snackbar } from "@moysklad/uikit/components/Snackbar";
import "./styles.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element not found");
}

createRoot(rootEl).render(
  <React.StrictMode>
    <Snackbar>
      <App />
    </Snackbar>
  </React.StrictMode>
);
