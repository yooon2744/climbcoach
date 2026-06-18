import { useState, useEffect, useRef } from "react";
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
  const [commentCounts, setCommentCounts] = useState({});

  // 상세 페이지
  const [selectedPost, setSelectedPost] = useState(null);
  const [detailComments, setDetailComments] = useState([]);
  const [detailInput, setDetailInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => { loadPosts(); }, []);

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
    }
  }

  async function openPost(post) {
    setSelectedPost(post);
    setDetailComments([]);
    setDetailInput("");
    setLoadingComments(true);
    const { data, error } = await supabase
      .from("meetup_comments")
      .select("*")
      .eq("meetup_id", post.id)
      .order("created_at", { ascending: true });
    setLoadingComments(false);
    if (!error) setDetailComments(data || []);
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
      alert(
        "답글 테이블이 없어요.\nSupabase SQL Editor에서 아래 SQL을 실행해주세요:\n\n" +
        "CREATE TABLE meetup_comments (\n" +
        "  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n" +
        "  meetup_id UUID NOT NULL,\n" +
        "  user_name TEXT NOT NULL,\n" +
        "  content TEXT NOT NULL,\n" +
        "  created_at TIMESTAMPTZ DEFAULT NOW()\n" +
        ");\n" +
        "ALTER TABLE meetup_comments DISABLE ROW LEVEL SECURITY;"
      );
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
            <span className="community-author">🧗 {p.meet_time || "익명"}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                💬 {commentCounts[p.id] || 0}
              </span>
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
              🧗 {selectedPost.meet_time || "익명"} · {new Date(selectedPost.created_at).toLocaleDateString("ko-KR")}
              {selectedPost.meet_time === myName && (
                <button className="community-del-btn" style={{ marginLeft: 8 }}
                  onClick={e => handleDelete(selectedPost.id, e)}>삭제</button>
              )}
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
                <div key={c.id} className="meetup-comment-item">
                  <span className="meetup-comment-user">🧗 {c.user_name}</span>
                  <span className="meetup-comment-text">{c.content}</span>
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
