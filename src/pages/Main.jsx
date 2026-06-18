import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Main() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ user_name: "", grade: "", type: "fail", description: "" });

  useEffect(() => { loadFeed(); }, []);

  async function loadFeed() {
    setLoading(true);
    const { data: posts } = await supabase
      .from("posts")
      .select("*, comments(*)")
      .order("created_at", { ascending: false });
    setFeed(posts || []);
    setLoading(false);
  }

  async function handleUpload() {
    if (!uploadForm.user_name || !uploadForm.description) return;
    await supabase.from("posts").insert({
      user_name: uploadForm.user_name,
      user_emoji: "🧗",
      grade: uploadForm.grade,
      type: uploadForm.type,
      description: uploadForm.description,
      likes: 0,
    });
    setUploadForm({ user_name: "", grade: "", type: "fail", description: "" });
    setShowUploadModal(false);
    loadFeed();
  }

  async function handleLike(postId, currentLikes) {
    await supabase.from("posts").update({ likes: currentLikes + 1 }).eq("id", postId);
    setFeed(prev => prev.map(f => f.id === postId ? { ...f, likes: f.likes + 1 } : f));
  }

  async function handleCommentSubmit(postId) {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    await supabase.from("comments").insert({
      post_id: postId,
      user_name: "나",
      user_emoji: "😊",
      content: text,
    });
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    loadFeed();
  }

  return (
    <div className="page">
      <div
        className={`upload-zone${dragOver ? " drag-over" : ""}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); setShowUploadModal(true); }}
        onClick={() => setShowUploadModal(true)}
      >
        <div className="upload-icon">🎬</div>
        <h3>실패 영상을 올려보세요</h3>
        <p>클릭해서 피드백 요청 올리기 · 코치들이 댓글로 교정해줘요</p>
      </div>

      <p className="section-title">최근 피드백 요청</p>

      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
          불러오는 중...
        </div>
      )}

      {!loading && feed.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          아직 게시물이 없어요 😢<br />
          <span style={{ fontSize: 12 }}>첫 번째로 실패 영상을 올려보세요!</span>
        </div>
      )}

      {feed.map(item => (
        <FeedCard
          key={item.id}
          item={item}
          commentValue={commentInputs[item.id] || ""}
          onLike={() => handleLike(item.id, item.likes)}
          onCommentChange={v => setCommentInputs(prev => ({ ...prev, [item.id]: v }))}
          onCommentSubmit={() => handleCommentSubmit(item.id)}
        />
      ))}

      {showUploadModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUploadModal(false)}>
          <div className="modal-sheet">
            <h3>🎬 피드백 요청 올리기</h3>
            <div className="form-group">
              <label>이름 / 닉네임</label>
              <input className="form-input" placeholder="예) 홍길동" value={uploadForm.user_name}
                onChange={e => setUploadForm(p => ({ ...p, user_name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>난이도</label>
                <select className="form-input" value={uploadForm.grade}
                  onChange={e => setUploadForm(p => ({ ...p, grade: e.target.value }))}>
                  <option value="">선택</option>
                  {["V0","V1","V2","V3","V4","V5","V6","V7","V8+"].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>유형</label>
                <select className="form-input" value={uploadForm.type}
                  onChange={e => setUploadForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="fail">실패</option>
                  <option value="partial">대충 성공</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>어디가 문제인지 설명</label>
              <textarea className="form-input" rows={3}
                placeholder="예) 발 위치가 자꾸 미끄러져요. 오른발 스메어 교정 부탁해요"
                value={uploadForm.description}
                onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
                style={{ resize: "none" }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowUploadModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleUpload}>올리기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedCard({ item, commentValue, onLike, onCommentChange, onCommentSubmit }) {
  const [showComments, setShowComments] = useState(true);
  const comments = item.comments || [];

  return (
    <div className="feed-card">
      <div className="feed-card-header">
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 16 }}>{item.user_emoji}</div>
        <div className="user-info">
          <h4>{item.user_name}</h4>
          <span>{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
        <span className={`tag tag-${item.type}`}>{item.type === "fail" ? "실패" : "대충 성공"}</span>
        {item.grade && <span className="tag tag-grade" style={{ marginLeft: 4 }}>{item.grade}</span>}
      </div>

      <div className="video-thumb">
        <span className="video-label">
          <span className={`tag tag-${item.type}`}>{item.type === "fail" ? "🔴 실패" : "🟡 반성공"}</span>
        </span>
        <div className="play-btn">▶</div>
      </div>

      <div className="feed-card-body">
        <p>{item.description}</p>
      </div>

      <div className="feed-actions">
        <button className="action-btn" onClick={onLike}>🤍 {item.likes}</button>
        <button className="action-btn" onClick={() => setShowComments(v => !v)}>
          💬 {comments.length}
        </button>
        <button className="action-btn">🔗 공유</button>
      </div>

      {showComments && (
        <div className="comments-section">
          {comments.map(c => (
            <div className="comment" key={c.id}>
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 13 }}>{c.user_emoji}</div>
              <div className="comment-bubble">
                <div className="comment-user">{c.user_name}</div>
                <p>{c.content}</p>
              </div>
            </div>
          ))}
          <div className="comment-input-row">
            <input
              className="comment-input"
              placeholder="자세 피드백을 달아보세요..."
              value={commentValue}
              onChange={e => onCommentChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onCommentSubmit()}
            />
            <button className="send-btn" onClick={onCommentSubmit}>전송</button>
          </div>
        </div>
      )}
    </div>
  );
}
