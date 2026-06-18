import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <>
      <nav className="topnav">
        <span className="logo">Climb<span>Coach</span></span>
        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "13px" }}>
          로그인
        </button>
      </nav>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 10l-4 4l6 6l4-16l-16 4l6 6l4-4z" />
          </svg>
          피드
        </NavLink>

        <NavLink to="/board" className={({ isActive }) => isActive ? "active" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 8h10M7 12h6M7 16h8" />
          </svg>
          번개
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
