import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { App } from "./App.tsx";
import { FileFilterProvider } from "./lib/fileFilter.tsx";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FileFilterProvider>
      <App />
    </FileFilterProvider>
  </React.StrictMode>,
);
