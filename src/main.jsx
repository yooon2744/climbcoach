import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// React 앱의 시작점입니다.
// HTML의 <div id="root"></div> 안에 App 컴포넌트를 그립니다.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
