import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
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
      if (error) setError("회원가입에 실패했어요. 이미 가입된 이메일일 수 있어요.");
      else setSuccess("가입 완료! 이메일 인증 없이 바로 로그인할 수 있어요.");
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

        <div className="login-tabs">
          <button className={`login-tab${mode === "login" ? " active" : ""}`} onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>
            로그인
          </button>
          <button className={`login-tab${mode === "signup" ? " active" : ""}`} onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>
            회원가입
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="form-group">
              <label>닉네임</label>
              <input
                className="form-input"
                placeholder="예) 클라이밍고수"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>이메일</label>
            <input
              className="form-input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>비밀번호</label>
            <input
              className="form-input"
              type="password"
              placeholder={mode === "signup" ? "6자 이상" : "비밀번호 입력"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: 8, padding: "13px" }}
            disabled={loading}
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
