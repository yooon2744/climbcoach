// ─────────────────────────────────────────────
// App.jsx
// 앱의 최상위 컴포넌트.
// 라우팅(URL → 페이지 연결)과 인증 Provider를 설정한다.
// ─────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Main from "./pages/Main";
import Board from "./pages/Board";
import MyPage from "./pages/MyPage";
import GymMap from "./pages/GymMap";

// 실제 페이지 라우팅을 담당하는 내부 컴포넌트.
// AuthProvider 안에 있어야 useAuth() 훅을 사용할 수 있다.
function AppRoutes() {
  const { user, loading } = useAuth();

  // 로그인 상태 확인 중일 때 로딩 화면 표시
  // (이 단계를 생략하면 로그인 여부를 알기 전에 Login 화면이 잠깐 깜빡인다)
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117" }}>
        <div style={{ color: "#ff6b35", fontSize: 20, fontWeight: 700 }}>ClimbCoach</div>
      </div>
    );
  }

  // 로그인 안 된 경우 → Login 페이지만 렌더링
  if (!user) return <Login />;

  // 로그인 된 경우 → 상단/하단 Navbar + 페이지 라우팅
  return (
    <>
      <Navbar />
      <Routes>
        {/* 피드 (메인) */}
        <Route path="/" element={<Main />} />
        {/* 커뮤니티 */}
        <Route path="/board" element={<Board />} />
        {/* 암장 찾기 (카카오맵) */}
        <Route path="/gymmap" element={<GymMap />} />
        {/* 마이페이지 */}
        <Route path="/mypage" element={<MyPage />} />
        {/* 알 수 없는 경로는 메인으로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

// BrowserRouter → 브라우저 주소창 URL 기반 라우팅
// AuthProvider → 앱 전체에 로그인 정보(user, profileImg 등)를 공유
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
