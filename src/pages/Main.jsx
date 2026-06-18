import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const DEMO_STORIES = [
  { user_name: "클라이머A", user_emoji: "🧗", isDemo: true },
  { user_name: "클라이머B", user_emoji: "🧗", isDemo: true },
  { user_name: "클라이머C", user_emoji: "🧗", isDemo: true },
  { user_name: "클라이머D", user_emoji: "🧗", isDemo: true },
];

function isVideoUrl(url) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url);
}

export default function Main() {
  const { user } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";
  const myProfileImg = user ? localStorage.getItem(`profileImg_${user.id}`) : null;

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storyUsers, setStoryUsers] = useState([]);
  const [myHasPosts, setMyHasPosts] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
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
    setMyHasPosts(posts.some(p => p.user_name === myName));
    const seen = new Set([myName]);
    const users = [];
    for (const p of posts) {
      if (!seen.has(p.user_name)) {
        seen.add(p.user_name);
        users.push({ user_name: p.user_name, user_emoji: "🧗", hasPosts: true });
      }
    }
    setStoryUsers(users);
    setLoading(false);
  }

  async function handleUpload() {
    if (!description.trim() && mediaFiles.length === 0) return;
    setUploading(true);

    try {
      const media_urls = [];
      for (const file of mediaFiles) {
        const ext = file.name.split(".").pop();
        const fileName = `${myName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw new Error(`파일 업로드 실패: ${uploadError.message}`);
        const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(fileName);
        media_urls.push(publicUrl);
      }

      const { error: insertError } = await supabase.from("posts").insert({
        user_name: myName,
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
    await supabase.from("posts").update({ likes: currentLikes + 1 }).eq("id", postId);
    setFeed(prev => prev.map(f => f.id === postId ? { ...f, likes: f.likes + 1 } : f));
  }

  async function handleCommentSubmit(postId) {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    await supabase.from("comments").insert({
      post_id: postId,
      user_name: myName,
      user_emoji: "🧗",
      content: text,
    });
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    loadFeed();
  }

  const realUserNames = new Set(storyUsers.map(u => u.user_name));
  const allStories = [
    { user_name: myName, user_emoji: "🧗", profileImg: myProfileImg, hasPosts: myHasPosts, isMe: true },
    ...DEMO_STORIES.filter(d => !realUserNames.has(d.user_name)),
    ...storyUsers,
  ];

  const storyPosts = selectedStory ? feed.filter(f => f.user_name === selectedStory) : [];

  return (
    <div className="page">
      <div className="story-row">
        {allStories.map(u => (
          <div className="story-item" key={u.user_name}
            onClick={() => !u.isDemo && setSelectedStory(u.user_name)}>
            <div className={`story-ring${u.hasPosts ? "" : " story-ring-inactive"}`}>
              {u.profileImg ? (
                <img src={u.profileImg} alt="" className="story-avatar story-avatar-photo" />
              ) : (
                <div className="story-avatar">{u.user_emoji}</div>
              )}
            </div>
            <span className="story-name">{u.isMe ? "나" : u.user_name}</span>
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
          commentValue={commentInputs[item.id] || ""}
          onLike={() => handleLike(item.id, item.likes)}
          onCommentChange={v => setCommentInputs(prev => ({ ...prev, [item.id]: v }))}
          onCommentSubmit={() => handleCommentSubmit(item.id)}
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
                  <div className="story-avatar">🧗</div>
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

function FeedCard({ item, commentValue, onLike, onCommentChange, onCommentSubmit }) {
  const [showComments, setShowComments] = useState(true);
  const comments = item.comments || [];
  const mediaUrls = item.media_urls?.length > 0 ? item.media_urls
    : item.video_url ? [item.video_url] : [];

  return (
    <div className="feed-card">
      <div className="feed-card-header">
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 16 }}>{item.user_emoji || "🧗"}</div>
        <div className="user-info">
          <h4>{item.user_name}</h4>
          <span>{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
      </div>

      {mediaUrls.length > 0 && (
        <div className={`media-gallery ${mediaUrls.length > 1 ? "multi" : "single"}`}>
          {mediaUrls.map((url, i) => (
            isVideoUrl(url) ? (
              <video key={i} src={url} controls className="gallery-item" playsInline />
            ) : (
              <img key={i} src={url} alt="" className="gallery-item" />
            )
          ))}
        </div>
      )}

      {item.description && (
        <div className="feed-card-body">
          <p>{item.description}</p>
        </div>
      )}

      <div className="feed-actions">
        <button className="action-btn" onClick={onLike}>🤍 {item.likes}</button>
        <button className="action-btn" onClick={() => setShowComments(v => !v)}>💬 {comments.length}</button>
        <button className="action-btn">🔗 공유</button>
      </div>

      {showComments && (
        <div className="comments-section">
          {comments.map(c => (
            <div className="comment" key={c.id}>
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 13 }}>{c.user_emoji || "🧗"}</div>
              <div className="comment-bubble">
                <div className="comment-user">{c.user_name}</div>
                <p>{c.content}</p>
              </div>
            </div>
          ))}
          <div className="comment-input-row">
            <input className="comment-input" placeholder="피드백을 달아보세요..."
              value={commentValue}
              onChange={e => onCommentChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onCommentSubmit()} />
            <button className="send-btn" onClick={onCommentSubmit}>전송</button>
          </div>
        </div>
      )}
    </div>
  );
}
