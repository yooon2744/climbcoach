import { NavLink } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState(null); // null | 'pending' | 'accepted'
  const [showPanel, setShowPanel] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (myName && myName !== "나") {
      supabase.from("profiles").upsert({ user_name: myName }, { onConflict: "user_name" });
    }
  }, [myName]);

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest(".search-panel-wrap")) setShowPanel(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSearch() {
    const tag = searchInput.trim().replace(/^@/, "");
    if (!tag) return;
    setSearchLoading(true);
    setSearchNotFound(false);
    setSearchResult(null);
    setShowPanel(true);

    const { data } = await supabase
      .from("profiles")
      .select("user_name, avatar_url, user_tag")
      .eq("user_tag", tag)
      .maybeSingle();

    setSearchLoading(false);
    if (!data) { setSearchNotFound(true); return; }
    setSearchResult(data);

    if (data.user_name && myName && data.user_name !== myName) {
      const { data: row } = await supabase
        .from("follows")
        .select("status")
        .eq("follower", myName)
        .eq("following", data.user_name)
        .maybeSingle();
      setFollowStatus(row?.status || null);
    } else {
      setFollowStatus(null);
    }
  }

  async function handleFollow() {
    if (!searchResult || !myName || searchResult.user_name === myName) return;
    if (followStatus) return;
    await supabase.from("follows").insert({
      follower: myName,
      following: searchResult.user_name,
      status: "pending",
    });
    setFollowStatus("pending");
  }

  const followLabel = followStatus === "accepted" ? "팔로잉" : followStatus === "pending" ? "신청 중" : "팔로우";
  const followDisabled = !!followStatus || !searchResult || searchResult.user_name === myName;

  return (
    <>
      <nav className="topnav">
        <span className="logo" style={{ flexShrink: 0 }}>Climb<span>Coach</span></span>

        {/* 클친 찾기 검색 */}
        <div className="search-panel-wrap" style={{ flex: 1, margin: "0 10px", position: "relative" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              ref={inputRef}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onFocus={() => (searchResult || searchNotFound) && setShowPanel(true)}
              onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleSearch()}
              placeholder="@ 아이디 검색"
              style={{
                flex: 1, background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: 18, padding: "5px 12px", color: "var(--text)", fontSize: 12,
                outline: "none", minWidth: 0,
              }}
            />
            <button
              onClick={handleSearch}
              style={{ background: "var(--accent)", border: "none", color: "#fff", borderRadius: 18, padding: "5px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0, fontWeight: 600 }}>
              찾기
            </button>
          </div>

          {/* 검색 결과 패널 */}
          {showPanel && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: 12, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}>
              {searchLoading && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>검색 중...</div>
              )}
              {searchNotFound && !searchLoading && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>해당 아이디를 찾을 수 없어요</div>
              )}
              {searchResult && !searchLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {searchResult.avatar_url ? (
                    <img src={searchResult.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🧗</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{searchResult.user_name}</div>
                    <div style={{ fontSize: 12, color: "var(--accent)" }}>@{searchResult.user_tag}</div>
                  </div>
                  {searchResult.user_name !== myName && (
                    <button
                      onClick={handleFollow}
                      disabled={followDisabled}
                      style={{
                        background: followDisabled ? "var(--surface2)" : "var(--accent)",
                        border: "none", color: followDisabled ? "var(--text-muted)" : "#fff",
                        borderRadius: 18, padding: "6px 14px", fontSize: 12,
                        cursor: followDisabled ? "default" : "pointer", fontWeight: 600, flexShrink: 0,
                      }}>
                      {followLabel}
                    </button>
                  )}
                  {searchResult.user_name === myName && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>나</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12, flexShrink: 0 }} onClick={signOut}>
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
