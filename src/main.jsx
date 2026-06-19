// ─────────────────────────────────────────────
// main.jsx
// React 앱의 진입점(entry point).
// index.html 의 <div id="root"> 안에 App 컴포넌트를 마운트한다.
// styles.css 도 여기서 전역으로 불러온다.
// ─────────────────────────────────────────────

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  // StrictMode: 개발 환경에서 잠재적 문제를 두 번 렌더링해서 감지해준다.
  // 배포(production) 환경에서는 자동으로 비활성화된다.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
