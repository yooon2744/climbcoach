import { useState } from "react";

const INITIAL_FEED = [
  {
    id: 1,
    user: "홍길동",
    emoji: "🧗",
    time: "12분 전",
    type: "fail",
    grade: "V4",
    desc: "더클라임 연남 V4 파란루트... 발 위치가 자꾸 미끄러져요. 오른발 스메어가 문제인 것 같은데 어떻게 수정해야 할지 모르겠어요 😭",
    likes: 14,
    comments: [
      { id: 1, user: "암벽고수", emoji: "🏔️", text: "오른발을 살짝 더 안쪽으로 당겨보세요! 발 끝이 홀드 중심을 향하도록 조정하면 마찰력이 확 올라가요." },
      { id: 2, user: "클라이밍짱", emoji: "💪", text: "상체가 너무 벽에서 떨어져 있어요. 힙을 더 벽쪽으로 붙이면 무게중심이 잡힐 거예요!" },
    ],
  },
  {
    id: 2,
    user: "김민지",
    emoji: "🦅",
    time: "38분 전",
    type: "partial",
    grade: "V3",
    desc: "V3인데 도움닫기 없이 다이노 성공하려다 자꾸 한 손으로만 잡아요 ㅠ 두 손으로 잡으려면 어떻게 해야 하나요?",
    likes: 9,
    comments: [
      { id: 1, user: "다이노킹", emoji: "🎯", text: "점프 타이밍에서 두 팔을 동시에 올리는 게 핵심이에요. 한쪽이 먼저 가면 몸이 회전해서 한 손 잡기가 돼요." },
    ],
  },
];

export default function Main() {
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [dragOver, setDragOver] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});

  function handleLike(id) {
    setFeed(prev => prev.map(f => f.id === id ? { ...f, likes: f.likes + 1, liked: !f.liked } : f));
  }

  function handleCommentChange(feedId, value) {
    setCommentInputs(prev => ({ ...prev, [feedId]: value }));
  }

  function handleCommentSubmit(feedId) {
    const text = commentInputs[feedId]?.trim();
    if (!text) return;
    setFeed(prev => prev.map(f =>
      f.id === feedId
        ? { ...f, comments: [...f.comments, { id: Date.now(), user: "나", emoji: "😊", text }] }
        : f
    ));
    setCommentInputs(prev => ({ ...prev, [feedId]: "" }));
  }

  return (
    <div className="page">
      {/* Upload zone */}
      <div
        className={`upload-zone${dragOver ? " drag-over" : ""}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); }}
        onClick={() => alert("영상 업로드 기능은 준비 중이에요!")}
      >
        <div className="upload-icon">🎬</div>
        <h3>실패 영상을 올려보세요</h3>
        <p>드래그&드롭 또는 클릭 · 코치들이 피드백을 달아줍니다</p>
      </div>

      <p className="section-title">최근 피드백 요청</p>

      {feed.map(item => (
        <FeedCard
          key={item.id}
          item={item}
          commentValue={commentInputs[item.id] || ""}
          onLike={() => handleLike(item.id)}
          onCommentChange={v => handleCommentChange(item.id, v)}
          onCommentSubmit={() => handleCommentSubmit(item.id)}
        />
      ))}
    </div>
  );
}

function FeedCard({ item, commentValue, onLike, onCommentChange, onCommentSubmit }) {
  const [showComments, setShowComments] = useState(true);

  return (
    <div className="feed-card">
      <div className="feed-card-header">
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 16 }}>{item.emoji}</div>
        <div className="user-info">
          <h4>{item.user}</h4>
          <span>{item.time}</span>
        </div>
        <span className={`tag tag-${item.type}`}>
          {item.type === "fail" ? "실패" : "대충 성공"}
        </span>
        <span className="tag tag-grade" style={{ marginLeft: 4 }}>{item.grade}</span>
      </div>

      <div className="video-thumb">
        <span className="video-label">
          <span className={`tag tag-${item.type}`}>{item.type === "fail" ? "🔴 실패" : "🟡 반성공"}</span>
        </span>
        <div className="play-btn">▶</div>
      </div>

      <div className="feed-card-body">
        <p>{item.desc}</p>
      </div>

      <div className="feed-actions">
        <button className={`action-btn${item.liked ? " liked" : ""}`} onClick={onLike}>
          {item.liked ? "❤️" : "🤍"} {item.likes}
        </button>
        <button className="action-btn" onClick={() => setShowComments(v => !v)}>
          💬 {item.comments.length}
        </button>
        <button className="action-btn">🔗 공유</button>
      </div>

      {showComments && (
        <div className="comments-section">
          {item.comments.map(c => (
            <div className="comment" key={c.id}>
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 13 }}>{c.emoji}</div>
              <div className="comment-bubble">
                <div className="comment-user">{c.user}</div>
                <p>{c.text}</p>
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
