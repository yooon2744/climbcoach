import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

function isVideoUrl(url) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url);
}

export default function Main() {
  const { user, profileImg: myProfileImg } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendNames, setFriendNames] = useState([]);
  const [myHasPosts, setMyHasPosts] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [avatarMap, setAvatarMap] = useState({});
  const fileInputRef = useRef(null);
  const commentSubmittingRef = useRef({});

  useEffect(() => {
    loadFeed();
    loadFriendStories();
  }, []);

  useEffect(() => {
    if (user) {
      try {
        const saved = JSON.parse(localStorage.getItem(`likedPosts_${user.id}`) || "[]");
        setLikedPosts(new Set(saved));
      } catch {}
    }
  }, [user]);

  // 내 프로필 사진 바뀌면 avatarMap에도 즉시 반영
  useEffect(() => {
    if (myName) {
      setAvatarMap(prev => ({ ...prev, [myName]: myProfileImg || null }));
    }
  }, [myName, myProfileImg]);

  async function loadFeed() {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*, comments(*)")
      .order("created_at", { ascending: false });
    const posts = data || [];
    setFeed(posts);
    setMyHasPosts(posts.some(p => p.user_name === myName));
    setLoading(false);

    // 피드에 등장하는 모든 유저의 프로필 사진 로드
    if (posts.length) {
      const names = [...new Set([
        ...posts.map(p => p.user_name),
        ...posts.flatMap(p => (p.comments || []).map(c => c.user_name)),
      ].filter(Boolean))];
      if (names.length) {
        const { data: profs } = await supabase.from("profiles").select("user_name, avatar_url").in("user_name", names);
        const map = {};
        profs?.forEach(p => { if (p.avatar_url) map[p.user_name] = p.avatar_url; });
        setAvatarMap(prev => ({ ...prev, ...map }));
      }
    }
  }

  async function loadFriendStories() {
    const { data } = await supabase
      .from("follows")
      .select("following")
      .eq("follower", myName);
    setFriendNames((data || []).map(f => f.following));
  }

  async function handleUpload() {
    if (!description.trim() && mediaFiles.length === 0) return;
    setUploading(true);
    try {
      const media_urls = [];
      for (const file of mediaFiles) {
        const ext = file.name.split(".").pop();
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

  async function handleCommentSubmit(postId) {
    if (commentSubmittingRef.current[postId]) return;
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    commentSubmittingRef.current[postId] = true;
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    await supabase.from("comments").insert({
      post_id: postId,
      user_name: myName,
      user_emoji: "🧗",
      content: text,
    });
    commentSubmittingRef.current[postId] = false;
    loadFeed();
  }

  const allStories = [
    { user_name: myName, user_emoji: "🧗", profileImg: myProfileImg, hasPosts: myHasPosts, isMe: true },
    ...friendNames.map(name => ({
      user_name: name,
      user_emoji: "🧗",
      hasPosts: feed.some(f => f.user_name === name),
    })),
  ];

  const storyPosts = selectedStory ? feed.filter(f => f.user_name === selectedStory) : [];

  return (
    <div className="page">
      <div className="story-row">
        {allStories.map(u => (
          <div className="story-item" key={u.user_name}
            onClick={() => setSelectedStory(u.user_name)}>
            <div className={`story-ring${u.hasPosts ? "" : " story-ring-inactive"}`}>
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

      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>불러오는 중...</div>
      )}
      {!loading && feed.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          아직 게시물이 없어요 😢<br />
          <span style={{ fontSize: 12 }}>하단 + 버튼으로 첫 게시물을 올려보세요!</span>
        </div>
      )}
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
          onCommentDeleted={(postId, commentId) => setFeed(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p))}
          onCommentEdited={(postId, commentId, content) => setFeed(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.map(c => c.id === commentId ? { ...c, content } : c) } : p))}
        />
      ))}

      <button className="fab" onClick={() => setShowUploadModal(true)}>+</button>

      {/* 스토리 모달 */}
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
                  onCommentDeleted={(postId, commentId) => setFeed(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p))}
                  onCommentEdited={(postId, commentId, content) => setFeed(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.map(c => c.id === commentId ? { ...c, content } : c) } : p))}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 업로드 모달 */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowUploadModal(false); setMediaFiles([]); } }}>
          <div className="modal-sheet">
            <h3>📸 글 올리기</h3>
            <div className="form-group">
              <label>사진 / 영상 (다중 선택 가능)</label>
              <div className="media-upload-row">
                <div className="media-add-btn" onClick={() => fileInputRef.current?.click()}>
                  <span style={{ fontSize: 24 }}>+</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{mediaFiles.length}/10</span>
                </div>
                {mediaFiles.map((f, i) => (
                  <div key={i} className="media-preview-item">
                    {f.type.startsWith("video") ? (
                      <video src={URL.createObjectURL(f)} className="media-preview-thumb" />
                    ) : (
                      <img src={URL.createObjectURL(f)} alt="" className="media-preview-thumb" />
                    )}
                    <button className="media-preview-del"
                      onClick={() => setMediaFiles(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
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

function FeedCard({ item, commentValue, isLiked, onLike, onCommentChange, onCommentSubmit, myName, onCommentDeleted, onCommentEdited, avatarMap }) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const [showCommentSheet, setShowCommentSheet] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState("");

  async function handleDeleteComment(commentId) {
    await supabase.from("comments").delete().eq("id", commentId);
    onCommentDeleted?.(item.id, commentId);
  }

  async function handleSaveComment(commentId) {
    const text = editCommentContent.trim();
    if (!text) return;
    await supabase.from("comments").update({ content: text }).eq("id", commentId);
    onCommentEdited?.(item.id, commentId, text);
    setEditingCommentId(null);
  }

  const comments = item.comments || [];
  const rawUrls = item.media_urls?.length > 0 ? item.media_urls
    : item.video_url ? [item.video_url] : [];
  const mediaUrls = [...rawUrls].sort((a, b) => (isVideoUrl(b) ? 1 : 0) - (isVideoUrl(a) ? 1 : 0));
  const currentUrl = mediaUrls[mediaIdx];

  return (
    <div className="feed-card">
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

      {mediaUrls.length > 0 && (
        <div className="carousel-wrap">
          {isVideoUrl(currentUrl) ? (
            <video key={currentUrl} src={currentUrl} controls controlsList="nodownload" className="carousel-item" playsInline />
          ) : (
            <img key={currentUrl} src={currentUrl} alt="" className="carousel-item" />
          )}
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

      {item.description && (
        <div className="feed-card-body">
          <p>{item.description}</p>
        </div>
      )}

      <div className="feed-actions">
        <button className="action-btn" onClick={onLike}>{isLiked ? "❤️" : "🤍"} {item.likes}</button>
        <button className="action-btn" onClick={() => setShowCommentSheet(true)}>💬 {comments.length}</button>
      </div>

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
                  {avatarMap?.[c.user_name] ? (
                    <img src={avatarMap[c.user_name]} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 13 }}>{c.user_emoji || "🧗"}</div>
                  )}
                  <div className="comment-bubble" style={{ flex: 1 }}>
                    <div className="comment-user">{c.user_name}</div>
                    {editingCommentId === c.id ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <input
                          style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text)", fontSize: 13 }}
                          value={editCommentContent}
                          onChange={e => setEditCommentContent(e.target.value)}
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
                  {c.user_name === myName && editingCommentId !== c.id && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>수정</button>
                      <button onClick={() => handleDeleteComment(c.id)} style={{ background: "none", border: "none", color: "#e05a5a", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>삭제</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="comment-sheet-input">
              <input className="comment-input" placeholder="피드백을 달아보세요..."
                value={commentValue}
                onChange={e => onCommentChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && onCommentSubmit()} />
              <button className="send-btn" onClick={onCommentSubmit}>전송</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
