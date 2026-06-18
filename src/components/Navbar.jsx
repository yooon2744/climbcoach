import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  return (
    <>
      <nav className="topnav">
        <span className="logo">Climb<span>Coach</span></span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>👤 {displayName}</span>
          <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={signOut}>
            로그아웃
          </button>
        </div>
      </nav>

      <nav className="bottom-nav">
        <NavLink to="/board" className={({ isActive }) => isActive ? "active" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 8h10M7 12h6M7 16h8" />
          </svg>
          커뮤니티
        </NavLink>
        <NavLink to="/" end className={({ isActive }) => isActive ? "active feed-center-btn" : "feed-center-btn"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 10l-4 4l6 6l4-16l-16 4l6 6l4-4z" />
          </svg>
          피드
        </NavLink>
        <NavLink to="/mypage" className={({ isActive }) => isActive ? "active" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          마이
        </NavLink>
      </nav>
    </>
  );
}
