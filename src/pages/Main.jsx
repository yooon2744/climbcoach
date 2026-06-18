import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Main() {
  const { user } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storyUsers, setStoryUsers] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ grade: "", type: "fail", description: "" });
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { loadFeed(); }, []);

  async function loadFeed() {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*, comments(*)")
      .order("created_at", { ascending: false });
    const posts = data || [];
    setFeed(posts);

    const seen = new Set();
    const users = [];
    for (const p of posts) {
      if (!seen.has(p.user_name)) {
        seen.add(p.user_name);
        users.push({ user_name: p.user_name, user_emoji: p.user_emoji });
      }
    }
    setStoryUsers(users);
    setLoading(false);
  }

  async function handleUpload() {
    if (!uploadForm.description.trim()) return;
    setUploading(true);

    let video_url = null;
    if (videoFile) {
      const ext = videoFile.name.split(".").pop();
      const fileName = `${myName}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, videoFile, { contentType: videoFile.type });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(fileName);
        video_url = publicUrl;
      }
    }

    await supabase.from("posts").insert({
      user_name: myName,
      user_emoji: "🧗",
      grade: uploadForm.grade,
      type: uploadForm.type,
      description: uploadForm.description,
      likes: 0,
      video_url,
    });

    setUploadForm({ grade: "", type: "fail", description: "" });
    setVideoFile(null);
    setShowUploadModal(false);
    setUploading(false);
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
      user_name: myName,
      user_emoji: "💬",
      content: text,
    });
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    loadFeed();
  }

  const storyPosts = selectedStory ? feed.filter(f => f.user_name === selectedStory) : [];

  return (
    <div className="page">
      {/* 스토리 원형 목록 */}
      {storyUsers.length > 0 && (
        <div className="story-row">
          {storyUsers.map(u => (
            <div className="story-item" key={u.user_name} onClick={() => setSelectedStory(u.user_name)}>
              <div className="story-ring">
                <div className="story-avatar">{u.user_emoji}</div>
              </div>
              <span className="story-name">{u.user_name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="upload-zone" onClick={() => setShowUploadModal(true)}>
        <div className="upload-icon">🎬</div>
        <h3>실패 영상을 올려보세요</h3>
        <p>클릭해서 피드백 요청 올리기 · 코치들이 댓글로 교정해줘요</p>
      </div>

      <p className="section-title">최근 피드백 요청</p>

      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>불러오는 중...</div>
      )}

      {!loading && feed.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          아직 게시물이 없어요 😢<br />
          <span style={{ fontSize: 12 }}>첫 번째로 피드백 요청을 올려보세요!</span>
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

      {/* 스토리 모달 */}
      {selectedStory && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedStory(null)}>
          <div className="modal-sheet story-modal">
            <div className="story-modal-header">
              <div className="story-modal-user">
                <div className="story-ring" style={{ transform: "scale(0.75)" }}>
                  <div className="story-avatar">
                    {storyUsers.find(u => u.user_name === selectedStory)?.user_emoji}
                  </div>
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
                <FeedCard
                  key={item.id}
                  item={item}
                  commentValue={commentInputs[item.id] || ""}
                  onLike={() => handleLike(item.id, item.likes)}
                  onCommentChange={v => setCommentInputs(prev => ({ ...prev, [item.id]: v }))}
                  onCommentSubmit={() => handleCommentSubmit(item.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 업로드 모달 */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUploadModal(false)}>
          <div className="modal-sheet">
            <h3>🎬 피드백 요청 올리기</h3>

            <div className="form-group">
              <label>영상 첨부 (선택)</label>
              <div className="video-upload-zone" onClick={() => fileInputRef.current?.click()}>
                {videoFile ? (
                  <div style={{ color: "var(--accent)", fontSize: 13 }}>
                    ✅ {videoFile.name}
                    <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 11 }}>
                      ({(videoFile.size / 1024 / 1024).toFixed(1)}MB)
                    </span>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 28 }}>🎬</span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>클릭해서 영상 선택</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>mp4, mov 등</span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                style={{ display: "none" }}
                onChange={e => setVideoFile(e.target.files[0] || null)}
              />
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
              <button className="btn btn-ghost" onClick={() => { setShowUploadModal(false); setVideoFile(null); }}>취소</button>
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

      {item.video_url ? (
        <video src={item.video_url} controls className="feed-video" playsInline />
      ) : (
        <div className="video-thumb">
          <span className="video-label">
            <span className={`tag tag-${item.type}`}>{item.type === "fail" ? "🔴 실패" : "🟡 반성공"}</span>
          </span>
          <div className="play-btn">▶</div>
        </div>
      )}

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
