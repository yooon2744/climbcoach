import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["번개모임", "질문", "후기", "자유"];
const FILTERS = ["전체", ...CATEGORIES];

export default function Board() {
  const { user } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("전체");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", category: "자유", content: "" });
  const [openComments, setOpenComments] = useState(null);
  const [meetupComments, setMeetupComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

  useEffect(() => { loadPosts(); }, []);

  async function loadPosts() {
    setLoading(true);
    const { data } = await supabase
      .from("meetups")
      .select("*")
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  async function handlePost() {
    if (!form.title.trim()) return;
    await supabase.from("meetups").insert({
      gym: form.title,
      activity: form.category,
      description: form.content,
      meet_time: myName,
      max_participants: 0,
    });
    setForm({ title: "", category: "자유", content: "" });
    setShowModal(false);
    loadPosts();
  }

  async function handleDelete(id) {
    await supabase.from("meetups").delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id));
    if (openComments === id) setOpenComments(null);
  }

  async function loadComments(meetupId) {
    const { data } = await supabase
      .from("meetup_comments")
      .select("*")
      .eq("meetup_id", meetupId)
      .order("created_at", { ascending: true });
    setMeetupComments(prev => ({ ...prev, [meetupId]: data || [] }));
  }

  async function handleCommentSubmit(meetupId) {
    const text = commentInputs[meetupId]?.trim();
    if (!text) return;
    setCommentInputs(prev => ({ ...prev, [meetupId]: "" }));
    await supabase.from("meetup_comments").insert({
      meetup_id: meetupId,
      user_name: myName,
      content: text,
    });
    loadComments(meetupId);
  }

  function toggleComments(id) {
    if (openComments === id) {
      setOpenComments(null);
    } else {
      setOpenComments(id);
      loadComments(id);
    }
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

      {filtered.map(p => {
        const comments = meetupComments[p.id] || [];
        const isOpen = openComments === p.id;
        return (
          <div className="community-card" key={p.id}>
            <div className="community-card-top">
              <span className="community-category-chip">{p.activity || "자유"}</span>
              <span className="community-date">{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
            </div>
            <h3 className="community-title">{p.gym}</h3>
            {p.description && <p className="community-content">{p.description}</p>}
            <div className="community-footer">
              <span className="community-author">🧗 {p.meet_time || "익명"}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="community-reply-btn" onClick={() => toggleComments(p.id)}>
                  💬 {comments.length > 0 ? comments.length : "답글"}
                </button>
                {p.meet_time === myName && (
                  <button className="community-del-btn" onClick={() => handleDelete(p.id)}>삭제</button>
                )}
              </div>
            </div>

            {isOpen && (
              <div className="meetup-comments">
                {comments.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "6px 0 8px" }}>첫 답글을 달아보세요!</div>
                )}
                {comments.map(c => (
                  <div key={c.id} className="meetup-comment-item">
                    <span className="meetup-comment-user">🧗 {c.user_name}</span>
                    <span className="meetup-comment-text">{c.content}</span>
                  </div>
                ))}
                <div className="meetup-comment-input-row">
                  <input
                    className="form-input"
                    placeholder="답글 작성..."
                    value={commentInputs[p.id] || ""}
                    onChange={e => setCommentInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleCommentSubmit(p.id)}
                    style={{ fontSize: 13, padding: "6px 10px" }}
                  />
                  <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
                    onClick={() => handleCommentSubmit(p.id)}>전송</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

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
