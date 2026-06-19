// ─────────────────────────────────────────────
// Main.jsx
// 메인 피드 페이지.
//
// 주요 기능:
//   - 상단 스토리 링 (인스타그램 스타일, 클친 목록 + 나)
//     · 확인한 스토리는 회색 링(story-ring-viewed)으로 표시
//     · viewedStories: Set, localStorage에 userId 별로 저장
//   - 피드 카드 목록 (최신순, 미디어 캐러셀 + 댓글 시트)
//   - 우측 하단 FAB(+) 버튼으로 새 게시물 업로드
//   - avatarMap: 피드에 등장하는 모든 유저의 프로필 사진을 Map으로 관리
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// URL이 영상 파일인지 판별 (캐러셀에서 <video> vs <img> 결정)
function isVideoUrl(url) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url);
}

export default function Main() {
  const { user, profileImg: myProfileImg } = useAuth();
  // 닉네임: Google 계정이면 user_metadata.name, 이메일이면 이메일 앞부분
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  // ── 상태 정의 ─────────────────────────────────────────────────────
  const [feed, setFeed] = useState([]);                    // 전체 피드 게시물 목록
  const [loading, setLoading] = useState(true);            // 피드 로딩 여부
  const [friendNames, setFriendNames] = useState([]);      // 내가 팔로우 중인 유저 이름 목록
  const [myHasPosts, setMyHasPosts] = useState(false);     // 내 게시물 존재 여부 (스토리 링 활성화용)
  const [selectedStory, setSelectedStory] = useState(null); // 클릭한 스토리 유저명
  const [commentInputs, setCommentInputs] = useState({});  // 게시물ID → 댓글 입력값
  const [likedPosts, setLikedPosts] = useState(new Set()); // 좋아요 누른 게시물 ID Set
  const [showUploadModal, setShowUploadModal] = useState(false); // 업로드 모달 표시 여부
  const [description, setDescription] = useState("");      // 업로드 폼 - 상세 텍스트
  const [mediaFiles, setMediaFiles] = useState([]);        // 업로드 폼 - 첨부 파일 목록
  const [uploading, setUploading] = useState(false);       // 업로드 진행 중 여부
  const [avatarMap, setAvatarMap] = useState({});          // 유저명 → 프로필 사진 URL
  const [viewedStories, setViewedStories] = useState(new Set()); // 확인한 스토리 유저명 Set
  const fileInputRef = useRef(null);          // 파일 선택 input 참조
  const commentSubmittingRef = useRef({});    // 댓글 중복 제출 방지 (게시물ID → boolean)

  // ── 초기 로드 ─────────────────────────────────────────────────────
  useEffect(() => {
    loadFeed();        // 피드 데이터 불러오기
    loadFriendStories(); // 내 팔로잉 목록 불러오기
  }, []);

  // 로그인한 유저의 좋아요 기록 복원 (localStorage 기반)
  useEffect(() => {
    if (user) {
      try {
        const saved = JSON.parse(localStorage.getItem(`likedPosts_${user.id}`) || "[]");
        setLikedPosts(new Set(saved));
      } catch {}
    }
  }, [user]);

  // 로그인한 유저의 스토리 확인 기록 복원 (localStorage 기반)
  // user.id가 바뀔 때만 실행 (계정 전환 시)
  useEffect(() => {
    if (user?.id) {
      try {
        const saved = JSON.parse(localStorage.getItem(`viewedStories_${user.id}`) || "[]");
        setViewedStories(new Set(saved));
      } catch {}
    }
  }, [user?.id]);

  // ── 스토리 클릭 처리 ──────────────────────────────────────────────
  // 클릭하면 해당 유저의 스토리 모달을 열고,
  // viewedStories Set과 localStorage에 '확인 완료' 기록을 남긴다.
  function handleStoryClick(userName) {
    setSelectedStory(userName);
    if (user?.id) {
      const newSet = new Set(viewedStories);
      newSet.add(userName);
      setViewedStories(newSet);
      localStorage.setItem(`viewedStories_${user.id}`, JSON.stringify([...newSet]));
    }
  }

  // 내 프로필 사진이 바뀌면 avatarMap에도 즉시 반영
  // (useEffect 안에서만 setState 호출해야 렌더 루프가 없음)
  useEffect(() => {
    if (myName) {
      setAvatarMap(prev => ({ ...prev, [myName]: myProfileImg || null }));
    }
  }, [myName, myProfileImg]);

  // ── 피드 불러오기 ─────────────────────────────────────────────────
  // posts 테이블과 그에 연결된 comments를 JOIN해서 가져온다.
  // 불러온 후 등장하는 모든 유저의 프로필 사진도 한 번에 로드한다.
  async function loadFeed() {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*, comments(*)")
      .order("created_at", { ascending: false });
    const posts = data || [];
    setFeed(posts);
    setMyHasPosts(posts.some(p => p.user_name === myName)); // 내 게시물 있으면 스토리 링 활성화
    setLoading(false);

    // 피드에 등장하는 모든 유저 이름 수집 (게시물 작성자 + 댓글 작성자)
    if (posts.length) {
      const names = [...new Set([
        ...posts.map(p => p.user_name),
        ...posts.flatMap(p => (p.comments || []).map(c => c.user_name)),
      ].filter(Boolean))];
      if (names.length) {
        const { data: profs } = await supabase.from("profiles").select("user_name, avatar_url").in("user_name", names);
        const map = {};
        profs?.forEach(p => { if (p.avatar_url) map[p.user_name] = p.avatar_url; });
        // 기존 avatarMap과 merge (내 사진 등 이미 있는 것은 유지)
        setAvatarMap(prev => ({ ...prev, ...map }));
      }
    }
  }

  // ── 내 팔로잉 목록 불러오기 ───────────────────────────────────────
  // 상단 스토리 링에 내가 팔로우 중인 유저를 나열하기 위해 사용.
  async function loadFriendStories() {
    const { data } = await supabase
      .from("follows")
      .select("following")
      .eq("follower", myName);
    setFriendNames((data || []).map(f => f.following));
  }

  // ── 미디어 업로드 + 게시물 등록 ──────────────────────────────────
  // 1. 선택한 파일들을 Supabase Storage "Videos" 버킷에 하나씩 업로드
  // 2. 업로드된 URL 목록을 posts 테이블에 저장
  async function handleUpload() {
    if (!description.trim() && mediaFiles.length === 0) return;
    setUploading(true);
    try {
      const media_urls = [];
      for (const file of mediaFiles) {
        const ext = file.name.split(".").pop();
        // 파일명 충돌 방지를 위해 timestamp + 랜덤 문자열 사용
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("Videos")
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw new Error(`파일 업로드 실패: ${uploadError.message}`);
        const { data: { publicUrl } } = supabase.storage.from("Videos").getPublicUrl(fileName);
        media_urls.push(publicUrl);
      }
      const { error: insertError } = await supabase.from("posts").insert({
        user_name: myName,
        user_id: user.id,
        user_emoji: "🧗",
        grade: "",
        type: "post",
        description,
        likes: 0,
        media_urls,
      });
      if (insertError) throw new Error(`게시물 저장 실패: ${insertError.message}`);
      // 업로드 완료 후 폼 초기화 및 피드 새로고침
      setDescription("");
      setMediaFiles([]);
      setShowUploadModal(false);
      loadFeed();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  }

  // ── 좋아요 토글 ───────────────────────────────────────────────────
  // localStorage에 상태 저장 후 DB에도 업데이트.
  // 낙관적 업데이트(UI 먼저 변경)로 반응성을 높임.
  async function handleLike(postId, currentLikes) {
    const isLiked = likedPosts.has(postId);
    const newLikes = Math.max(0, isLiked ? currentLikes - 1 : currentLikes + 1);
    const newSet = new Set(likedPosts);
    if (isLiked) newSet.delete(postId); else newSet.add(postId);
    setLikedPosts(newSet);
    localStorage.setItem(`likedPosts_${user?.id}`, JSON.stringify([...newSet]));
    await supabase.from("posts").update({ likes: newLikes }).eq("id", postId);
    setFeed(prev => prev.map(f => f.id === postId ? { ...f, likes: newLikes } : f));
  }

  // ── 댓글 등록 ─────────────────────────────────────────────────────
  // commentSubmittingRef로 같은 게시물에 댓글이 중복 제출되지 않도록 막는다.
  // (한글 Enter 이벤트 두 번 발화 문제도 방지)
  async function handleCommentSubmit(postId) {
    if (commentSubmittingRef.current[postId]) return; // 이미 처리 중이면 무시
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    commentSubmittingRef.current[postId] = true;
    setCommentInputs(prev => ({ ...prev, [postId]: "" })); // 입력창 즉시 비우기
    await supabase.from("comments").insert({
      post_id: postId,
      user_name: myName,
      user_emoji: "🧗",
      content: text,
    });
    commentSubmittingRef.current[postId] = false;
    loadFeed(); // 댓글 카운트 등 최신 반영
  }

  // ── 스토리 링 목록 구성 ───────────────────────────────────────────
  // 첫 번째: 나 (내 게시물이 있으면 링 활성화)
  // 이후: 내가 팔로우 중인 유저들
  const allStories = [
    { user_name: myName, user_emoji: "🧗", profileImg: myProfileImg, hasPosts: myHasPosts, isMe: true },
    ...friendNames.map(name => ({
      user_name: name,
      user_emoji: "🧗",
      hasPosts: feed.some(f => f.user_name === name), // 해당 유저가 게시물이 있으면 링 활성화
    })),
  ];

  // 선택된 스토리 유저의 게시물 목록 (모달에 표시)
  const storyPosts = selectedStory ? feed.filter(f => f.user_name === selectedStory) : [];

  return (
    <div className="page">
      {/* ── 상단 스토리 링 영역 ── */}
      <div className="story-row">
        {allStories.map(u => (
          <div className="story-item" key={u.user_name}
            onClick={() => handleStoryClick(u.user_name)}>
            <div className={
              // story-ring-inactive: 게시물 없음 (링 비활성)
              // story-ring-viewed: 내 스토리 아닌데 이미 확인함 (회색 링)
              // 기본: 주황 링 (게시물 있고 미확인)
              `story-ring${!u.hasPosts ? " story-ring-inactive" : !u.isMe && viewedStories.has(u.user_name) ? " story-ring-viewed" : ""}`
            }>
              {/* 프로필 사진 있으면 사진, 없으면 이모지 */}
              {avatarMap[u.user_name] ? (
                <img src={avatarMap[u.user_name]} alt="" className="story-avatar story-avatar-photo" />
              ) : (
                <div className="story-avatar">{u.user_emoji}</div>
              )}
            </div>
            <span className="story-name">{u.isMe ? myName : u.user_name}</span>
          </div>
        ))}
      </div>

      <p className="section-title">최근 피드</p>

      {/* 로딩 / 빈 상태 */}
      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>불러오는 중...</div>
      )}
      {!loading && feed.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          아직 게시물이 없어요 😢<br />
          <span style={{ fontSize: 12 }}>하단 + 버튼으로 첫 게시물을 올려보세요!</span>
        </div>
      )}

      {/* 피드 카드 목록 */}
      {feed.map(item => (
        <FeedCard
          key={item.id}
          item={item}
          isLiked={likedPosts.has(item.id)}
          commentValue={commentInputs[item.id] || ""}
          onLike={() => handleLike(item.id, item.likes)}
          onCommentChange={v => setCommentInputs(prev => ({ ...prev, [item.id]: v }))}
          onCommentSubmit={() => handleCommentSubmit(item.id)}
          myName={myName}
          avatarMap={avatarMap}
          onCommentDeleted={(postId, commentId) => setFeed(prev => prev.map(p =>
            p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p
          ))}
          onCommentEdited={(postId, commentId, content) => setFeed(prev => prev.map(p =>
            p.id === postId ? { ...p, comments: p.comments.map(c => c.id === commentId ? { ...c, content } : c) } : p
          ))}
        />
      ))}

      {/* 새 게시물 업로드 버튼 (우측 하단 플로팅) */}
      <button className="fab" onClick={() => setShowUploadModal(true)}>+</button>

      {/* ── 스토리 모달: 선택한 유저의 게시물 목록 표시 ── */}
      {selectedStory && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedStory(null); }}>
          <div className="modal-sheet story-modal">
            <div className="story-modal-header">
              <div className="story-modal-user">
                <div className="story-ring" style={{ transform: "scale(0.72)" }}>
                  {avatarMap[selectedStory] ? (
                    <img src={avatarMap[selectedStory]} alt="" className="story-avatar story-avatar-photo" />
                  ) : (
                    <div className="story-avatar">🧗</div>
                  )}
                </div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedStory}</span>
              </div>
              <button className="story-close-btn" onClick={() => setSelectedStory(null)}>×</button>
            </div>
            <div className="story-modal-body">
              {storyPosts.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>게시물이 없어요</div>
              )}
              {storyPosts.map(item => (
                <FeedCard key={item.id} item={item}
                  isLiked={likedPosts.has(item.id)}
                  commentValue={commentInputs[item.id] || ""}
                  onLike={() => handleLike(item.id, item.likes)}
                  onCommentChange={v => setCommentInputs(prev => ({ ...prev, [item.id]: v }))}
                  onCommentSubmit={() => handleCommentSubmit(item.id)}
                  myName={myName}
                  userId={user?.id}
                  avatarMap={avatarMap}
                  onCommentDeleted={(postId, commentId) => setFeed(prev => prev.map(p =>
                    p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p
                  ))}
                  onCommentEdited={(postId, commentId, content) => setFeed(prev => prev.map(p =>
                    p.id === postId ? { ...p, comments: p.comments.map(c => c.id === commentId ? { ...c, content } : c) } : p
                  ))}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 업로드 모달 ── */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowUploadModal(false); setMediaFiles([]); } }}>
          <div className="modal-sheet">
            <h3>📸 글 올리기</h3>
            <div className="form-group">
              <label>사진 / 영상 (다중 선택 가능)</label>
              <div className="media-upload-row">
                {/* + 버튼으로 파일 추가 */}
                <div className="media-add-btn" onClick={() => fileInputRef.current?.click()}>
                  <span style={{ fontSize: 24 }}>+</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{mediaFiles.length}/10</span>
                </div>
                {/* 선택된 파일 미리보기 */}
                {mediaFiles.map((f, i) => (
                  <div key={i} className="media-preview-item">
                    {f.type.startsWith("video") ? (
                      <video src={URL.createObjectURL(f)} className="media-preview-thumb" />
                    ) : (
                      <img src={URL.createObjectURL(f)} alt="" className="media-preview-thumb" />
                    )}
                    {/* 미리보기 × 버튼으로 파일 제거 */}
                    <button className="media-preview-del"
                      onClick={() => setMediaFiles(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
              {/* 실제 file input은 숨기고 위의 버튼으로 트리거 */}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple
                style={{ display: "none" }}
                onChange={e => setMediaFiles(prev => [...prev, ...Array.from(e.target.files)].slice(0, 10))} />
            </div>
            <div className="form-group">
              <label>상세</label>
              <textarea className="form-input" rows={3}
                placeholder="어떤 동작이 어려웠나요? 피드백을 요청해보세요"
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ resize: "none" }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowUploadModal(false); setMediaFiles([]); }}>취소</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? "업로드 중..." : "올리기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FeedCard 컴포넌트
// 피드 게시물 한 개를 표시.
//
// - 미디어 캐러셀 (이미지/영상, 좌우 화살표 + 인디케이터)
// - 좋아요 + 댓글 수 버튼
// - 댓글 시트 (하단 슬라이드업 모달)
//   · 내 댓글: 수정/삭제 버튼 표시
// ─────────────────────────────────────────────
function FeedCard({ item, commentValue, isLiked, onLike, onCommentChange, onCommentSubmit, myName, onCommentDeleted, onCommentEdited, avatarMap }) {
  const [mediaIdx, setMediaIdx] = useState(0);              // 현재 캐러셀 인덱스
  const [showCommentSheet, setShowCommentSheet] = useState(false); // 댓글 시트 표시 여부
  const [editingCommentId, setEditingCommentId] = useState(null);  // 수정 중인 댓글 ID
  const [editCommentContent, setEditCommentContent] = useState(""); // 수정 중인 댓글 내용

  // 댓글 삭제
  async function handleDeleteComment(commentId) {
    await supabase.from("comments").delete().eq("id", commentId);
    onCommentDeleted?.(item.id, commentId); // 부모 컴포넌트의 feed state 즉시 업데이트
  }

  // 댓글 수정 저장
  async function handleSaveComment(commentId) {
    const text = editCommentContent.trim();
    if (!text) return;
    await supabase.from("comments").update({ content: text }).eq("id", commentId);
    onCommentEdited?.(item.id, commentId, text); // 부모 컴포넌트의 feed state 즉시 업데이트
    setEditingCommentId(null);
  }

  const comments = item.comments || [];

  // media_urls 없으면 하위 호환성을 위해 video_url도 사용
  const rawUrls = item.media_urls?.length > 0 ? item.media_urls
    : item.video_url ? [item.video_url] : [];
  // 영상을 먼저 보여주기 위해 정렬 (영상이 뒤로 밀리면 첫 화면에 이미지만 나오는 경우 방지)
  const mediaUrls = [...rawUrls].sort((a, b) => (isVideoUrl(b) ? 1 : 0) - (isVideoUrl(a) ? 1 : 0));
  const currentUrl = mediaUrls[mediaIdx]; // 현재 표시 중인 미디어 URL

  return (
    <div className="feed-card">
      {/* 게시물 헤더: 프로필 사진 + 닉네임 + 날짜 */}
      <div className="feed-card-header">
        {avatarMap?.[item.user_name] ? (
          <img src={avatarMap[item.user_name]} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div className="avatar" style={{ width: 36, height: 36, fontSize: 16 }}>{item.user_emoji || "🧗"}</div>
        )}
        <div className="user-info">
          <h4>{item.user_name}</h4>
          <span>{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
      </div>

      {/* 미디어 캐러셀 (이미지 or 영상) */}
      {mediaUrls.length > 0 && (
        <div className="carousel-wrap">
          {isVideoUrl(currentUrl) ? (
            <video key={currentUrl} src={currentUrl} controls controlsList="nodownload" className="carousel-item" playsInline />
          ) : (
            <img key={currentUrl} src={currentUrl} alt="" className="carousel-item" />
          )}
          {/* 미디어가 2개 이상이면 좌우 화살표 + 인디케이터 표시 */}
          {mediaUrls.length > 1 && (
            <>
              {mediaIdx > 0 && (
                <button className="carousel-btn carousel-left" onClick={() => setMediaIdx(i => i - 1)}>‹</button>
              )}
              {mediaIdx < mediaUrls.length - 1 && (
                <button className="carousel-btn carousel-right" onClick={() => setMediaIdx(i => i + 1)}>›</button>
              )}
              <div className="carousel-dots">
                {mediaUrls.map((_, i) => (
                  <div key={i} className={`carousel-dot${i === mediaIdx ? " active" : ""}`}
                    onClick={() => setMediaIdx(i)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 본문 설명 */}
      {item.description && (
        <div className="feed-card-body">
          <p>{item.description}</p>
        </div>
      )}

      {/* 좋아요 / 댓글 버튼 */}
      <div className="feed-actions">
        <button className="action-btn" onClick={onLike}>{isLiked ? "❤️" : "🤍"} {item.likes}</button>
        <button className="action-btn" onClick={() => setShowCommentSheet(true)}>💬 {comments.length}</button>
      </div>

      {/* ── 댓글 시트 (하단 슬라이드업 모달) ── */}
      {showCommentSheet && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCommentSheet(false); }}>
          <div className="modal-sheet comment-sheet">
            <div className="comment-sheet-handle" />
            <div className="comment-sheet-header">
              <span>댓글 {comments.length}개</span>
              <button className="story-close-btn" onClick={() => setShowCommentSheet(false)}>×</button>
            </div>
            <div className="comment-sheet-body">
              {comments.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0", fontSize: 13 }}>
                  첫 댓글을 달아보세요!
                </div>
              )}
              {comments.map(c => (
                <div className="comment" key={c.id}>
                  {/* 댓글 작성자 프로필 사진 */}
                  {avatarMap?.[c.user_name] ? (
                    <img src={avatarMap[c.user_name]} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 13 }}>{c.user_emoji || "🧗"}</div>
                  )}
                  <div className="comment-bubble" style={{ flex: 1 }}>
                    <div className="comment-user">{c.user_name}</div>
                    {/* 수정 모드일 때 inline 편집 UI 표시 */}
                    {editingCommentId === c.id ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <input
                          style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text)", fontSize: 13 }}
                          value={editCommentContent}
                          onChange={e => setEditCommentContent(e.target.value)}
                          // 한글 조합 완료 후에만 저장 (isComposing 체크)
                          onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleSaveComment(c.id)}
                          autoFocus
                        />
                        <button onClick={() => handleSaveComment(c.id)} style={{ background: "var(--accent)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>저장</button>
                        <button onClick={() => setEditingCommentId(null)} style={{ background: "var(--surface2)", border: "none", color: "var(--text-muted)", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>취소</button>
                      </div>
                    ) : (
                      <p>{c.content}</p>
                    )}
                  </div>
                  {/* 내 댓글만 수정/삭제 버튼 표시 */}
                  {c.user_name === myName && editingCommentId !== c.id && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>수정</button>
                      <button onClick={() => handleDeleteComment(c.id)} style={{ background: "none", border: "none", color: "#e05a5a", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>삭제</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* 댓글 입력창 */}
            <div className="comment-sheet-input">
              <input className="comment-input" placeholder="피드백을 달아보세요..."
                value={commentValue}
                onChange={e => onCommentChange(e.target.value)}
                // 한글 조합 완료 후에만 제출 (isComposing 체크)
                onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && onCommentSubmit()} />
              <button className="send-btn" onClick={onCommentSubmit}>전송</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
