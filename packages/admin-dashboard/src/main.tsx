import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Global reset
document.documentElement.style.margin = "0";
document.body.style.margin = "0";
document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
