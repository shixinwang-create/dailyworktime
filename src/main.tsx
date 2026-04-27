import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // 👈 這行就是關鍵

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
