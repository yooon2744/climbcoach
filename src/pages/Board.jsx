import { useState } from "react";

const INITIAL_MEETUPS = [
  {
    id: 1,
    gym: "더클라임 연남",
    time: "오늘 18:00",
    desc: "같이 다이노 연습하실 분~ V3-V5 수준이면 충분해요! 초보도 환영합니다 🙌",
    activity: "다이노",
    current: 2,
    max: 4,
    joined: false,
    participants: ["🧗","🦅"],
  },
  {
    id: 2,
    gym: "클라임파크 홍대",
    time: "내일 10:00",
    desc: "아침 클라이밍 번개! 오프닝 시간 맞춰서 가볍게 웜업하고 루트 정복해봐요. V4-V6",
    activity: "루트 세션",
    current: 1,
    max: 3,
    joined: false,
    participants: ["🏔️"],
  },
  {
    id: 3,
    gym: "더클라임 마포",
    time: "오늘 20:30",
    desc: "저녁 번개! 보울더링 집중 세션. 서로 베타 공유하면서 진행해요. 비기너도 OK",
    activity: "보울더링",
    current: 3,
    max: 3,
    joined: false,
    participants: ["💪","🎯","😊"],
  },
  {
    id: 4,
    gym: "피어클라이밍 서울숲",
    time: "6/20 14:00",
    desc: "주말 번개 모임! 실내 톱로프 같이 하실 분. 장비 없어도 대여 가능해요 🪢",
    activity: "톱로프",
    current: 2,
    max: 5,
    joined: false,
    participants: ["🧗","🦅"],
  },
];

const FILTERS = ["전체", "오늘", "더클라임", "클라임파크", "보울더링", "다이노"];

export default function Board() {
  const [meetups, setMeetups] = useState(INITIAL_MEETUPS);
  const [activeFilter, setActiveFilter] = useState("전체");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ gym: "", date: "", time: "", desc: "", max: "4", activity: "" });

  function handleJoin(id) {
    setMeetups(prev => prev.map(m => {
      if (m.id !== id) return m;
      if (m.joined) return { ...m, joined: false, current: m.current - 1, participants: m.participants.slice(0, -1) };
      if (m.current >= m.max) return m;
      return { ...m, joined: true, current: m.current + 1, participants: [...m.participants, "😊"] };
    }));
  }

  function handlePost() {
    if (!form.gym || !form.desc) return;
    const newMeetup = {
      id: Date.now(),
      gym: form.gym,
      time: `${form.date} ${form.time}`.trim() || "시간 미정",
      desc: form.desc,
      activity: form.activity || "클라이밍",
      current: 1,
      max: Number(form.max) || 4,
      joined: true,
      participants: ["😊"],
    };
    setMeetups(prev => [newMeetup, ...prev]);
    setForm({ gym: "", date: "", time: "", desc: "", max: "4", activity: "" });
    setShowModal(false);
  }

  const filtered = activeFilter === "전체"
    ? meetups
    : meetups.filter(m =>
        m.gym.includes(activeFilter) ||
        m.activity.includes(activeFilter) ||
        (activeFilter === "오늘" && m.time.startsWith("오늘"))
      );

  return (
    <div className="page">
      <div className="board-header">
        <h2>⚡ 번개 모집</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 모집하기
        </button>
      </div>

      <div className="filter-row">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`filter-chip${activeFilter === f ? " active" : ""}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.map(m => {
        const isFull = m.current >= m.max;
        return (
          <div className="meetup-card" key={m.id}>
            <div className="meetup-card-top">
              <div>
                <div className="meetup-gym">{m.gym}</div>
                <div className="meetup-time">🕐 {m.time}</div>
              </div>
              <span className={`meetup-badge${isFull ? " full" : ""}`}>
                {isFull ? "마감" : "모집중"}
              </span>
            </div>
            <p className="meetup-desc">{m.desc}</p>
            <div className="meetup-footer">
              <div className="meetup-participants">
                <div className="participant-avatars">
                  {m.participants.map((p, i) => (
                    <div className="avatar" key={i} style={{ width: 22, height: 22, fontSize: 11 }}>{p}</div>
                  ))}
                </div>
                <span>{m.current}/{m.max}명</span>
                <span className="tag tag-grade" style={{ marginLeft: 4 }}>{m.activity}</span>
              </div>
              <button
                className={`join-btn${m.joined ? " joined" : ""}`}
                onClick={() => handleJoin(m.id)}
                disabled={isFull && !m.joined}
              >
                {m.joined ? "✓ 참여중" : isFull ? "마감" : "참여하기"}
              </button>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0", fontSize: 14 }}>
          해당 조건의 번개가 없어요 😢<br />
          <span style={{ fontSize: 12 }}>직접 만들어보세요!</span>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet">
            <h3>⚡ 번개 모집 올리기</h3>
            <div className="form-group">
              <label>암장</label>
              <input className="form-input" placeholder="예) 더클라임 연남" value={form.gym}
                onChange={e => setForm(p => ({ ...p, gym: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>날짜</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>시간</label>
                <input className="form-input" type="time" value={form.time}
                  onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>활동</label>
                <input className="form-input" placeholder="예) 다이노, 보울더링" value={form.activity}
                  onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>최대 인원</label>
                <input className="form-input" type="number" min="2" max="10" value={form.max}
                  onChange={e => setForm(p => ({ ...p, max: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>한마디</label>
              <input className="form-input" placeholder="예) V3-V5 같이 다이노 하실 분~" value={form.desc}
                onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
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
