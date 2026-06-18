import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

function isVideoUrl(url) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url);
}

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
  const [userStats, setUserStats] = useState(null);
  const [userPosts, setUserPosts] = useState([]);

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
    setUserStats(null);
    setUserPosts([]);

    const [
      { data: followCheck },
      { data: posts },
      { data: followers },
      { data: following },
    ] = await Promise.all([
      supabase.from("follows").select("id").eq("follower", myName).eq("following", userName).maybeSingle(),
      supabase.from("posts").select("id, media_urls, video_url").eq("user_name", userName).order("created_at", { ascending: false }).limit(9),
      supabase.from("follows").select("follower").eq("following", userName),
      supabase.from("follows").select("following").eq("follower", userName),
    ]);

    setIsFollowing(!!followCheck);
    setUserPosts(posts || []);
    const names = new Set([
      ...(followers || []).map(f => f.follower),
      ...(following || []).map(f => f.following),
    ]);
    setUserStats({
      postCount: (posts || []).length,
      friendCount: names.size,
    });
    setSelectedUser(userName);
  }

  async function handleFollow() {
    if (isFollowing) {
      await supabase.from("follows").delete()
        .eq("follower", myName).eq("following", selectedUser);
      setIsFollowing(false);
      setUserStats(prev => prev ? { ...prev, friendCount: Math.max(0, prev.friendCount - 1) } : prev);
    } else {
      await supabase.from("follows").insert({ follower: myName, following: selectedUser });
      setIsFollowing(true);
      setUserStats(prev => prev ? { ...prev, friendCount: prev.friendCount + 1 } : prev);
    }
  }

  return (
    <>
      <nav className="topnav">
        <span className="logo">Climb<span>Coach</span></span>

        <div className="search-wrap">
          <input
            className="search-input"
            placeholder="클친찾기"
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

      {/* 유저 프로필 모달 (인스타 스타일) */}
      {selectedUser && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedUser(null); }}>
          <div className="modal-sheet user-profile-sheet">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button className="story-close-btn" onClick={() => setSelectedUser(null)}>×</button>
            </div>

            {/* 프로필 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--surface2)", border: "3px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>🧗</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{selectedUser}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 8, padding: "6px 0" }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{userStats?.postCount ?? "-"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>게시물</div>
                  </div>
                  <div style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 8, padding: "6px 0" }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{userStats?.friendCount ?? "-"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>클친</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 팔로우 버튼 */}
            <button
              className={`btn ${isFollowing ? "btn-ghost" : "btn-primary"} btn-full`}
              style={{ marginBottom: 16 }}
              onClick={handleFollow}>
              {isFollowing ? "✓ 팔로잉" : "+ 팔로우"}
            </button>

            {/* 게시물 그리드 */}
            {userPosts.length > 0 ? (
              <div className="user-posts-grid">
                {userPosts.map(p => {
                  const thumb = p.media_urls?.[0] || p.video_url;
                  return (
                    <div key={p.id} className="user-posts-grid-item">
                      {thumb ? (
                        isVideoUrl(thumb)
                          ? <video src={thumb} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "var(--text-muted)" }}>📝</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>
                아직 게시물이 없어요
              </div>
            )}
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
