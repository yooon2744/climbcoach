import { useState } from "react";
import { supabase } from "../lib/supabase";

const REDIRECT_URL = window.location.origin;

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
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("이메일 또는 비밀번호가 틀렸어요.");
    } else {
      if (!name.trim()) { setError("닉네임을 입력해주세요."); setLoading(false); return; }
      if (password.length < 6) { setError("비밀번호는 6자 이상이어야 해요."); setLoading(false); return; }
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
        <div className="login-logo">
          <div className="login-logo-text">Climb<span>Coach</span></div>
          <p>실패해야 성장한다<br />클라이머들의 피드백 커뮤니티</p>
        </div>

        {/* 소셜 로그인 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <button className="social-btn social-google" onClick={() => signInWithSocial("google")}>
            <GoogleIcon />
            Google로 시작하기
          </button>
        </div>

        <div className="login-divider">또는 이메일로</div>

        <div className="login-tabs" style={{ marginTop: 16 }}>
          <button className={`login-tab${mode === "login" ? " active" : ""}`}
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>로그인</button>
          <button className={`login-tab${mode === "signup" ? " active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>회원가입</button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        <form onSubmit={handleSubmit}>
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
