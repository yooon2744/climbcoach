import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const FILTERS = ["전체", "번개모임", "오늘", "더클라임", "클라임파크", "보울더링", "다이노"];

export default function Board() {
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("전체");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ gym: "", date: "", time: "", desc: "", max: "4", activity: "" });

  useEffect(() => { loadMeetups(); }, []);

  async function loadMeetups() {
    setLoading(true);
    const { data } = await supabase
      .from("meetups")
      .select("*")
      .order("created_at", { ascending: false });
    setMeetups(data || []);
    setLoading(false);
  }

  async function handlePost() {
    if (!form.gym || !form.desc) return;
    const timeLabel = form.date && form.time
      ? `${form.date.slice(5)} ${form.time}`
      : form.date || form.time || "시간 미정";
    await supabase.from("meetups").insert({
      gym: form.gym,
      meet_time: timeLabel,
      activity: form.activity || "클라이밍",
      description: form.desc,
      max_participants: Number(form.max) || 4,
    });
    setForm({ gym: "", date: "", time: "", desc: "", max: "4", activity: "" });
    setShowModal(false);
    loadMeetups();
  }

  async function handleDelete(id) {
    await supabase.from("meetups").delete().eq("id", id);
    setMeetups(prev => prev.filter(m => m.id !== id));
  }

  const today = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }).replace(" ", "").replace(".", "/").replace(".", "");

  const filtered = activeFilter === "전체"
    ? meetups
    : meetups.filter(m =>
        m.gym?.includes(activeFilter) ||
        m.activity?.includes(activeFilter) ||
        (activeFilter === "오늘" && m.meet_time?.includes(today)) ||
        (activeFilter === "번개모임")
      );

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
          <span style={{ fontSize: 12 }}>직접 글을 써보세요!</span>
        </div>
      )}

      {filtered.map(m => (
        <div className="meetup-card" key={m.id}>
          <div className="meetup-card-top">
            <div>
              <div className="meetup-gym">{m.gym}</div>
              <div className="meetup-time">🕐 {m.meet_time}</div>
            </div>
            <span className="meetup-badge">모집중</span>
          </div>
          <p className="meetup-desc">{m.description}</p>
          <div className="meetup-footer">
            <div className="meetup-participants">
              <span className="tag tag-grade">{m.activity}</span>
              <span style={{ marginLeft: 8 }}>최대 {m.max_participants}명</span>
            </div>
            <button className="join-btn" style={{ background: "transparent", color: "#ff5050", border: "1px solid #ff5050" }}
              onClick={() => handleDelete(m.id)}>삭제</button>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet">
            <h3>✏️ 글쓰기</h3>
            <div className="form-group">
              <label>제목 / 암장</label>
              <input className="form-input" placeholder="예) 더클라임 연남 같이 가실 분" value={form.gym}
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
                <input className="form-input" placeholder="예) 번개모임, 다이노" value={form.activity}
                  onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>최대 인원</label>
                <input className="form-input" type="number" min="2" max="10" value={form.max}
                  onChange={e => setForm(p => ({ ...p, max: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>내용</label>
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
