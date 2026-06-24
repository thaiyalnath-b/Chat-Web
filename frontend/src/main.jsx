import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import 'bootstrap/dist/css/bootstrap.min.css';
import SingleTabGuard from "./components/SingleTabGuard";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SingleTabGuard>
      <App />
    </SingleTabGuard>
  </React.StrictMode>
);