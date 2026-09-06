import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { createApi } from "./api/client";
import { createPortal } from "./api/portal";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App api={createApi()} portal={createPortal()} />
    </BrowserRouter>
  </StrictMode>,
);
