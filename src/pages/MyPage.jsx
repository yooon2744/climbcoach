import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const GRADES = ["V0","V1","V2","V3","V4","V5","V6","V7","V8+"];
const CONDITIONS = ["😫", "😕", "😐", "🙂", "😄"];

const DURATIONS = (() => {
  const opts = [];
  for (let m = 10; m <= 300; m += 10) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (h === 0) opts.push(`${min}분`);
    else if (min === 0) opts.push(`${h}시간`);
    else opts.push(`${h}시간 ${min}분`);
  }
  return opts;
})();

export default function MyPage() {
  const { user, profileImg, updateProfileImg, updateNickname } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const imgInputRef = useRef(null);
  const editFileRef = useRef(null);

  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");

  const [memberships, setMemberships] = useState([]);
  const [settingDates, setSettingDates] = useState([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [memberInput, setMemberInput] = useState("");
  const [settingInput, setSettingInput] = useState("");

  const [records, setRecords] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [myPosts, setMyPosts] = useState([]);
  const [myMeetups, setMyMeetups] = useState([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showMeetupModal, setShowMeetupModal] = useState(false);
  const [selectedMeetup, setSelectedMeetup] = useState(null);
  const [editMeetupTitle, setEditMeetupTitle] = useState("");
  const [editMeetupContent, setEditMeetupContent] = useState("");
  const [editMeetupCategory, setEditMeetupCategory] = useState("자유");

  const [userTag, setUserTag] = useState("");
  const [editingTag, setEditingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [followerCount, setFollowerCount] = useState(0);
  const [pendingFollowers, setPendingFollowers] = useState([]);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [meetupsExpanded, setMeetupsExpanded] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editDescription, setEditDescription] = useState("");
  const [editMediaUrls, setEditMediaUrls] = useState([]);
  const [newMediaFiles, setNewMediaFiles] = useState([]);

  const [calDate, setCalDate] = useState(new Date());
  const [climbedDates, setClimbedDates] = useState({});
  const [showCalModal, setShowCalModal] = useState(false);
  const [selectedCalDay, setSelectedCalDay] = useState("");
  const [calForm, setCalForm] = useState({ gym: "", memo: "", duration: "1시간", condition: "😐" });

  useEffect(() => {
    if (!user) return;
    const savedMem = localStorage.getItem(`memberships_${user.id}`);
    if (savedMem) setMemberships(JSON.parse(savedMem));
    const savedSet = localStorage.getItem(`settingDates_${user.id}`);
    if (savedSet) setSettingDates(JSON.parse(savedSet));
    const savedBio = localStorage.getItem(`bio_${user.id}`) || "";
    setBio(savedBio);
    loadRecords();
    loadMyPosts();
    loadMyMeetups();
    loadClimbedDates();
    loadFollows();
    loadUserTag();
    upsertProfile();
  }, [user]);

  async function upsertProfile() {
    if (!myName) return;
    await supabase.from("profiles").upsert({ user_name: myName }, { onConflict: "user_name" });
  }

  async function loadFollows() {
    const [{ data: allFollowers }, { data: myFollowings }] = await Promise.all([
      supabase.from("follows").select("follower, status").eq("following", myName),
      supabase.from("follows").select("following").eq("follower", myName).eq("status", "accepted"),
    ]);
    setFollowerCount((allFollowers || []).length);
    setPendingFollowers((allFollowers || []).filter(f => f.status === "pending"));
    setFriendCount((myFollowings || []).length);
  }

  async function loadRecords() {
    const { data } = await supabase
      .from("records")
      .select("*")
      .eq("user_name", myName)
      .order("climbed_at", { ascending: false });
    setRecords(data || []);
  }

  async function loadMyPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .or(`user_id.eq.${user.id},and(user_id.is.null,user_name.eq.${myName})`)
      .order("created_at", { ascending: false });
    setMyPosts(data || []);
  }

  async function loadMyMeetups() {
    const { data } = await supabase
      .from("meetups")
      .select("*")
      .eq("meet_time", myName)
      .order("created_at", { ascending: false });
    setMyMeetups(data || []);
  }

  function openMeetupModal(meetup) {
    setSelectedMeetup(meetup);
    setEditMeetupTitle(meetup.gym || "");
    setEditMeetupContent(meetup.description || "");
    setEditMeetupCategory(meetup.activity || "자유");
    setShowMeetupModal(true);
  }

  async function handleEditMeetup() {
    if (!selectedMeetup || !editMeetupTitle.trim()) return;
    const { error } = await supabase
      .from("meetups")
      .update({ gym: editMeetupTitle, description: editMeetupContent, activity: editMeetupCategory })
      .eq("id", selectedMeetup.id);
    if (error) { alert("수정 실패: " + error.message); return; }
    setMyMeetups(prev => prev.map(m => m.id === selectedMeetup.id
      ? { ...m, gym: editMeetupTitle, description: editMeetupContent, activity: editMeetupCategory }
      : m));
    setShowMeetupModal(false);
  }

  async function loadUserTag() {
    const { data } = await supabase.from("profiles").select("user_tag").eq("user_name", myName).maybeSingle();
    setUserTag(data?.user_tag || "");
  }

  async function handleTagSave() {
    const trimmed = tagInput.trim().replace(/^@/, "").replace(/\s+/g, "");
    setEditingTag(false);
    if (!trimmed || trimmed === userTag) return;
    const { data: existing } = await supabase.from("profiles").select("user_name").eq("user_tag", trimmed).neq("user_name", myName).maybeSingle();
    if (existing) { alert("이미 사용 중인 아이디입니다."); return; }
    await supabase.from("profiles").upsert({ user_name: myName, user_tag: trimmed }, { onConflict: "user_name" });
    setUserTag(trimmed);
  }

  async function handleAcceptFollow(followerName) {
    await supabase.from("follows").update({ status: "accepted" }).eq("follower", followerName).eq("following", myName);
    await supabase.from("follows").upsert({ follower: myName, following: followerName, status: "accepted" }, { onConflict: "follower,following" });
    setPendingFollowers(prev => prev.filter(f => f.follower !== followerName));
    setFriendCount(prev => prev + 1);
  }

  async function handleDeleteMeetup() {
    if (!selectedMeetup) return;
    const { error } = await supabase.from("meetups").delete().eq("id", selectedMeetup.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    setMyMeetups(prev => prev.filter(m => m.id !== selectedMeetup.id));
    setShowMeetupModal(false);
  }

  async function loadClimbedDates() {
    const { data } = await supabase
      .from("records")
      .select("id, climbed_at, condition, gym, memo, duration")
      .eq("user_name", myName)
      .eq("result", "");
    const map = {};
    (data || []).forEach(r => {
      if (r.climbed_at) {
        map[r.climbed_at] = {
          id: r.id,
          condition: r.condition || "😐",
          gym: r.gym || "",
          memo: r.memo || "",
          duration: r.duration || "1시간",
        };
      }
    });
    setClimbedDates(map);
  }

  function handleProfileImageClick() { imgInputRef.current?.click(); }

  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await updateProfileImg(file);
    } catch (err) {
      alert("사진 업로드 실패: " + err.message);
    }
  }

  async function handleNicknameChange() {
    const trimmed = nicknameInput.trim();
    if (!trimmed || trimmed === myName) { setEditingNickname(false); return; }
    try {
      await updateNickname(trimmed);
      setEditingNickname(false);
    } catch (err) {
      alert("닉네임 변경 실패: " + err.message);
    }
  }

  function saveMemberships(list) {
    setMemberships(list);
    localStorage.setItem(`memberships_${user.id}`, JSON.stringify(list));
  }

  function saveSettingDates(list) {
    setSettingDates(list);
    localStorage.setItem(`settingDates_${user.id}`, JSON.stringify(list));
  }

  async function handleCalRecord() {
    const existing = climbedDates[selectedCalDay];
    if (existing?.id) {
      const { error } = await supabase.from("records").update({
        gym: calForm.gym, memo: calForm.memo, duration: calForm.duration, condition: calForm.condition,
      }).eq("id", existing.id);
      if (error) { alert("수정 실패: " + error.message); return; }
    } else {
      const { error } = await supabase.from("records").insert({
        user_name: myName, gym: calForm.gym || "", grade: "", result: "",
        climbed_at: selectedCalDay, memo: calForm.memo, duration: calForm.duration, condition: calForm.condition,
      });
      if (error) { alert("저장 실패: " + error.message); return; }
    }
    setShowCalModal(false);
    setCalForm({ gym: "", memo: "", duration: "1시간", condition: "😐" });
    loadClimbedDates();
  }

  async function handleDeleteCalRecord() {
    const existing = climbedDates[selectedCalDay];
    if (!existing?.id) return;
    await supabase.from("records").delete().eq("id", existing.id);
    setShowCalModal(false);
    loadClimbedDates();
  }

  function openPostModal(post) {
    setSelectedPost(post);
    setEditDescription(post.description || "");
    setEditMediaUrls(post.media_urls || (post.video_url ? [post.video_url] : []));
    setNewMediaFiles([]);
    setShowPostModal(true);
  }

  async function handleEditPost() {
    if (!selectedPost) return;
    const uploadedUrls = [];
    for (const file of newMediaFiles) {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("Videos").upload(fileName, file, { contentType: file.type });
      if (upErr) { alert("파일 업로드 실패: " + upErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("Videos").getPublicUrl(fileName);
      uploadedUrls.push(publicUrl);
    }
    const finalUrls = [...editMediaUrls, ...uploadedUrls];
    const { data, error } = await supabase
      .from("posts")
      .update({ description: editDescription, media_urls: finalUrls })
      .eq("id", selectedPost.id)
      .select();
    if (error) { alert("수정 실패: " + error.message); return; }
    if (!data || data.length === 0) { alert("수정 권한 없음 — Supabase에서 RLS를 꺼주세요.\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;"); return; }
    setMyPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, description: editDescription, media_urls: finalUrls } : p));
    setShowPostModal(false);
  }

  async function handleDeletePost() {
    if (!selectedPost) return;
    const { data, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", selectedPost.id)
      .select();
    if (error) { alert("삭제 실패: " + error.message); return; }
    if (!data || data.length === 0) { alert("삭제 권한 없음 — Supabase에서 RLS를 꺼주세요.\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;"); return; }
    setMyPosts(prev => prev.filter(p => p.id !== selectedPost.id));
    setShowPostModal(false);
  }

  const signupDate = user?.created_at ? new Date(user.created_at) : new Date();
  const _now = new Date();
  const _todayMid = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
  const _signupMid = new Date(signupDate.getFullYear(), signupDate.getMonth(), signupDate.getDate());
  const daysSince = Math.max(1, Math.floor((_todayMid - _signupMid) / (1000 * 60 * 60 * 24)) + 1);

  const gradeCounts = GRADES.map(g => ({
    grade: g,
    count: records.filter(r => r.grade === g && r.result === "성공").length,
  }));
  const maxCount = Math.max(...gradeCounts.map(g => g.count), 1);
  const hasGradeData = gradeCounts.some(g => g.count > 0);

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const toDateStr = d => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const calCells = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

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
          <div className="profile-avatar-edit">+</div>
        </div>
        <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
        {editingNickname ? (
          <input
            className="bio-input"
            value={nicknameInput}
            onChange={e => setNicknameInput(e.target.value)}
            onBlur={handleNicknameChange}
            onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && e.currentTarget.blur()}
            autoFocus
            style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}
          />
        ) : (
          <div className="profile-name" onClick={() => { setNicknameInput(myName); setEditingNickname(true); }}
            style={{ cursor: "pointer" }}>
            {myName} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>수정</span>
          </div>
        )}
        {/* @아이디 */}
        {editingTag ? (
          <input
            className="bio-input"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onBlur={handleTagSave}
            onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && e.currentTarget.blur()}
            placeholder="아이디 입력 (@ 제외)"
            autoFocus
            style={{ fontSize: 13, textAlign: "center", color: "var(--accent)" }}
          />
        ) : (
          <div
            onClick={() => { setTagInput(userTag || ""); setEditingTag(true); }}
            style={{ fontSize: 13, color: userTag ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", marginBottom: 4 }}>
            {userTag ? `@${userTag}` : <span>+ 아이디 설정 <span style={{ fontSize: 10 }}>수정</span></span>}
            {userTag && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>수정</span>}
          </div>
        )}

        {editingBio ? (
          <input
            className="bio-input"
            placeholder="한줄 소개를 입력해보세요"
            value={bio}
            onChange={e => setBio(e.target.value)}
            onBlur={() => { setEditingBio(false); localStorage.setItem(`bio_${user.id}`, bio); }}
            onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && e.currentTarget.blur()}
            autoFocus
          />
        ) : (
          <div className="profile-bio" onClick={() => setEditingBio(true)}>
            {bio || <span style={{ color: "var(--text-muted)", fontSize: 12 }}>+ 한줄 소개</span>}
          </div>
        )}

        <div className="stats-row stats-row-4">
          <div className="stat-item">
            <span className="stat-val">{followerCount}</span>
            <span className="stat-label">팔로워</span>
          </div>
          <div className="stat-item stat-clickable" onClick={() => setShowFriendModal(true)}>
            <span className="stat-val" style={{ position: "relative" }}>
              {friendCount}
              {pendingFollowers.length > 0 && (
                <span style={{ position: "absolute", top: -4, right: -10, background: "var(--accent)", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 6, padding: "1px 4px", lineHeight: 1.4 }}>
                  +{pendingFollowers.length}
                </span>
              )}
            </span>
            <span className="stat-label">클친</span>
          </div>
          <div className="stat-item stat-clickable" onClick={() => setShowMemberModal(true)}>
            <span className="stat-val">{memberships.length || "+"}</span>
            <span className="stat-label">회원권</span>
          </div>
          <div className="stat-item stat-clickable" onClick={() => setShowSettingModal(true)}>
            <span className="stat-val">{settingDates.length || "+"}</span>
            <span className="stat-label">세팅일정</span>
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
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0 20px", fontSize: 13 }}>
          피드에 올린 게시물이 여기 표시돼요
        </div>
      ) : (
        <div className="post-grid">
          {myPosts.map(p => {
            const thumb = p.media_urls?.[0] || p.video_url;
            const isVid = thumb && /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(thumb);
            return (
              <div className="post-grid-item" key={p.id} onClick={() => openPostModal(p)}>
                {thumb ? (
                  isVid ? (
                    <video src={thumb} className="post-grid-thumb" muted />
                  ) : (
                    <img src={thumb} alt="" className="post-grid-thumb" />
                  )
                ) : (
                  <div className="post-grid-placeholder">
                    <span style={{ fontSize: 22 }}>📝</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>텍스트</span>
                  </div>
                )}
                <div className="post-grid-overlay">···</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 내 커뮤니티 글 */}
      <p className="section-title">내 커뮤니티 글</p>
      {myMeetups.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0 20px", fontSize: 13 }}>
          커뮤니티에 쓴 글이 여기 표시돼요
        </div>
      ) : (
        <div className="card" style={{ padding: "4px 0" }}>
          {myMeetups.slice(0, meetupsExpanded ? myMeetups.length : 3).map((m, i) => (
            <div key={m.id} onClick={() => openMeetupModal(m)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: i < (meetupsExpanded ? myMeetups.length : Math.min(3, myMeetups.length)) - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <span className="community-category-chip" style={{ fontSize: 10, flexShrink: 0 }}>{m.activity || "자유"}</span>
                <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.gym}</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{new Date(m.created_at).toLocaleDateString("ko-KR")}</span>
            </div>
          ))}
          {myMeetups.length > 3 && (
            <div onClick={() => setMeetupsExpanded(prev => !prev)}
              style={{ textAlign: "center", padding: "10px", fontSize: 13, color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>
              {meetupsExpanded ? "접기" : `더보기 +${myMeetups.length - 3}개`}
            </div>
          )}
        </div>
      )}

      {/* 달력 */}
      <p className="section-title">내 운동 기록</p>
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
            const record = climbedDates[ds];
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
            return (
              <div key={i}
                className={`cal-cell${record ? " climbed" : ""}${isToday && !record ? " today" : ""}`}
                onClick={() => {
                  setSelectedCalDay(ds);
                  setCalForm(record
                    ? { gym: record.gym, memo: record.memo, duration: record.duration, condition: record.condition }
                    : { gym: "", memo: "", duration: "1시간", condition: "😐" });
                  setShowCalModal(true);
                }}>
                {record ? <span className="cal-emoji">{record.condition}</span> : d}
              </div>
            );
          })}
        </div>
      </div>

      {/* D+ 카드 */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "16px 20px" }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)" }}>D+{daysSince}</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>클라이밍 시작일부터</span>
      </div>

      {/* 클친 신청 모달 */}
      {showFriendModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowFriendModal(false); }}>
          <div className="modal-sheet">
            <h3>클친 신청 {pendingFollowers.length > 0 ? `(${pendingFollowers.length})` : ""}</h3>
            {pendingFollowers.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0 8px" }}>새로운 클친 신청이 없어요</div>
            ) : (
              pendingFollowers.map(f => (
                <div key={f.follower} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 600 }}>{f.follower}</span>
                  <button className="btn btn-primary" style={{ padding: "5px 14px", fontSize: 13 }}
                    onClick={() => handleAcceptFollow(f.follower)}>수락</button>
                </div>
              ))
            )}
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowFriendModal(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

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
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing && memberInput.trim()) { saveMemberships([...memberships, memberInput.trim()]); setMemberInput(""); } }} />
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
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing && settingInput.trim()) { saveSettingDates([...settingDates, settingInput.trim()]); setSettingInput(""); } }} />
              <button className="btn btn-primary" style={{ padding: "0 14px", flexShrink: 0 }}
                onClick={() => { if (settingInput.trim()) { saveSettingDates([...settingDates, settingInput.trim()]); setSettingInput(""); } }}>추가</button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowSettingModal(false); setSettingInput(""); }}>완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 달력 기록 모달 */}
      {showCalModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCalModal(false); }}>
          <div className="modal-sheet">
            <h3>{climbedDates[selectedCalDay]?.id ? "📅 기록 수정" : "🧗 기록 추가"} · {selectedCalDay}</h3>
            <div className="form-group">
              <label>암장</label>
              <input className="form-input" placeholder="예) 더클라임 연남" value={calForm.gym}
                onChange={e => setCalForm(p => ({ ...p, gym: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>메모</label>
              <input className="form-input" placeholder="오늘 클라이밍은 어땠나요?"
                value={calForm.memo}
                onChange={e => setCalForm(p => ({ ...p, memo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>운동 시간</label>
              <select className="form-input" value={calForm.duration}
                onChange={e => setCalForm(p => ({ ...p, duration: e.target.value }))}>
                {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>컨디션</label>
              <div className="condition-picker">
                {CONDITIONS.map(c => (
                  <button key={c}
                    className={`condition-btn${calForm.condition === c ? " selected" : ""}`}
                    onClick={() => setCalForm(p => ({ ...p, condition: c }))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              {climbedDates[selectedCalDay]?.id && (
                <button className="btn btn-ghost" style={{ color: "#ff5050", borderColor: "#ff5050" }}
                  onClick={handleDeleteCalRecord}>삭제</button>
              )}
              <button className="btn btn-ghost" onClick={() => setShowCalModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleCalRecord}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 커뮤니티 글 수정/삭제 모달 */}
      {showMeetupModal && selectedMeetup && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowMeetupModal(false); }}>
          <div className="modal-sheet">
            <h3>💬 커뮤니티 글 관리</h3>
            <div className="form-group">
              <label>카테고리</label>
              <div className="category-picker">
                {["번개모임", "질문", "후기", "크루모집", "자유"].map(c => (
                  <button key={c}
                    className={`filter-chip${editMeetupCategory === c ? " active" : ""}`}
                    onClick={() => setEditMeetupCategory(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>제목</label>
              <input className="form-input" value={editMeetupTitle}
                onChange={e => setEditMeetupTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label>내용</label>
              <textarea className="form-input" rows={3} value={editMeetupContent}
                onChange={e => setEditMeetupContent(e.target.value)}
                style={{ resize: "none" }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" style={{ color: "#ff5050", borderColor: "#ff5050" }}
                onClick={handleDeleteMeetup}>삭제</button>
              <button className="btn btn-ghost" onClick={() => setShowMeetupModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleEditMeetup}>수정 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 게시물 수정/삭제 모달 */}
      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPostModal(false); }}>
          <div className="modal-sheet">
            <h3>📝 게시물 관리</h3>
            <div className="form-group">
              <label>사진 / 영상</label>
              <div className="media-upload-row">
                {editMediaUrls.map((url, i) => {
                  const isVid = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url);
                  return (
                    <div key={`ex-${i}`} className="media-preview-item">
                      {isVid
                        ? <video src={url} className="media-preview-thumb" />
                        : <img src={url} alt="" className="media-preview-thumb" />}
                      <button className="media-preview-del"
                        onClick={() => setEditMediaUrls(prev => prev.filter((_, j) => j !== i))}>×</button>
                    </div>
                  );
                })}
                {newMediaFiles.map((f, i) => (
                  <div key={`new-${i}`} className="media-preview-item">
                    {f.type.startsWith("video")
                      ? <video src={URL.createObjectURL(f)} className="media-preview-thumb" />
                      : <img src={URL.createObjectURL(f)} alt="" className="media-preview-thumb" />}
                    <button className="media-preview-del"
                      onClick={() => setNewMediaFiles(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                {(editMediaUrls.length + newMediaFiles.length) < 10 && (
                  <div className="media-add-btn" onClick={() => editFileRef.current?.click()}>
                    <span style={{ fontSize: 22 }}>+</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{editMediaUrls.length + newMediaFiles.length}/10</span>
                  </div>
                )}
              </div>
              <input ref={editFileRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }}
                onChange={e => setNewMediaFiles(prev =>
                  [...prev, ...Array.from(e.target.files)].slice(0, 10 - editMediaUrls.length))} />
            </div>
            <div className="form-group">
              <label>상세</label>
              <textarea className="form-input" rows={3} value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                style={{ resize: "none" }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" style={{ color: "#ff5050", borderColor: "#ff5050" }}
                onClick={handleDeletePost}>삭제</button>
              <button className="btn btn-ghost" onClick={() => setShowPostModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleEditPost}>수정 완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
