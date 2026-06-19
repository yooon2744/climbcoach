// ─────────────────────────────────────────────
// Login.jsx
// 로그인 / 회원가입 페이지.
// Google OAuth 로그인과 이메일+비밀번호 로그인 두 가지를 지원한다.
// 로그인 성공 시 App.jsx의 AppRoutes가 자동으로 메인 페이지로 전환한다.
// ─────────────────────────────────────────────

import { useState } from "react";
import { supabase } from "../lib/supabase";

// OAuth 콜백 후 돌아올 URL (현재 도메인 루트)
const REDIRECT_URL = window.location.origin;

// Google 소셜 로그인 함수
// prompt: "select_account" → 매번 구글 계정 선택창이 뜨게 해서
// 여러 계정으로 테스트할 때 편리하다.
async function signInWithSocial(provider) {
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: REDIRECT_URL,
      queryParams: { prompt: "select_account" },
    },
  });
}

export default function Login() {
  const [mode, setMode] = useState("login");   // "login" | "signup" 탭 상태
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");         // 회원가입 시 닉네임
  const [error, setError] = useState("");       // 오류 메시지
  const [success, setSuccess] = useState("");   // 성공 메시지
  const [loading, setLoading] = useState(false); // 버튼 로딩 상태

  // 폼 제출 처리 (로그인 또는 회원가입)
  async function handleSubmit(e) {
    e.preventDefault(); // 기본 폼 submit(페이지 새로고침) 방지
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      // 이메일 + 비밀번호 로그인
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("이메일 또는 비밀번호가 틀렸어요.");
    } else {
      // 회원가입 유효성 검사
      if (!name.trim()) { setError("닉네임을 입력해주세요."); setLoading(false); return; }
      if (password.length < 6) { setError("비밀번호는 6자 이상이어야 해요."); setLoading(false); return; }

      // 회원가입 - data.name이 user_metadata.name으로 저장됨 (닉네임으로 사용)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) setError("회원가입 실패. 이미 가입된 이메일일 수 있어요.");
      else setSuccess("가입 완료! 바로 로그인할 수 있어요.");
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* 로고 및 슬로건 */}
        <div className="login-logo">
          <div className="login-logo-text">Climb<span>Coach</span></div>
          <p>실패해야 성장한다<br />클라이머들의 피드백 커뮤니티</p>
        </div>

        {/* 소셜 로그인 버튼 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <button className="social-btn social-google" onClick={() => signInWithSocial("google")}>
            <GoogleIcon />
            Google로 시작하기
          </button>
        </div>

        <div className="login-divider">또는 이메일로</div>

        {/* 로그인 / 회원가입 탭 전환 */}
        <div className="login-tabs" style={{ marginTop: 16 }}>
          <button className={`login-tab${mode === "login" ? " active" : ""}`}
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>로그인</button>
          <button className={`login-tab${mode === "signup" ? " active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>회원가입</button>
        </div>

        {/* 오류 / 성공 메시지 */}
        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit}>
          {/* 회원가입 모드일 때만 닉네임 필드 표시 */}
          {mode === "signup" && (
            <div className="form-group">
              <label>닉네임</label>
              <input className="form-input" placeholder="예) 클라이밍고수"
                value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label>이메일</label>
            <input className="form-input" type="email" placeholder="example@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input className="form-input" type="password"
              placeholder={mode === "signup" ? "6자 이상" : "비밀번호 입력"}
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full"
            style={{ marginTop: 8, padding: 13 }} disabled={loading}>
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Google 로고 SVG 아이콘 컴포넌트
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
