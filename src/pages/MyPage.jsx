import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const GRADES = ["V0","V1","V2","V3","V4","V5","V6","V7","V8+"];

export default function MyPage() {
  const { user } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ gym: "", grade: "V3", result: "성공", climbed_at: "" });

  useEffect(() => { if (user) loadRecords(); }, [user]);

  async function loadRecords() {
    setLoading(true);
    const { data } = await supabase
      .from("records")
      .select("*")
      .eq("user_name", myName)
      .order("climbed_at", { ascending: false });
    setRecords(data || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!form.gym || !form.climbed_at) return;
    await supabase.from("records").insert({
      user_name: myName,
      gym: form.gym,
      grade: form.grade,
      result: form.result,
      climbed_at: form.climbed_at,
    });
    setForm({ gym: "", grade: "V3", result: "성공", climbed_at: "" });
    setShowModal(false);
    loadRecords();
  }

  async function handleDelete(id) {
    await supabase.from("records").delete().eq("id", id);
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  const successCount = records.filter(r => r.result === "성공").length;
  const gymCount = new Set(records.map(r => r.gym)).size;

  const gradeCounts = GRADES.map(g => ({
    grade: g,
    count: records.filter(r => r.grade === g && r.result === "성공").length,
  }));
  const maxCount = Math.max(...gradeCounts.map(g => g.count), 1);
  const hasGradeData = gradeCounts.some(g => g.count > 0);

  return (
    <div className="page">
      <div className="profile-card">
        <div className="profile-avatar">🧗</div>
        <div className="profile-name">{myName}</div>
        <div className="profile-gym">{user?.email}</div>
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-val">{records.length}</span>
            <span className="stat-label">총 기록</span>
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

      {hasGradeData && (
        <div className="card">
          <p className="section-title">완등 난이도 분포</p>
          {gradeCounts.filter(g => g.count > 0).reverse().map(g => (
            <div className="level-bar-row" key={g.grade}>
              <span className="level-label">{g.grade}</span>
              <div className="level-bar-bg">
                <div className="level-bar-fill" style={{ width: `${(g.count / maxCount) * 100}%` }} />
              </div>
              <span className="level-count">{g.count}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>클라이밍 기록</p>
        <button className="btn btn-primary" style={{ padding: "7px 14px", fontSize: 13 }}
          onClick={() => setShowModal(true)}>+ 기록 추가</button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>불러오는 중...</div>
      )}

      {!loading && records.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0", fontSize: 14 }}>
          아직 기록이 없어요!<br />
          <span style={{ fontSize: 12 }}>첫 번째 클라이밍 기록을 추가해보세요 🧗</span>
        </div>
      )}

      {records.map(r => (
        <div className="record-card" key={r.id}>
          <div className="record-icon">{r.result === "성공" ? "✅" : r.result === "실패" ? "❌" : "🔄"}</div>
          <div className="record-info">
            <h4>{r.gym}</h4>
            <span>{r.climbed_at}</span>
          </div>
          <span className={`tag ${r.result === "성공" ? "tag-grade" : "tag-fail"}`} style={{ marginRight: 8 }}>
            {r.result}
          </span>
          <span className="record-grade">{r.grade}</span>
          <button onClick={() => handleDelete(r.id)}
            style={{ marginLeft: 10, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
            ×
          </button>
        </div>
      ))}

      <button className="add-record-btn" onClick={() => setShowModal(true)}>+ 새 기록 추가하기</button>

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
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
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
              <input className="form-input" type="date" value={form.climbed_at}
                onChange={e => setForm(p => ({ ...p, climbed_at: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleAdd}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
