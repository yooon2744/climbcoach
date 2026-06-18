import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const GRADES = ["V0","V1","V2","V3","V4","V5","V6","V7","V8+"];

export default function MyPage() {
  const { user } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [profileImg, setProfileImg] = useState(null);
  const imgInputRef = useRef(null);

  const [memberships, setMemberships] = useState([]);
  const [settingDates, setSettingDates] = useState([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [memberInput, setMemberInput] = useState("");
  const [settingInput, setSettingInput] = useState("");

  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [form, setForm] = useState({ gym: "", grade: "V3", result: "성공", climbed_at: "" });

  const [myPosts, setMyPosts] = useState([]);

  useEffect(() => {
    if (!user) return;
    const savedImg = localStorage.getItem(`profileImg_${user.id}`);
    if (savedImg) setProfileImg(savedImg);
    const savedMem = localStorage.getItem(`memberships_${user.id}`);
    if (savedMem) setMemberships(JSON.parse(savedMem));
    const savedSet = localStorage.getItem(`settingDates_${user.id}`);
    if (savedSet) setSettingDates(JSON.parse(savedSet));
    loadRecords();
    loadMyPosts();
  }, [user]);

  async function loadRecords() {
    setLoadingRecords(true);
    const { data } = await supabase
      .from("records")
      .select("*")
      .eq("user_name", myName)
      .order("climbed_at", { ascending: false });
    setRecords(data || []);
    setLoadingRecords(false);
  }

  async function loadMyPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_name", myName)
      .order("created_at", { ascending: false });
    setMyPosts(data || []);
  }

  function handleProfileImageClick() { imgInputRef.current?.click(); }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setProfileImg(base64);
      localStorage.setItem(`profileImg_${user.id}`, base64);
    };
    reader.readAsDataURL(file);
  }

  function saveMemberships(list) {
    setMemberships(list);
    localStorage.setItem(`memberships_${user.id}`, JSON.stringify(list));
  }

  function saveSettingDates(list) {
    setSettingDates(list);
    localStorage.setItem(`settingDates_${user.id}`, JSON.stringify(list));
  }

  async function handleAddRecord() {
    if (!form.gym || !form.climbed_at) return;
    await supabase.from("records").insert({
      user_name: myName,
      gym: form.gym,
      grade: form.grade,
      result: form.result,
      climbed_at: form.climbed_at,
    });
    setForm({ gym: "", grade: "V3", result: "성공", climbed_at: "" });
    setShowRecordModal(false);
    loadRecords();
  }

  async function handleDeleteRecord(id) {
    await supabase.from("records").delete().eq("id", id);
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  const signupDate = user?.created_at ? new Date(user.created_at) : new Date();
  const daysSince = Math.max(1, Math.floor((new Date() - signupDate) / (1000 * 60 * 60 * 24)) + 1);

  const gradeCounts = GRADES.map(g => ({
    grade: g,
    count: records.filter(r => r.grade === g && r.result === "성공").length,
  }));
  const maxCount = Math.max(...gradeCounts.map(g => g.count), 1);
  const hasGradeData = gradeCounts.some(g => g.count > 0);

  return (
    <div className="page">
      {/* 프로필 카드 */}
      <div className="profile-card">
        <div className="profile-avatar-wrap" onClick={handleProfileImageClick}>
          {profileImg ? (
            <img src={profileImg} alt="profile" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar">🧗</div>
          )}
          <div className="profile-avatar-edit">📷</div>
        </div>
        <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
        <div className="profile-name">{myName}</div>
        <div className="profile-gym">{user?.email}</div>

        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-val">D+{daysSince}</span>
            <span className="stat-label">클라이밍 시작</span>
          </div>
          <div className="stat-item stat-clickable" onClick={() => setShowMemberModal(true)}>
            <span className="stat-val">{memberships.length || "+"}</span>
            <span className="stat-label">회원권</span>
          </div>
          <div className="stat-item stat-clickable" onClick={() => setShowSettingModal(true)}>
            <span className="stat-val">{settingDates.length || "+"}</span>
            <span className="stat-label">세팅 일정</span>
          </div>
        </div>
      </div>

      {/* 난이도 분포 */}
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

      {/* 내 게시물 그리드 */}
      <p className="section-title">내 게시물</p>
      {myPosts.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: 13, marginBottom: 16 }}>
          피드에 올린 게시물이 여기 표시돼요
        </div>
      ) : (
        <div className="post-grid">
          {myPosts.map(p => (
            <div className="post-grid-item" key={p.id}>
              {p.video_url ? (
                <video src={p.video_url} className="post-grid-thumb" muted />
              ) : (
                <div className="post-grid-placeholder">
                  <span style={{ fontSize: 22 }}>{p.type === "fail" ? "🔴" : "🟡"}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.grade || p.type}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 클라이밍 기록 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 12px" }}>
        <p className="section-title" style={{ marginBottom: 0 }}>클라이밍 기록</p>
        <button className="btn btn-primary" style={{ padding: "7px 14px", fontSize: 13 }}
          onClick={() => setShowRecordModal(true)}>+ 기록 추가</button>
      </div>

      {loadingRecords && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0" }}>불러오는 중...</div>
      )}
      {!loadingRecords && records.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: 13 }}>
          기록이 없어요. 추가해보세요!
        </div>
      )}
      {records.map(r => (
        <div className="record-card" key={r.id}>
          <div className="record-icon">{r.result === "성공" ? "✅" : r.result === "실패" ? "❌" : "🔄"}</div>
          <div className="record-info">
            <h4>{r.gym}</h4>
            <span>{r.climbed_at}</span>
          </div>
          <span className={`tag ${r.result === "성공" ? "tag-grade" : "tag-fail"}`} style={{ marginRight: 8 }}>{r.result}</span>
          <span className="record-grade">{r.grade}</span>
          <button onClick={() => handleDeleteRecord(r.id)}
            style={{ marginLeft: 10, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      ))}

      {/* 회원권 모달 */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowMemberModal(false); setMemberInput(""); } }}>
          <div className="modal-sheet">
            <h3>🎫 회원권</h3>
            {memberships.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>등록된 회원권이 없어요</div>
            )}
            {memberships.map((m, i) => (
              <div key={i} className="edit-list-item">
                <span>{m}</span>
                <button onClick={() => saveMemberships(memberships.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="form-input" placeholder="예) 더클라임 강남 (7월까지)" value={memberInput}
                onChange={e => setMemberInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && memberInput.trim()) { saveMemberships([...memberships, memberInput.trim()]); setMemberInput(""); } }} />
              <button className="btn btn-primary" style={{ padding: "0 14px", flexShrink: 0 }}
                onClick={() => { if (memberInput.trim()) { saveMemberships([...memberships, memberInput.trim()]); setMemberInput(""); } }}>추가</button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowMemberModal(false); setMemberInput(""); }}>완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 세팅 일정 모달 */}
      {showSettingModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowSettingModal(false); setSettingInput(""); } }}>
          <div className="modal-sheet">
            <h3>📅 세팅 일정</h3>
            {settingDates.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>등록된 세팅 일정이 없어요</div>
            )}
            {settingDates.map((s, i) => (
              <div key={i} className="edit-list-item">
                <span>{s}</span>
                <button onClick={() => saveSettingDates(settingDates.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="form-input" placeholder="예) 더클라임 - 매주 화요일" value={settingInput}
                onChange={e => setSettingInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && settingInput.trim()) { saveSettingDates([...settingDates, settingInput.trim()]); setSettingInput(""); } }} />
              <button className="btn btn-primary" style={{ padding: "0 14px", flexShrink: 0 }}
                onClick={() => { if (settingInput.trim()) { saveSettingDates([...settingDates, settingInput.trim()]); setSettingInput(""); } }}>추가</button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowSettingModal(false); setSettingInput(""); }}>완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 기록 추가 모달 */}
      {showRecordModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecordModal(false); }}>
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
              <button className="btn btn-ghost" onClick={() => setShowRecordModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleAddRecord}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
