import { NavLink } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  useEffect(() => {
    if (myName && myName !== "나") {
      supabase.from("profiles").upsert({ user_name: myName }, { onConflict: "user_name" });
    }
  }, [myName]);

  return (
    <>
      <nav className="topnav">
        <span className="logo">Climb<span>Coach</span></span>
        <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={signOut}>
          로그아웃
        </button>
      </nav>

      <nav className="bottom-nav">
        <NavLink to="/board" className={({ isActive }) => isActive ? "active" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 8h10M7 12h6M7 16h8" />
          </svg>
          커뮤니티
        </NavLink>
        <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 10l-4 4l6 6l4-16l-16 4l6 6l4-4z" />
          </svg>
          피드
        </NavLink>
        <NavLink to="/gymmap" className={({ isActive }) => isActive ? "active" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          암장찾기
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
