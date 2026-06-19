// ─────────────────────────────────────────────
// Board.jsx
// 커뮤니티 게시판 페이지.
//
// 주요 기능:
//   - 카테고리 필터 (번개모임/질문/후기/크루모집/자유/전체)
//   - 글쓰기 모달 (카테고리 선택 + 제목 + 내용)
//   - 게시글 상세 모달 (좋아요 + 답글)
//   - 내 글 삭제
//   - avatarMap: 게시글/댓글 작성자 프로필 사진 관리
//
// DB 구조:
//   meetups 테이블: gym=제목, activity=카테고리, description=내용,
//                   meet_time=작성자 닉네임, likes=좋아요 수
//   meetup_comments 테이블: meetup_id, user_name, content
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// 게시판 카테고리 목록 (글쓰기 폼 + 필터 칩에 사용)
const CATEGORIES = ["번개모임", "질문", "후기", "크루모집", "자유"];
// 필터 칩에는 "전체"가 맨 앞에 추가됨
const FILTERS = ["전체", ...CATEGORIES];

export default function Board() {
  const { user, profileImg: myProfileImg } = useAuth();
  // 닉네임: Google 계정이면 user_metadata.name, 이메일이면 이메일 앞부분
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  // ── 상태 정의 ─────────────────────────────────────────────────────
  const [posts, setPosts] = useState([]);                    // 전체 게시글 목록
  const [loading, setLoading] = useState(true);              // 목록 로딩 여부
  const [activeFilter, setActiveFilter] = useState("전체"); // 현재 선택된 카테고리 필터
  const [showModal, setShowModal] = useState(false);         // 글쓰기 모달 표시 여부
  const [form, setForm] = useState({ title: "", category: "자유", content: "" }); // 글쓰기 폼 상태
  const [commentCounts, setCommentCounts] = useState({});    // 게시글ID → 댓글 수
  const [likedMeetups, setLikedMeetups] = useState(new Set()); // 좋아요 누른 게시글 ID Set
  const [avatarMap, setAvatarMap] = useState({});            // 유저명 → 프로필 사진 URL

  // 상세 보기 상태
  const [selectedPost, setSelectedPost] = useState(null);    // 선택된 게시글 (상세 모달)
  const [detailComments, setDetailComments] = useState([]);  // 상세 모달의 답글 목록
  const [detailInput, setDetailInput] = useState("");        // 답글 입력값
  const [loadingComments, setLoadingComments] = useState(false); // 답글 로딩 여부
  const [editingReplyId, setEditingReplyId] = useState(null); // 수정 중인 답글 ID
  const [editReplyContent, setEditReplyContent] = useState(""); // 수정 중인 답글 내용

  // 중복 제출 방지 ref (React state와 달리 렌더 없이 즉시 변경됨)
  const submittingRef = useRef(false);      // 답글 중복 제출 방지
  const postSubmittingRef = useRef(false);  // 게시글 중복 제출 방지

  // ── 초기 로드 ─────────────────────────────────────────────────────
  useEffect(() => {
    loadPosts();
    // 로그인된 유저의 좋아요 기록을 localStorage에서 복원
    if (user?.id) {
      try {
        const saved = JSON.parse(localStorage.getItem(`likedMeetups_${user.id}`) || "[]");
        setLikedMeetups(new Set(saved));
      } catch {}
    }
  }, [user?.id]);

  // 내 프로필 사진이 바뀌면 avatarMap에도 즉시 반영
  useEffect(() => {
    if (myName) {
      setAvatarMap(prev => ({ ...prev, [myName]: myProfileImg || null }));
    }
  }, [myName, myProfileImg]);

  // ── 유저 프로필 사진 로드 ─────────────────────────────────────────
  // 게시글 목록이나 댓글 목록에 등장하는 유저명으로 profiles 조회
  async function loadProfiles(names) {
    if (!names.length) return;
    const { data } = await supabase.from("profiles").select("user_name, avatar_url").in("user_name", names);
    const map = {};
    data?.forEach(p => { if (p.avatar_url) map[p.user_name] = p.avatar_url; });
    setAvatarMap(prev => ({ ...prev, ...map })); // 기존 map과 merge
  }

  // ── 게시글 목록 불러오기 ──────────────────────────────────────────
  // 1. meetups 테이블 전체 불러오기 (최신순)
  // 2. meetup_comments에서 게시글 ID별 댓글 수 집계
  // 3. 게시글 작성자 프로필 사진 로드
  async function loadPosts() {
    setLoading(true);
    const { data } = await supabase
      .from("meetups")
      .select("*")
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);

    if (data?.length) {
      // 댓글 수 집계: 한 번의 쿼리로 모든 게시글의 댓글 수를 가져옴
      const { data: counts, error } = await supabase
        .from("meetup_comments")
        .select("meetup_id")
        .in("meetup_id", data.map(p => p.id));
      if (!error && counts) {
        const map = {};
        counts.forEach(c => { map[c.meetup_id] = (map[c.meetup_id] || 0) + 1; });
        setCommentCounts(map);
      }
      // meet_time 컬럼이 작성자 닉네임으로 사용됨 (DB 컬럼명과 의미가 다름에 주의)
      const names = [...new Set(data.map(p => p.meet_time).filter(Boolean))];
      loadProfiles(names);
    }
  }

  // ── 게시글 상세 열기 ─────────────────────────────────────────────
  // 게시글 카드 클릭 시 호출. 해당 게시글의 답글을 불러온다.
  async function openPost(post) {
    setSelectedPost(post);
    setDetailComments([]);
    setDetailInput("");
    setEditingReplyId(null);
    setLoadingComments(true);
    const { data, error } = await supabase
      .from("meetup_comments")
      .select("*")
      .eq("meetup_id", post.id)
      .order("created_at", { ascending: true }); // 오래된 답글이 위로
    setLoadingComments(false);
    if (!error) {
      setDetailComments(data || []);
      // 답글 작성자들의 프로필 사진도 로드
      const names = [...new Set((data || []).map(c => c.user_name).filter(Boolean))];
      loadProfiles(names);
    }
  }

  // ── 답글 등록 ─────────────────────────────────────────────────────
  // submittingRef로 중복 제출을 막는다.
  // (한글 입력 중 Enter 두 번 발화, 또는 빠른 연속 클릭 방지)
  async function handleDetailComment() {
    if (submittingRef.current) return; // 이미 처리 중이면 무시
    const text = detailInput.trim();
    if (!text || !selectedPost) return;
    submittingRef.current = true;
    setDetailInput(""); // 입력창 즉시 비우기 (UX: 입력이 됐다는 피드백)
    const { error } = await supabase.from("meetup_comments").insert({
      meetup_id: selectedPost.id,
      user_name: myName,
      content: text,
    });
    if (error) {
      submittingRef.current = false;
      alert("답글 저장 실패: " + error.message);
      return;
    }
    // 등록 후 최신 답글 목록 다시 불러오기
    const { data } = await supabase
      .from("meetup_comments")
      .select("*")
      .eq("meetup_id", selectedPost.id)
      .order("created_at", { ascending: true });
    setDetailComments(data || []);
    // 목록 카드의 댓글 수도 즉시 업데이트 (피드 새로고침 없이)
    setCommentCounts(prev => ({ ...prev, [selectedPost.id]: (prev[selectedPost.id] || 0) + 1 }));
    submittingRef.current = false;
  }

  // ── 답글 삭제 ─────────────────────────────────────────────────────
  async function handleDeleteReply(replyId) {
    await supabase.from("meetup_comments").delete().eq("id", replyId);
    setDetailComments(prev => prev.filter(c => c.id !== replyId)); // 목록에서 즉시 제거
    setCommentCounts(prev => ({ ...prev, [selectedPost.id]: Math.max(0, (prev[selectedPost.id] || 1) - 1) }));
  }

  // ── 답글 수정 저장 ────────────────────────────────────────────────
  async function handleSaveReply(replyId) {
    const text = editReplyContent.trim();
    if (!text) return;
    await supabase.from("meetup_comments").update({ content: text }).eq("id", replyId);
    setDetailComments(prev => prev.map(c => c.id === replyId ? { ...c, content: text } : c));
    setEditingReplyId(null); // 수정 모드 종료
  }

  // ── 게시글 좋아요 토글 ────────────────────────────────────────────
  // localStorage에 기록하고, 낙관적 업데이트로 UI를 먼저 변경 후 DB 반영
  async function handleMeetupLike(postId, currentLikes) {
    if (!user?.id) return;
    const isLiked = likedMeetups.has(postId);
    const newLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    const newSet = new Set(likedMeetups);
    if (isLiked) newSet.delete(postId); else newSet.add(postId);
    setLikedMeetups(newSet);
    localStorage.setItem(`likedMeetups_${user.id}`, JSON.stringify([...newSet]));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p)); // 목록 카드 즉시 업데이트
    if (selectedPost?.id === postId) setSelectedPost(prev => ({ ...prev, likes: newLikes })); // 상세 모달도 즉시 업데이트
    await supabase.from("meetups").update({ likes: newLikes }).eq("id", postId);
  }

  // ── 게시글 등록 ───────────────────────────────────────────────────
  // postSubmittingRef로 중복 제출 방지.
  // meetups 테이블의 컬럼 구조:
  //   gym = 제목, activity = 카테고리, description = 내용, meet_time = 작성자 닉네임
  async function handlePost() {
    if (postSubmittingRef.current || !form.title.trim()) return;
    postSubmittingRef.current = true;
    try {
      await supabase.from("meetups").insert({
        gym: form.title,
        activity: form.category,
        description: form.content,
        meet_time: myName,    // 작성자 닉네임 (meet_time 컬럼을 작성자로 재사용)
        max_participants: 0,
        likes: 0,
      });
      setForm({ title: "", category: "자유", content: "" }); // 폼 초기화
      setShowModal(false);
      loadPosts(); // 목록 새로고침
    } finally {
      postSubmittingRef.current = false;
    }
  }

  // ── 게시글 삭제 ───────────────────────────────────────────────────
  // e.stopPropagation()으로 카드 클릭(상세 열기)이 함께 발생하지 않도록 막음
  async function handleDelete(id, e) {
    e.stopPropagation();
    await supabase.from("meetups").delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id)); // 목록에서 즉시 제거
    if (selectedPost?.id === id) setSelectedPost(null); // 상세 모달도 닫기
  }

  // 카테고리 필터 적용 (전체면 필터 없음)
  const filtered = activeFilter === "전체"
    ? posts
    : posts.filter(p => p.activity === activeFilter);

  return (
    <div className="page">
      {/* 헤더: 타이틀 + 글쓰기 버튼 */}
      <div className="board-header">
        <h2>💬 커뮤니티</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ 글쓰기</button>
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="filter-row">
        {FILTERS.map(f => (
          <button key={f} className={`filter-chip${activeFilter === f ? " active" : ""}`}
            onClick={() => setActiveFilter(f)}>{f}</button>
        ))}
      </div>

      {/* 로딩 / 빈 상태 */}
      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>불러오는 중...</div>
      )}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          게시물이 없어요 😢<br />
          <span style={{ fontSize: 12 }}>첫 글을 써보세요!</span>
        </div>
      )}

      {/* 게시글 카드 목록 */}
      {filtered.map(p => (
        <div className="community-card" key={p.id} onClick={() => openPost(p)}>
          <div className="community-card-top">
            <span className="community-category-chip">{p.activity || "자유"}</span>
            <span className="community-date">{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
          </div>
          <h3 className="community-title">{p.gym}</h3>
          {p.description && <p className="community-content">{p.description}</p>}
          <div className="community-footer">
            <span className="community-author">
              {/* 작성자 프로필 사진 (있으면 사진, 없으면 이모지) */}
              {avatarMap[p.meet_time] ? (
                <img src={avatarMap[p.meet_time]} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", verticalAlign: "middle", marginRight: 4 }} />
              ) : "🧗 "}
              {p.meet_time || "익명"}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* 좋아요 버튼: e.stopPropagation()으로 카드 클릭(상세 열기)과 분리 */}
              <button
                onClick={e => { e.stopPropagation(); handleMeetupLike(p.id, p.likes || 0); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-muted)", padding: 0 }}>
                {likedMeetups.has(p.id) ? "❤️" : "🤍"} {p.likes || 0}
              </button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>💬 {commentCounts[p.id] || 0}</span>
              {/* 내 글만 삭제 버튼 표시 */}
              {p.meet_time === myName && (
                <button className="community-del-btn" onClick={e => handleDelete(p.id, e)}>삭제</button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* ── 게시글 상세 모달 ── */}
      {selectedPost && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
          <div className="modal-sheet post-detail-sheet">
            {/* 상단: 카테고리 칩 + 닫기 버튼 */}
            <div className="post-detail-header">
              <span className="community-category-chip">{selectedPost.activity || "자유"}</span>
              <button className="story-close-btn" onClick={() => setSelectedPost(null)}>×</button>
            </div>

            {/* 제목 + 본문 */}
            <h3 className="post-detail-title">{selectedPost.gym}</h3>
            {selectedPost.description && (
              <p className="post-detail-body">{selectedPost.description}</p>
            )}
            {/* 작성자 정보 + 날짜 + 내 글이면 삭제 버튼 */}
            <div className="post-detail-meta">
              {avatarMap[selectedPost.meet_time] ? (
                <img src={avatarMap[selectedPost.meet_time]} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", verticalAlign: "middle", marginRight: 4 }} />
              ) : "🧗 "}
              {selectedPost.meet_time || "익명"} · {new Date(selectedPost.created_at).toLocaleDateString("ko-KR")}
              {selectedPost.meet_time === myName && (
                <button className="community-del-btn" style={{ marginLeft: 8 }}
                  onClick={e => handleDelete(selectedPost.id, e)}>삭제</button>
              )}
            </div>

            {/* 좋아요 버튼 */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0 4px" }}>
              <button
                onClick={() => handleMeetupLike(selectedPost.id, selectedPost.likes || 0)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "var(--text)", padding: 0, fontWeight: 600 }}>
                {likedMeetups.has(selectedPost.id) ? "❤️" : "🤍"} {selectedPost.likes || 0}
              </button>
            </div>

            <div className="post-detail-divider" />

            <div className="post-detail-comment-label">
              답글 {detailComments.length}개
            </div>

            {/* 답글 목록 */}
            <div className="post-detail-comments">
              {loadingComments && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>불러오는 중...</div>
              )}
              {!loadingComments && detailComments.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
                  첫 답글을 달아보세요!
                </div>
              )}
              {detailComments.map(c => (
                <div key={c.id} className="meetup-comment-item" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <span className="meetup-comment-user">
                      {/* 답글 작성자 프로필 사진 */}
                      {avatarMap[c.user_name] ? (
                        <img src={avatarMap[c.user_name]} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", verticalAlign: "middle", marginRight: 4 }} />
                      ) : "🧗 "}
                      {c.user_name}
                    </span>
                    {/* 수정 모드일 때 inline 편집 UI */}
                    {editingReplyId === c.id ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <input
                          style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text)", fontSize: 13 }}
                          value={editReplyContent}
                          onChange={e => setEditReplyContent(e.target.value)}
                          // 한글 조합 완료 후에만 저장
                          onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleSaveReply(c.id)}
                          autoFocus
                        />
                        <button onClick={() => handleSaveReply(c.id)} style={{ background: "var(--accent)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>저장</button>
                        <button onClick={() => setEditingReplyId(null)} style={{ background: "var(--surface2)", border: "none", color: "var(--text-muted)", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>취소</button>
                      </div>
                    ) : (
                      <span className="meetup-comment-text">{c.content}</span>
                    )}
                  </div>
                  {/* 내 답글만 수정/삭제 버튼 표시 */}
                  {c.user_name === myName && editingReplyId !== c.id && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditingReplyId(c.id); setEditReplyContent(c.content); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>수정</button>
                      <button onClick={() => handleDeleteReply(c.id)} style={{ background: "none", border: "none", color: "#e05a5a", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>삭제</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 답글 입력창 */}
            <div className="post-detail-input-row">
              <input
                className="form-input"
                placeholder="답글 작성..."
                value={detailInput}
                onChange={e => setDetailInput(e.target.value)}
                // 한글 조합 완료 후에만 제출 (isComposing 체크)
                onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleDetailComment()}
                style={{ fontSize: 13, padding: "8px 12px" }}
              />
              <button className="btn btn-primary"
                style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}
                onClick={handleDetailComment}>전송</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 글쓰기 모달 ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet">
            <h3>✏️ 글쓰기</h3>
            {/* 카테고리 선택 (필터 칩과 동일한 스타일) */}
            <div className="form-group">
              <label>카테고리</label>
              <div className="category-picker">
                {CATEGORIES.map(c => (
                  <button key={c}
                    className={`filter-chip${form.category === c ? " active" : ""}`}
                    onClick={() => setForm(p => ({ ...p, category: c }))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>제목</label>
              <input className="form-input" placeholder="제목을 입력해주세요"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>내용</label>
              <textarea className="form-input" rows={4} placeholder="내용을 자유롭게 적어보세요"
                value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                style={{ resize: "none" }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handlePost}>올리기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
