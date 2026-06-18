import { useState } from "react";

const INITIAL_RECORDS = [
  { id: 1, gym: "더클라임 연남", grade: "V4", result: "성공", date: "2026-06-17", icon: "✅" },
  { id: 2, gym: "더클라임 연남", grade: "V5", result: "실패", date: "2026-06-17", icon: "❌" },
  { id: 3, gym: "클라임파크 홍대", grade: "V3", result: "성공", date: "2026-06-15", icon: "✅" },
  { id: 4, gym: "클라임파크 홍대", grade: "V4", result: "성공", date: "2026-06-15", icon: "✅" },
  { id: 5, gym: "피어클라이밍", grade: "V2", result: "성공", date: "2026-06-12", icon: "✅" },
];

const GRADE_STATS = [
  { grade: "V5+", count: 0, max: 10 },
  { grade: "V4", count: 3, max: 10 },
  { grade: "V3", count: 6, max: 10 },
  { grade: "V2", count: 8, max: 10 },
  { grade: "V1-", count: 10, max: 10 },
];

export default function MyPage() {
  const [records, setRecords] = useState(INITIAL_RECORDS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ gym: "", grade: "V3", result: "성공", date: "" });

  const successCount = records.filter(r => r.result === "성공").length;
  const gymCount = new Set(records.map(r => r.gym)).size;

  function handleAddRecord() {
    if (!form.gym || !form.date) return;
    setRecords(prev => [{
      id: Date.now(),
      gym: form.gym,
      grade: form.grade,
      result: form.result,
      date: form.date,
      icon: form.result === "성공" ? "✅" : "❌",
    }, ...prev]);
    setForm({ gym: "", grade: "V3", result: "성공", date: "" });
    setShowModal(false);
  }

  return (
    <div className="page">
      {/* Profile */}
      <div className="profile-card">
        <div className="profile-avatar">🧗</div>
        <div className="profile-name">홍길동</div>
        <div className="profile-gym">주 암장: 더클라임 연남</div>
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-val">{records.length}</span>
            <span className="stat-label">총 세션</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">{successCount}</span>
            <span className="stat-label">완등</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">{gymCount}</span>
            <span className="stat-label">방문 암장</span>
          </div>
        </div>
      </div>

      {/* Grade chart */}
      <div className="card">
        <p className="section-title">난이도 분포</p>
        {GRADE_STATS.map(g => (
          <div className="level-bar-row" key={g.grade}>
            <span className="level-label">{g.grade}</span>
            <div className="level-bar-bg">
              <div className="level-bar-fill" style={{ width: `${(g.count / g.max) * 100}%` }} />
            </div>
            <span className="level-count">{g.count}</span>
          </div>
        ))}
      </div>

      {/* Records */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>클라이밍 기록</p>
        <button className="btn btn-primary" style={{ padding: "7px 14px", fontSize: "13px" }}
          onClick={() => setShowModal(true)}>
          + 기록 추가
        </button>
      </div>

      {records.map(r => (
        <div className="record-card" key={r.id}>
          <div className="record-icon">{r.icon}</div>
          <div className="record-info">
            <h4>{r.gym}</h4>
            <span>{r.date}</span>
          </div>
          <span className={`tag ${r.result === "성공" ? "tag-grade" : "tag-fail"}`} style={{ marginRight: 8 }}>
            {r.result}
          </span>
          <span className="record-grade">{r.grade}</span>
        </div>
      ))}

      <button className="add-record-btn" onClick={() => setShowModal(true)}>
        + 새 기록 추가하기
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet">
            <h3>🧗 기록 추가</h3>
            <div className="form-group">
              <label>암장</label>
              <input className="form-input" placeholder="예) 더클라임 연남" value={form.gym}
                onChange={e => setForm(p => ({ ...p, gym: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>난이도</label>
                <select className="form-input" value={form.grade}
                  onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}>
                  {["V0","V1","V2","V3","V4","V5","V6","V7","V8+"].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>결과</label>
                <select className="form-input" value={form.result}
                  onChange={e => setForm(p => ({ ...p, result: e.target.value }))}>
                  <option value="성공">성공</option>
                  <option value="실패">실패</option>
                  <option value="시도">시도</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>날짜</label>
              <input className="form-input" type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleAddRecord}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
