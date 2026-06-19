// ─────────────────────────────────────────────
// Navbar.jsx
// 상단 네비게이션 바 + 하단 탭 바 담당
//
// 상단 바: 로고 / @아이디 검색창(클친 찾기) / 로그아웃 버튼
// 하단 탭: 커뮤니티 / 피드 / 암장찾기 / 마이
//
// 검색 흐름:
//   1. @ 아이디 입력 → 찾기 버튼 or Enter
//   2. profiles 테이블에서 user_tag 일치하는 유저 조회
//   3. 결과 패널에 프로필 카드 + 팔로우 버튼 표시
//   4. 팔로우 클릭 → follows 테이블에 (pending) 행 삽입
// ─────────────────────────────────────────────

import { NavLink } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();
  // 닉네임: Google 계정이면 user_metadata.name, 이메일 계정이면 이메일 앞부분
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  // ── 검색 관련 상태 ────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");          // 검색창 입력값
  const [searchResult, setSearchResult] = useState(null);      // 검색된 프로필 객체
  const [searchNotFound, setSearchNotFound] = useState(false); // 검색 결과 없음 여부
  const [searchLoading, setSearchLoading] = useState(false);   // 검색 중 로딩
  const [followStatus, setFollowStatus] = useState(null);      // null | 'pending' | 'accepted'
  const [showPanel, setShowPanel] = useState(false);           // 결과 패널 표시 여부
  const inputRef = useRef(null);

  // ── 마운트 시: 내 프로필을 DB에 upsert ───────────────────────────
  // 다른 유저가 @아이디 검색할 때 내 user_name을 찾을 수 있도록 보장
  useEffect(() => {
    if (myName && myName !== "나") {
      supabase.from("profiles").upsert({ user_name: myName }, { onConflict: "user_name" });
    }
  }, [myName]);

  // ── 패널 외부 클릭 시 검색 결과 패널 닫기 ────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest(".search-panel-wrap")) setShowPanel(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── @아이디 검색 실행 ─────────────────────────────────────────────
  // user_tag 컬럼에서 정확히 일치하는 유저를 찾는다 (대소문자 구분 없음).
  // 찾으면 내가 그 유저를 팔로우 중인지도 확인한다.
  async function handleSearch() {
    const tag = searchInput.trim().replace(/^@/, ""); // 앞에 @ 붙여도 처리
    if (!tag) return;
    setSearchLoading(true);
    setSearchNotFound(false);
    setSearchResult(null);
    setShowPanel(true);

    // profiles 테이블에서 user_tag로 검색
    const { data } = await supabase
      .from("profiles")
      .select("user_name, avatar_url, user_tag")
      .eq("user_tag", tag)
      .maybeSingle();

    setSearchLoading(false);

    if (!data) {
      setSearchNotFound(true); // 없는 아이디
      return;
    }
    setSearchResult(data);

    // 내가 이미 이 유저를 팔로우하고 있는지 확인
    if (data.user_name && myName && data.user_name !== myName) {
      const { data: row } = await supabase
        .from("follows")
        .select("status")
        .eq("follower", myName)
        .eq("following", data.user_name)
        .maybeSingle();
      setFollowStatus(row?.status || null); // null이면 팔로우 안 한 상태
    } else {
      setFollowStatus(null); // 내 계정 검색 시 팔로우 버튼 비활성
    }
  }

  // ── 팔로우 신청 ──────────────────────────────────────────────────
  // follows 테이블에 (pending) 행을 삽입.
  // 상대방이 클친 버튼을 눌러 수락하면 accepted로 바뀐다.
  async function handleFollow() {
    if (!searchResult || !myName || searchResult.user_name === myName) return;
    if (followStatus) return; // 이미 팔로우 중이면 중복 방지

    const { error } = await supabase.from("follows").insert({
      follower: myName,
      following: searchResult.user_name,
      status: "pending", // 수락 전 대기 상태
    });

    if (error) {
      alert("팔로우 신청 실패: " + error.message);
      return;
    }
    setFollowStatus("pending"); // 버튼을 "신청 중"으로 즉시 변경
  }

  // 팔로우 버튼 라벨 결정
  const followLabel = followStatus === "accepted" ? "팔로잉" : followStatus === "pending" ? "신청 중" : "팔로우";
  // 이미 팔로우 중이거나 자기 자신이면 버튼 비활성화
  const followDisabled = !!followStatus || !searchResult || searchResult.user_name === myName;

  return (
    <>
      {/* ── 상단 네비게이션 바 ── */}
      <nav className="topnav">
        <span className="logo" style={{ flexShrink: 0 }}>Climb<span>Coach</span></span>

        {/* 클친 찾기 검색창 - 가운데 영역 */}
        <div className="search-panel-wrap" style={{ flex: 1, margin: "0 10px", position: "relative" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              ref={inputRef}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              // 이미 결과가 있을 때 input에 포커스하면 패널 다시 표시
              onFocus={() => (searchResult || searchNotFound) && setShowPanel(true)}
              // Enter 키로 검색 (한글 조합 완료 후에만 실행)
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

          {/* 검색 결과 드롭다운 패널 */}
          {showPanel && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: 12, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}>
              {/* 검색 중 */}
              {searchLoading && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>검색 중...</div>
              )}
              {/* 결과 없음 */}
              {searchNotFound && !searchLoading && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>해당 아이디를 찾을 수 없어요</div>
              )}
              {/* 검색 결과 카드 */}
              {searchResult && !searchLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* 프로필 사진 */}
                  {searchResult.avatar_url ? (
                    <img src={searchResult.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🧗</div>
                  )}
                  {/* 닉네임 + @아이디 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{searchResult.user_name}</div>
                    <div style={{ fontSize: 12, color: "var(--accent)" }}>@{searchResult.user_tag}</div>
                  </div>
                  {/* 팔로우 버튼 (자기 자신이면 숨김) */}
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
                  {/* 자기 자신 검색 시 */}
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

      {/* ── 하단 탭 바 ── */}
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
