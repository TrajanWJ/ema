import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../../../shared/tokens/dist/tokens.css";
import "../../../shared/glass/src/styles/reset.css";
import "../../../shared/glass/src/styles/keyframes.css";
import "./styles/globals.css";
import "./components/shared/glass.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
