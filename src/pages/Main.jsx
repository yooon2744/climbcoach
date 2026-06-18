import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const DEMO_STORIES = [
  { user_name: "클라이머A", user_emoji: "🧗", isDemo: true },
  { user_name: "암장고수", user_emoji: "🏆", isDemo: true },
  { user_name: "볼더러킹", user_emoji: "💪", isDemo: true },
  { user_name: "V8도전중", user_emoji: "🔥", isDemo: true },
];

const GRADES = ["V0","V1","V2","V3","V4","V5","V6","V7","V8+"];

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

  const [calDate, setCalDate] = useState(new Date());
  const [climbedDates, setClimbedDates] = useState(new Set());
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [dayForm, setDayForm] = useState({ gym: "", grade: "V3", result: "성공" });

  useEffect(() => { loadFeed(); loadClimbedDates(); }, []);

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

  async function loadClimbedDates() {
    if (!user) return;
    const { data } = await supabase
      .from("records")
      .select("climbed_at")
      .eq("user_name", myName);
    setClimbedDates(new Set((data || []).map(r => r.climbed_at)));
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

  async function handleDayRecord() {
    if (!dayForm.gym) return;
    await supabase.from("records").insert({
      user_name: myName,
      gym: dayForm.gym,
      grade: dayForm.grade,
      result: dayForm.result,
      climbed_at: selectedDay,
    });
    setClimbedDates(prev => new Set([...prev, selectedDay]));
    setShowDayModal(false);
    setDayForm({ gym: "", grade: "V3", result: "성공" });
  }

  const realUserNames = new Set(storyUsers.map(u => u.user_name));
  const allStories = [
    ...DEMO_STORIES.filter(d => !realUserNames.has(d.user_name)),
    ...storyUsers,
  ];
  const storyPosts = selectedStory ? feed.filter(f => f.user_name === selectedStory) : [];

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const toDateStr = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const calCells = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="page">
      {/* 스토리 원형 */}
      <div className="story-row">
        {allStories.map(u => (
          <div className="story-item" key={u.user_name}
            onClick={() => !u.isDemo && setSelectedStory(u.user_name)}>
            <div className="story-ring">
              <div className="story-avatar">{u.user_emoji}</div>
            </div>
            <span className="story-name">{u.user_name}</span>
          </div>
        ))}
      </div>

      <p className="section-title">최근 피드백 요청</p>

      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>불러오는 중...</div>
      )}
      {!loading && feed.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          아직 게시물이 없어요 😢<br />
          <span style={{ fontSize: 12 }}>하단 + 버튼으로 첫 피드백 요청을 올려보세요!</span>
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

      {/* 월별 달력 */}
      <div className="calendar-section">
        <div className="calendar-nav">
          <button className="cal-nav-btn" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
          <span className="calendar-title">{year}년 {month + 1}월</span>
          <button className="cal-nav-btn" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="cal-day-labels">
          {["일","월","화","수","목","금","토"].map(d => (
            <div key={d} className="cal-day-label">{d}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {calCells.map((d, i) => {
            if (!d) return <div key={i} className="cal-cell empty" />;
            const ds = toDateStr(d);
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
            const isClimbed = climbedDates.has(ds);
            return (
              <div key={i}
                className={`cal-cell${isClimbed ? " climbed" : ""}${isToday && !isClimbed ? " today" : ""}`}
                onClick={() => { setSelectedDay(ds); setShowDayModal(true); }}>
                {d}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowUploadModal(true)}>+</button>

      {/* 스토리 모달 */}
      {selectedStory && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedStory(null); }}>
          <div className="modal-sheet story-modal">
            <div className="story-modal-header">
              <div className="story-modal-user">
                <div className="story-ring" style={{ transform: "scale(0.72)" }}>
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

      {/* 날짜 기록 모달 */}
      {showDayModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDayModal(false); }}>
          <div className="modal-sheet">
            <h3>🧗 {selectedDay} 기록</h3>
            {climbedDates.has(selectedDay) && (
              <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 12 }}>✅ 이미 기록된 날이에요!</div>
            )}
            <div className="form-group">
              <label>암장</label>
              <input className="form-input" placeholder="예) 더클라임 연남" value={dayForm.gym}
                onChange={e => setDayForm(p => ({ ...p, gym: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>난이도</label>
                <select className="form-input" value={dayForm.grade}
                  onChange={e => setDayForm(p => ({ ...p, grade: e.target.value }))}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>결과</label>
                <select className="form-input" value={dayForm.result}
                  onChange={e => setDayForm(p => ({ ...p, result: e.target.value }))}>
                  <option value="성공">성공</option>
                  <option value="실패">실패</option>
                  <option value="시도">시도</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDayModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleDayRecord}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 업로드 모달 */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowUploadModal(false); setVideoFile(null); } }}>
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
              <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
                onChange={e => setVideoFile(e.target.files[0] || null)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>난이도</label>
                <select className="form-input" value={uploadForm.grade}
                  onChange={e => setUploadForm(p => ({ ...p, grade: e.target.value }))}>
                  <option value="">선택</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
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
                style={{ resize: "none" }} />
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
        <button className="action-btn" onClick={() => setShowComments(v => !v)}>💬 {comments.length}</button>
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
            <input className="comment-input" placeholder="자세 피드백을 달아보세요..."
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
