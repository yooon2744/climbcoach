import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["번개모임", "질문", "후기", "크루모집", "자유"];
const FILTERS = ["전체", ...CATEGORIES];

export default function Board() {
  const { user, profileImg: myProfileImg } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("전체");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", category: "자유", content: "" });
  const [commentCounts, setCommentCounts] = useState({});
  const [likedMeetups, setLikedMeetups] = useState(new Set());
  const [avatarMap, setAvatarMap] = useState({});

  // 상세 페이지
  const [selectedPost, setSelectedPost] = useState(null);
  const [detailComments, setDetailComments] = useState([]);
  const [detailInput, setDetailInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyContent, setEditReplyContent] = useState("");
  const submittingRef = useRef(false);
  const postSubmittingRef = useRef(false);

  useEffect(() => {
    loadPosts();
    if (user?.id) {
      try {
        const saved = JSON.parse(localStorage.getItem(`likedMeetups_${user.id}`) || "[]");
        setLikedMeetups(new Set(saved));
      } catch {}
    }
  }, [user?.id]);

  // 내 프로필 사진 바뀌면 avatarMap에 즉시 반영
  useEffect(() => {
    if (myName) {
      setAvatarMap(prev => ({ ...prev, [myName]: myProfileImg || null }));
    }
  }, [myName, myProfileImg]);

  async function loadProfiles(names) {
    if (!names.length) return;
    const { data } = await supabase.from("profiles").select("user_name, avatar_url").in("user_name", names);
    const map = {};
    data?.forEach(p => { if (p.avatar_url) map[p.user_name] = p.avatar_url; });
    setAvatarMap(prev => ({ ...prev, ...map }));
  }

  async function loadPosts() {
    setLoading(true);
    const { data } = await supabase
      .from("meetups")
      .select("*")
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);

    if (data?.length) {
      const { data: counts, error } = await supabase
        .from("meetup_comments")
        .select("meetup_id")
        .in("meetup_id", data.map(p => p.id));
      if (!error && counts) {
        const map = {};
        counts.forEach(c => { map[c.meetup_id] = (map[c.meetup_id] || 0) + 1; });
        setCommentCounts(map);
      }
      const names = [...new Set(data.map(p => p.meet_time).filter(Boolean))];
      loadProfiles(names);
    }
  }

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
      .order("created_at", { ascending: true });
    setLoadingComments(false);
    if (!error) {
      setDetailComments(data || []);
      const names = [...new Set((data || []).map(c => c.user_name).filter(Boolean))];
      loadProfiles(names);
    }
  }

  async function handleDetailComment() {
    if (submittingRef.current) return;
    const text = detailInput.trim();
    if (!text || !selectedPost) return;
    submittingRef.current = true;
    setDetailInput("");
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
    const { data } = await supabase
      .from("meetup_comments")
      .select("*")
      .eq("meetup_id", selectedPost.id)
      .order("created_at", { ascending: true });
    setDetailComments(data || []);
    setCommentCounts(prev => ({ ...prev, [selectedPost.id]: (prev[selectedPost.id] || 0) + 1 }));
    submittingRef.current = false;
  }

  async function handleDeleteReply(replyId) {
    await supabase.from("meetup_comments").delete().eq("id", replyId);
    setDetailComments(prev => prev.filter(c => c.id !== replyId));
    setCommentCounts(prev => ({ ...prev, [selectedPost.id]: Math.max(0, (prev[selectedPost.id] || 1) - 1) }));
  }

  async function handleSaveReply(replyId) {
    const text = editReplyContent.trim();
    if (!text) return;
    await supabase.from("meetup_comments").update({ content: text }).eq("id", replyId);
    setDetailComments(prev => prev.map(c => c.id === replyId ? { ...c, content: text } : c));
    setEditingReplyId(null);
  }

  async function handleMeetupLike(postId, currentLikes) {
    if (!user?.id) return;
    const isLiked = likedMeetups.has(postId);
    const newLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    const newSet = new Set(likedMeetups);
    if (isLiked) newSet.delete(postId); else newSet.add(postId);
    setLikedMeetups(newSet);
    localStorage.setItem(`likedMeetups_${user.id}`, JSON.stringify([...newSet]));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p));
    if (selectedPost?.id === postId) setSelectedPost(prev => ({ ...prev, likes: newLikes }));
    await supabase.from("meetups").update({ likes: newLikes }).eq("id", postId);
  }

  async function handlePost() {
    if (postSubmittingRef.current || !form.title.trim()) return;
    postSubmittingRef.current = true;
    try {
      await supabase.from("meetups").insert({
        gym: form.title,
        activity: form.category,
        description: form.content,
        meet_time: myName,
        max_participants: 0,
        likes: 0,
      });
      setForm({ title: "", category: "자유", content: "" });
      setShowModal(false);
      loadPosts();
    } finally {
      postSubmittingRef.current = false;
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    await supabase.from("meetups").delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id));
    if (selectedPost?.id === id) setSelectedPost(null);
  }

  const filtered = activeFilter === "전체"
    ? posts
    : posts.filter(p => p.activity === activeFilter);

  return (
    <div className="page">
      <div className="board-header">
        <h2>💬 커뮤니티</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ 글쓰기</button>
      </div>

      <div className="filter-row">
        {FILTERS.map(f => (
          <button key={f} className={`filter-chip${activeFilter === f ? " active" : ""}`}
            onClick={() => setActiveFilter(f)}>{f}</button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>불러오는 중...</div>
      )}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          게시물이 없어요 😢<br />
          <span style={{ fontSize: 12 }}>첫 글을 써보세요!</span>
        </div>
      )}

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
              {avatarMap[p.meet_time] ? (
                <img src={avatarMap[p.meet_time]} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", verticalAlign: "middle", marginRight: 4 }} />
              ) : "🧗 "}
              {p.meet_time || "익명"}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={e => { e.stopPropagation(); handleMeetupLike(p.id, p.likes || 0); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-muted)", padding: 0 }}>
                {likedMeetups.has(p.id) ? "❤️" : "🤍"} {p.likes || 0}
              </button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>💬 {commentCounts[p.id] || 0}</span>
              {p.meet_time === myName && (
                <button className="community-del-btn" onClick={e => handleDelete(p.id, e)}>삭제</button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* 게시글 상세 */}
      {selectedPost && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
          <div className="modal-sheet post-detail-sheet">
            <div className="post-detail-header">
              <span className="community-category-chip">{selectedPost.activity || "자유"}</span>
              <button className="story-close-btn" onClick={() => setSelectedPost(null)}>×</button>
            </div>

            <h3 className="post-detail-title">{selectedPost.gym}</h3>
            {selectedPost.description && (
              <p className="post-detail-body">{selectedPost.description}</p>
            )}
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

            {/* 좋아요 */}
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
                      {avatarMap[c.user_name] ? (
                        <img src={avatarMap[c.user_name]} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", verticalAlign: "middle", marginRight: 4 }} />
                      ) : "🧗 "}
                      {c.user_name}
                    </span>
                    {editingReplyId === c.id ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <input
                          style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text)", fontSize: 13 }}
                          value={editReplyContent}
                          onChange={e => setEditReplyContent(e.target.value)}
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
                  {c.user_name === myName && editingReplyId !== c.id && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditingReplyId(c.id); setEditReplyContent(c.content); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>수정</button>
                      <button onClick={() => handleDeleteReply(c.id)} style={{ background: "none", border: "none", color: "#e05a5a", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>삭제</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="post-detail-input-row">
              <input
                className="form-input"
                placeholder="답글 작성..."
                value={detailInput}
                onChange={e => setDetailInput(e.target.value)}
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

      {/* 글쓰기 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet">
            <h3>✏️ 글쓰기</h3>
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
