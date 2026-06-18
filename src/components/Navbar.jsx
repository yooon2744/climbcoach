import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  async function handleSearch(q) {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("user_name")
      .ilike("user_name", `%${q}%`)
      .neq("user_name", myName)
      .limit(5);
    setSearchResults(data || []);
  }

  async function openUserProfile(userName) {
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower", myName)
      .eq("following", userName)
      .maybeSingle();
    setIsFollowing(!!data);
    setSelectedUser(userName);
  }

  async function handleFollow() {
    if (isFollowing) {
      await supabase.from("follows").delete()
        .eq("follower", myName).eq("following", selectedUser);
      setIsFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower: myName, following: selectedUser });
      setIsFollowing(true);
    }
  }

  return (
    <>
      <nav className="topnav">
        <span className="logo">Climb<span>Coach</span></span>

        <div className="search-wrap">
          <input
            className="search-input"
            placeholder="클라이머 검색"
            value={searchQuery}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onChange={e => handleSearch(e.target.value)}
          />
          {showDropdown && searchResults.length > 0 && (
            <div className="search-dropdown">
              {searchResults.map(r => (
                <div key={r.user_name} className="search-result-item"
                  onMouseDown={() => openUserProfile(r.user_name)}>
                  <div className="avatar" style={{ width: 30, height: 30, fontSize: 14, flexShrink: 0 }}>🧗</div>
                  <span>{r.user_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12, flexShrink: 0 }} onClick={signOut}>
          로그아웃
        </button>
      </nav>

      {/* 유저 프로필 모달 */}
      {selectedUser && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedUser(null); }}>
          <div className="modal-sheet" style={{ textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--surface2)", border: "3px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 12px" }}>🧗</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{selectedUser}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>클라이머</div>
            <button
              className={`btn ${isFollowing ? "btn-ghost" : "btn-primary"} btn-full`}
              style={{ marginBottom: 8 }}
              onClick={handleFollow}>
              {isFollowing ? "✓ 팔로잉" : "+ 팔로우"}
            </button>
            <button className="btn btn-ghost btn-full" onClick={() => setSelectedUser(null)}>닫기</button>
          </div>
        </div>
      )}

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
