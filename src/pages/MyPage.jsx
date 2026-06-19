// ─────────────────────────────────────────────
// MyPage.jsx
// 마이페이지 - 가장 복잡한 페이지.
//
// 구성 섹션 (위에서 아래 순서):
//   1. 프로필 카드 (사진/닉네임/@아이디/한줄소개/통계)
//   2. 완등 난이도 분포 막대 그래프
//   3. 내 게시물 그리드 (클릭하면 수정/삭제 모달)
//   4. 내 커뮤니티 글 목록 (최대 3개 + 더보기)
//   5. 운동 달력 (날짜 클릭하면 기록 추가/수정)
//   6. D+ 카드 (클라이밍 시작일로부터 경과일)
//
// 모달 목록:
//   팔로잉 목록 / 클친+신청 대기 / 회원권 / 세팅일정 / 달력 기록 / 커뮤니티 글 편집 / 피드 게시물 편집
//
// 팔로우 시스템 (follows 테이블):
//   - 팔로잉 수 = 내가 follower인 모든 행 수 (pending + accepted)
//   - 클친 수 = 내가 follower이면서 status='accepted'인 행 수
//   - 신청 대기 = 나를 following으로 가진 pending 행들
//   - 수락 시: 상대방 행을 accepted로 업데이트 + 나→상대방 행도 accepted로 upsert
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// 난이도 그래프에 사용하는 볼더링 등급 목록
const GRADES = ["V0","V1","V2","V3","V4","V5","V6","V7","V8+"];
// 달력 기록의 컨디션 이모지 옵션
const CONDITIONS = ["😫", "😕", "😐", "🙂", "😄"];

// 운동 시간 선택 옵션: 10분~300분을 10분 단위로 한국어 표기로 변환
// (예: 90 → "1시간 30분")
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
  // 닉네임: Google 계정이면 user_metadata.name, 이메일이면 이메일 앞부분
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  // 파일 선택 input 참조 (숨긴 input을 클릭 트리거로 사용)
  const imgInputRef = useRef(null);  // 프로필 사진 변경
  const editFileRef = useRef(null);  // 게시물 편집 시 미디어 추가

  // ── 프로필 상태 ──────────────────────────────────────────────────
  const [bio, setBio] = useState("");                        // 한줄 소개
  const [editingBio, setEditingBio] = useState(false);       // 한줄 소개 편집 모드
  const [editingNickname, setEditingNickname] = useState(false); // 닉네임 편집 모드
  const [nicknameInput, setNicknameInput] = useState("");    // 닉네임 입력값
  const [heightCm, setHeightCm] = useState("");              // 신장 (cm)
  const [weightKg, setWeightKg] = useState("");              // 몸무게 (kg)
  const [editingHeight, setEditingHeight] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);

  // ── 회원권 & 세팅일정 상태 (localStorage 기반) ───────────────────
  const [memberships, setMemberships] = useState([]);        // 회원권 목록 (문자열 배열)
  const [settingDates, setSettingDates] = useState([]);      // 세팅일정 목록 (문자열 배열)
  const [showMemberModal, setShowMemberModal] = useState(false);   // 회원권 모달
  const [showSettingModal, setShowSettingModal] = useState(false);  // 세팅일정 모달
  const [memberInput, setMemberInput] = useState("");        // 회원권 추가 입력값
  const [settingInput, setSettingInput] = useState("");      // 세팅일정 추가 입력값

  // ── 운동 기록 & 커뮤니티 상태 ────────────────────────────────────
  const [records, setRecords] = useState([]);                // 나의 운동 기록 전체 (난이도 그래프용)
  const [friendCount, setFriendCount] = useState(0);         // 클친(accepted 팔로우) 수
  const [myPosts, setMyPosts] = useState([]);                // 내 피드 게시물
  const [myMeetups, setMyMeetups] = useState([]);            // 내 커뮤니티 게시글
  const [showPostModal, setShowPostModal] = useState(false);  // 게시물 편집 모달
  const [showMeetupModal, setShowMeetupModal] = useState(false); // 커뮤니티 글 편집 모달
  const [selectedMeetup, setSelectedMeetup] = useState(null); // 편집 중인 커뮤니티 글
  const [editMeetupTitle, setEditMeetupTitle] = useState(""); // 커뮤니티 글 편집 - 제목
  const [editMeetupContent, setEditMeetupContent] = useState(""); // 커뮤니티 글 편집 - 내용
  const [editMeetupCategory, setEditMeetupCategory] = useState("자유"); // 커뮤니티 글 편집 - 카테고리

  // ── @아이디 & 팔로우 상태 ────────────────────────────────────────
  const [userTag, setUserTag] = useState("");                // 현재 @아이디
  const [editingTag, setEditingTag] = useState(false);       // @아이디 편집 모드
  const [tagInput, setTagInput] = useState("");              // @아이디 입력값
  const [followingCount, setFollowingCount] = useState(0);   // 내가 팔로우한 수 (pending + accepted)
  const [myFollowingsList, setMyFollowingsList] = useState([]); // 내 팔로잉 목록 (following+status)
  const [pendingFollowers, setPendingFollowers] = useState([]); // 나를 팔로우 신청한 사람 목록
  const [followAvatarMap, setFollowAvatarMap] = useState({}); // 팔로우 관련 유저 프로필 사진 map
  const [showFriendModal, setShowFriendModal] = useState(false); // 클친 모달
  const [showFollowingModal, setShowFollowingModal] = useState(false); // 팔로잉 목록 모달
  const [meetupsExpanded, setMeetupsExpanded] = useState(false); // 커뮤니티 글 더보기 펼침 여부
  const [followRefreshKey, setFollowRefreshKey] = useState(0); // 팔로우 데이터 강제 재로드 트리거

  // ── 게시물 편집 상태 ─────────────────────────────────────────────
  const [selectedPost, setSelectedPost] = useState(null);    // 편집 중인 게시물
  const [editDescription, setEditDescription] = useState(""); // 편집 중인 게시물 설명
  const [editMediaUrls, setEditMediaUrls] = useState([]);    // 기존 미디어 URL 목록 (삭제 가능)
  const [newMediaFiles, setNewMediaFiles] = useState([]);    // 새로 추가할 파일 목록

  // ── 달력 상태 ─────────────────────────────────────────────────────
  const [calDate, setCalDate] = useState(new Date());        // 달력에 표시 중인 년월
  const [climbedDates, setClimbedDates] = useState({});      // 날짜 문자열 → 기록 객체 {id, condition, gym, memo, duration}
  const [showCalModal, setShowCalModal] = useState(false);   // 달력 기록 모달
  const [selectedCalDay, setSelectedCalDay] = useState(""); // 클릭한 날짜 문자열 (YYYY-MM-DD)
  const [calForm, setCalForm] = useState({ gym: "", memo: "", duration: "1시간", condition: "😐" }); // 기록 입력 폼

  // ── 초기 데이터 로드 ─────────────────────────────────────────────
  // user가 세팅되면 (로그인 완료 후) 모든 데이터를 불러온다.
  useEffect(() => {
    if (!user) return;
    // localStorage에서 회원권/세팅일정/소개/신장/몸무게 복원
    const savedMem = localStorage.getItem(`memberships_${user.id}`);
    if (savedMem) setMemberships(JSON.parse(savedMem));
    const savedSet = localStorage.getItem(`settingDates_${user.id}`);
    if (savedSet) setSettingDates(JSON.parse(savedSet));
    const savedBio = localStorage.getItem(`bio_${user.id}`) || "";
    setBio(savedBio);
    const savedH = localStorage.getItem(`height_${user.id}`);
    if (savedH) setHeightCm(savedH);
    const savedW = localStorage.getItem(`weight_${user.id}`);
    if (savedW) setWeightKg(savedW);
    // DB에서 나머지 데이터 로드
    loadRecords();
    loadMyPosts();
    loadMyMeetups();
    loadClimbedDates();
    loadFollows();
    loadUserTag();
    upsertProfile(); // profiles 테이블에 내 레코드 보장 (다른 유저가 검색할 수 있도록)
  }, [user]);

  // 팔로우 모달이 열릴 때 + followRefreshKey가 바뀔 때 (새로고침 버튼) 재로드
  // 모달을 열 때 항상 최신 데이터를 보여준다.
  useEffect(() => {
    if (showFriendModal || showFollowingModal) loadFollows();
  }, [showFriendModal, showFollowingModal, followRefreshKey]);

  // 다른 탭에서 돌아오면 팔로우 데이터 재로드
  // (상대방이 팔로우를 수락한 경우 최신 상태 반영)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") loadFollows();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // profiles 테이블에 내 user_name 레코드를 보장 + 신장/몸무게 로드
  // upsert와 select를 분리 — 체이닝 시 Supabase v2에서 반환값 불안정
  async function upsertProfile() {
    if (!myName) return;
    await supabase.from("profiles").upsert({ user_name: myName }, { onConflict: "user_name" });
    const { data } = await supabase
      .from("profiles")
      .select("height_cm, weight_kg")
      .eq("user_name", myName)
      .maybeSingle();
    if (data?.height_cm) setHeightCm(String(data.height_cm));
    if (data?.weight_kg) setWeightKg(String(data.weight_kg));
  }

  async function saveHeight(val) {
    setEditingHeight(false);
    const num = parseInt(val, 10);
    if (!num || num < 50 || num > 250) return;
    setHeightCm(String(num));
    localStorage.setItem(`height_${user.id}`, String(num)); // 로컬 저장 (DB 실패해도 유지)
    await supabase.from("profiles").upsert({ user_name: myName, height_cm: num }, { onConflict: "user_name" });
  }

  async function saveWeight(val) {
    setEditingWeight(false);
    const num = parseInt(val, 10);
    if (!num || num < 20 || num > 300) return;
    setWeightKg(String(num));
    localStorage.setItem(`weight_${user.id}`, String(num)); // 로컬 저장
    await supabase.from("profiles").upsert({ user_name: myName, weight_kg: num }, { onConflict: "user_name" });
  }

  // ── 팔로우 데이터 로드 ────────────────────────────────────────────
  // follows 테이블에서 두 쿼리를 병렬로 실행:
  //   - 나를 following으로 가진 행들 → 팔로워 목록 (수락 대기 포함)
  //   - 내가 follower인 행들 → 내 팔로잉 목록
  async function loadFollows() {
    const [{ data: allFollowers }, { data: allMyFollowings }] = await Promise.all([
      supabase.from("follows").select("follower, status").eq("following", myName),
      supabase.from("follows").select("following, status").eq("follower", myName),
    ]);
    const followingsList = allMyFollowings || [];
    const followersList = allFollowers || [];
    setFollowingCount(followingsList.length);       // 팔로잉 수 = pending + accepted
    setMyFollowingsList(followingsList);
    setFriendCount(followingsList.filter(f => f.status === "accepted").length); // 클친 수 = accepted만
    setPendingFollowers(followersList.filter(f => f.status === "pending"));    // 수락 대기 신청자들

    // 팔로잉 목록 + 신청 대기자들의 프로필 사진을 한 번에 로드
    const names = [
      ...followingsList.map(f => f.following),
      ...followersList.filter(f => f.status === "pending").map(f => f.follower),
    ].filter(Boolean);
    if (names.length) {
      const { data: profs } = await supabase.from("profiles").select("user_name, avatar_url").in("user_name", names);
      const map = {};
      profs?.forEach(p => { if (p.avatar_url) map[p.user_name] = p.avatar_url; });
      setFollowAvatarMap(map);
    }
  }

  // ── 운동 기록 로드 (난이도 그래프용) ─────────────────────────────
  async function loadRecords() {
    const { data } = await supabase
      .from("records")
      .select("*")
      .eq("user_name", myName)
      .order("climbed_at", { ascending: false });
    setRecords(data || []);
  }

  // ── 내 피드 게시물 로드 ───────────────────────────────────────────
  // user_id 기반 검색이 기본이지만, 과거에 user_id 없이 저장된 게시물도 포함
  async function loadMyPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .or(`user_id.eq.${user.id},and(user_id.is.null,user_name.eq.${myName})`)
      .order("created_at", { ascending: false });
    setMyPosts(data || []);
  }

  // ── 내 커뮤니티 게시글 로드 ──────────────────────────────────────
  // meet_time 컬럼이 작성자 닉네임으로 사용됨 (DB 컬럼명 주의)
  async function loadMyMeetups() {
    const { data } = await supabase
      .from("meetups")
      .select("*")
      .eq("meet_time", myName)
      .order("created_at", { ascending: false });
    setMyMeetups(data || []);
  }

  // ── 커뮤니티 글 편집 모달 열기 ───────────────────────────────────
  function openMeetupModal(meetup) {
    setSelectedMeetup(meetup);
    setEditMeetupTitle(meetup.gym || "");
    setEditMeetupContent(meetup.description || "");
    setEditMeetupCategory(meetup.activity || "자유");
    setShowMeetupModal(true);
  }

  // ── 커뮤니티 글 수정 저장 ────────────────────────────────────────
  async function handleEditMeetup() {
    if (!selectedMeetup || !editMeetupTitle.trim()) return;
    const { error } = await supabase
      .from("meetups")
      .update({ gym: editMeetupTitle, description: editMeetupContent, activity: editMeetupCategory })
      .eq("id", selectedMeetup.id);
    if (error) { alert("수정 실패: " + error.message); return; }
    // DB 재조회 없이 로컬 state만 업데이트 (UX 반응성)
    setMyMeetups(prev => prev.map(m => m.id === selectedMeetup.id
      ? { ...m, gym: editMeetupTitle, description: editMeetupContent, activity: editMeetupCategory }
      : m));
    setShowMeetupModal(false);
  }

  // ── @아이디(user_tag) 로드 ────────────────────────────────────────
  async function loadUserTag() {
    const { data } = await supabase.from("profiles").select("user_tag").eq("user_name", myName).maybeSingle();
    setUserTag(data?.user_tag || "");
  }

  // ── @아이디 저장 ──────────────────────────────────────────────────
  // 앞의 @와 공백을 제거하고, 중복 여부를 확인한 후 저장.
  // user_tag는 UNIQUE 컬럼이므로 중복이면 Supabase 오류 없이 JS에서 미리 막음.
  async function handleTagSave() {
    const trimmed = tagInput.trim().replace(/^@/, "").replace(/\s+/g, "");
    setEditingTag(false);
    if (!trimmed || trimmed === userTag) return; // 변경 없으면 무시
    // 다른 유저가 이미 사용 중인지 확인
    const { data: existing } = await supabase.from("profiles").select("user_name").eq("user_tag", trimmed).neq("user_name", myName).maybeSingle();
    if (existing) { alert("이미 사용 중인 아이디입니다."); return; }
    await supabase.from("profiles").upsert({ user_name: myName, user_tag: trimmed }, { onConflict: "user_name" });
    setUserTag(trimmed);
  }

  // ── 팔로우 수락 ───────────────────────────────────────────────────
  // 1. 상대방이 보낸 팔로우 신청(pending)을 accepted로 업데이트
  // 2. 나→상대방 방향의 accepted 행도 upsert (클친 = 양방향 accepted)
  // 3. 로컬 state 즉시 업데이트 (재로드 없이)
  async function handleAcceptFollow(followerName) {
    // 상대방 행: pending → accepted
    await supabase.from("follows").update({ status: "accepted" }).eq("follower", followerName).eq("following", myName);
    // 내 행: 나→상대방 accepted (없으면 insert, 있으면 update)
    await supabase.from("follows").upsert({ follower: myName, following: followerName, status: "accepted" }, { onConflict: "follower,following" });
    setPendingFollowers(prev => prev.filter(f => f.follower !== followerName)); // 신청 목록에서 제거
    setFriendCount(prev => prev + 1); // 클친 수 즉시 증가
  }

  // ── 커뮤니티 글 삭제 ─────────────────────────────────────────────
  async function handleDeleteMeetup() {
    if (!selectedMeetup) return;
    const { error } = await supabase.from("meetups").delete().eq("id", selectedMeetup.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    setMyMeetups(prev => prev.filter(m => m.id !== selectedMeetup.id));
    setShowMeetupModal(false);
  }

  // ── 달력 기록 로드 ────────────────────────────────────────────────
  // records 테이블에서 result='' 인 행을 달력 표시용으로 사용.
  // (result='성공'/'실패'는 기록 레코드, result=''은 달력 기록)
  async function loadClimbedDates() {
    const { data } = await supabase
      .from("records")
      .select("id, climbed_at, condition, gym, memo, duration")
      .eq("user_name", myName)
      .eq("result", ""); // 달력 기록만 필터링
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
    setClimbedDates(map); // 날짜 문자열 → 기록 객체
  }

  // 프로필 사진 영역 클릭 시 파일 선택창 열기
  function handleProfileImageClick() { imgInputRef.current?.click(); }

  // 파일 선택 후 AuthContext의 updateProfileImg 호출 (Storage 업로드 + DB 저장)
  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await updateProfileImg(file);
    } catch (err) {
      alert("사진 업로드 실패: " + err.message);
    }
  }

  // ── 닉네임 변경 ───────────────────────────────────────────────────
  // AuthContext.updateNickname을 호출 → Auth 메타데이터 + 관련 DB 테이블 일괄 변경
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

  // 회원권 목록 저장 (state + localStorage 동시 업데이트)
  function saveMemberships(list) {
    setMemberships(list);
    localStorage.setItem(`memberships_${user.id}`, JSON.stringify(list));
  }

  // 세팅일정 목록 저장 (state + localStorage 동시 업데이트)
  function saveSettingDates(list) {
    setSettingDates(list);
    localStorage.setItem(`settingDates_${user.id}`, JSON.stringify(list));
  }

  // ── 달력 기록 저장/수정 ───────────────────────────────────────────
  // 해당 날짜에 기록이 있으면 update, 없으면 insert
  async function handleCalRecord() {
    const existing = climbedDates[selectedCalDay];
    if (existing?.id) {
      // 기존 기록 수정
      const { error } = await supabase.from("records").update({
        gym: calForm.gym, memo: calForm.memo, duration: calForm.duration, condition: calForm.condition,
      }).eq("id", existing.id);
      if (error) { alert("수정 실패: " + error.message); return; }
    } else {
      // 새 기록 추가
      const { error } = await supabase.from("records").insert({
        user_name: myName, gym: calForm.gym || "", grade: "", result: "",
        climbed_at: selectedCalDay, memo: calForm.memo, duration: calForm.duration, condition: calForm.condition,
      });
      if (error) { alert("저장 실패: " + error.message); return; }
    }
    setShowCalModal(false);
    setCalForm({ gym: "", memo: "", duration: "1시간", condition: "😐" }); // 폼 초기화
    loadClimbedDates(); // 달력 갱신
  }

  // 달력 기록 삭제
  async function handleDeleteCalRecord() {
    const existing = climbedDates[selectedCalDay];
    if (!existing?.id) return;
    await supabase.from("records").delete().eq("id", existing.id);
    setShowCalModal(false);
    loadClimbedDates();
  }

  // ── 피드 게시물 편집 모달 열기 ───────────────────────────────────
  function openPostModal(post) {
    setSelectedPost(post);
    setEditDescription(post.description || "");
    // 구버전 호환: media_urls 없으면 video_url 사용
    setEditMediaUrls(post.media_urls || (post.video_url ? [post.video_url] : []));
    setNewMediaFiles([]);
    setShowPostModal(true);
  }

  // ── 피드 게시물 수정 저장 ────────────────────────────────────────
  // 새로 추가된 파일들을 Storage에 업로드한 후,
  // 기존 URL + 새 URL을 합쳐서 DB에 저장
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
    const finalUrls = [...editMediaUrls, ...uploadedUrls]; // 기존 + 신규 URL 합치기
    const { data, error } = await supabase
      .from("posts")
      .update({ description: editDescription, media_urls: finalUrls })
      .eq("id", selectedPost.id)
      .select(); // select()가 없으면 RLS 차단 여부를 감지할 수 없음
    if (error) { alert("수정 실패: " + error.message); return; }
    // RLS가 켜져 있으면 data는 빈 배열로 반환됨 (실제 업데이트는 0건)
    if (!data || data.length === 0) { alert("수정 권한 없음 — Supabase에서 RLS를 꺼주세요.\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;"); return; }
    setMyPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, description: editDescription, media_urls: finalUrls } : p));
    setShowPostModal(false);
  }

  // ── 피드 게시물 삭제 ─────────────────────────────────────────────
  async function handleDeletePost() {
    if (!selectedPost) return;
    const { data, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", selectedPost.id)
      .select(); // RLS 차단 감지를 위해 select() 필요
    if (error) { alert("삭제 실패: " + error.message); return; }
    if (!data || data.length === 0) { alert("삭제 권한 없음 — Supabase에서 RLS를 꺼주세요.\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;"); return; }
    setMyPosts(prev => prev.filter(p => p.id !== selectedPost.id));
    setShowPostModal(false);
  }

  // ── D+ 계산 ───────────────────────────────────────────────────────
  // 가입일(user.created_at)을 시작일로 D+N 계산.
  // 자정 기준으로 날짜를 맞춰야 시차 오차가 없다.
  const signupDate = user?.created_at ? new Date(user.created_at) : new Date();
  const _now = new Date();
  const _todayMid = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());         // 오늘 00:00
  const _signupMid = new Date(signupDate.getFullYear(), signupDate.getMonth(), signupDate.getDate()); // 가입일 00:00
  const daysSince = Math.max(1, Math.floor((_todayMid - _signupMid) / (1000 * 60 * 60 * 24)) + 1);

  // ── 난이도 그래프 데이터 ──────────────────────────────────────────
  // 각 등급별 완등 횟수 집계 + 최대값(비율 계산용)
  const gradeCounts = GRADES.map(g => ({
    grade: g,
    count: records.filter(r => r.grade === g && r.result === "성공").length,
  }));
  const maxCount = Math.max(...gradeCounts.map(g => g.count), 1); // 0으로 나누기 방지
  const hasGradeData = gradeCounts.some(g => g.count > 0);

  // ── 달력 데이터 계산 ──────────────────────────────────────────────
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 해당 월 1일의 요일 (0=일)
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // 해당 월의 마지막 날
  const today = new Date();
  // 날짜 숫자 → "YYYY-MM-DD" 문자열 변환 함수
  const toDateStr = d => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // 달력 칸 배열: 1일 전에 빈 칸(null)을 채워 요일을 맞춤
  const calCells = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="page">
      {/* ── 프로필 카드 ── */}
      <div className="profile-card">
        {/* 프로필 사진 (클릭 시 파일 선택) */}
        <div className="profile-avatar-wrap" onClick={handleProfileImageClick}>
          {profileImg ? (
            <img src={profileImg} alt="profile" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar">🧗</div>
          )}
          <div className="profile-avatar-edit">+</div>
        </div>
        {/* 파일 선택 input (숨김) */}
        <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />

        {/* 닉네임 (클릭 시 인라인 편집) */}
        {editingNickname ? (
          <input
            className="bio-input"
            value={nicknameInput}
            onChange={e => setNicknameInput(e.target.value)}
            onBlur={handleNicknameChange}
            // 한글 조합 완료 후 Enter로 blur (isComposing 체크)
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

        {/* @아이디 (클릭 시 인라인 편집) */}
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

        {/* 한줄 소개 (클릭 시 인라인 편집, localStorage 저장) */}
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

        {/* 통계 4칸: 팔로잉 / 클친 / 회원권 / 세팅일정 */}
        <div className="stats-row stats-row-4">
          {/* 팔로잉: 클릭 시 팔로잉 목록 모달 */}
          <div className="stat-item stat-clickable" onClick={() => setShowFollowingModal(true)}>
            <span className="stat-val">{followingCount}</span>
            <span className="stat-label">팔로잉</span>
          </div>
          {/* 클친: 클릭 시 클친+신청 대기 모달. 신청 대기 있으면 빨간 뱃지 표시 */}
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
          {/* 회원권: 클릭 시 회원권 목록 모달 */}
          <div className="stat-item stat-clickable" onClick={() => setShowMemberModal(true)}>
            <span className="stat-val">{memberships.length || "+"}</span>
            <span className="stat-label">회원권</span>
          </div>
          {/* 세팅일정: 클릭 시 세팅일정 목록 모달 */}
          <div className="stat-item stat-clickable" onClick={() => setShowSettingModal(true)}>
            <span className="stat-val">{settingDates.length || "+"}</span>
            <span className="stat-label">세팅일정</span>
          </div>
        </div>

        {/* 신장 / 몸무게 */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, width: "100%" }}>
          <div
            onClick={() => setEditingHeight(true)}
            style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "10px 8px", textAlign: "center", cursor: "pointer", border: "1px solid var(--border)" }}>
            {editingHeight ? (
              <input
                type="number" defaultValue={heightCm}
                onBlur={e => saveHeight(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && e.currentTarget.blur()}
                autoFocus
                style={{ width: "52px", background: "transparent", border: "none", outline: "none", color: "var(--text)", textAlign: "center", fontSize: 15, fontWeight: 700 }}
              />
            ) : (
              <span style={{ fontSize: 15, fontWeight: 700, color: heightCm ? "var(--text)" : "var(--text-muted)" }}>
                {heightCm ? `${heightCm}` : "+"}
              </span>
            )}
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>신장 (cm)</div>
          </div>
          <div
            onClick={() => setEditingWeight(true)}
            style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "10px 8px", textAlign: "center", cursor: "pointer", border: "1px solid var(--border)" }}>
            {editingWeight ? (
              <input
                type="number" defaultValue={weightKg}
                onBlur={e => saveWeight(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && e.currentTarget.blur()}
                autoFocus
                style={{ width: "52px", background: "transparent", border: "none", outline: "none", color: "var(--text)", textAlign: "center", fontSize: 15, fontWeight: 700 }}
              />
            ) : (
              <span style={{ fontSize: 15, fontWeight: 700, color: weightKg ? "var(--text)" : "var(--text-muted)" }}>
                {weightKg ? `${weightKg}` : "+"}
              </span>
            )}
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>몸무게 (kg)</div>
          </div>
        </div>
      </div>

      {/* ── 완등 난이도 분포 (기록 있을 때만 표시) ── */}
      {hasGradeData && (
        <div className="card">
          <p className="section-title">완등 난이도 분포</p>
          {gradeCounts.filter(g => g.count > 0).reverse().map(g => ( // 높은 등급이 위로
            <div className="level-bar-row" key={g.grade}>
              <span className="level-label">{g.grade}</span>
              <div className="level-bar-bg">
                {/* 최대값 기준 비율로 막대 너비 계산 */}
                <div className="level-bar-fill" style={{ width: `${(g.count / maxCount) * 100}%` }} />
              </div>
              <span className="level-count">{g.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 내 피드 게시물 그리드 ── */}
      <p className="section-title">내 게시물</p>
      {myPosts.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0 20px", fontSize: 13 }}>
          피드에 올린 게시물이 여기 표시돼요
        </div>
      ) : (
        <div className="post-grid">
          {myPosts.map(p => {
            const thumb = p.media_urls?.[0] || p.video_url; // 첫 번째 미디어를 썸네일로
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
                  // 미디어 없는 텍스트 게시물
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

      {/* ── 내 커뮤니티 글 목록 (최대 3개 + 더보기) ── */}
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
          {/* 4개 이상이면 더보기/접기 버튼 표시 */}
          {myMeetups.length > 3 && (
            <div onClick={() => setMeetupsExpanded(prev => !prev)}
              style={{ textAlign: "center", padding: "10px", fontSize: 13, color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>
              {meetupsExpanded ? "접기" : `더보기 +${myMeetups.length - 3}개`}
            </div>
          )}
        </div>
      )}

      {/* ── 운동 달력 ── */}
      <p className="section-title">내 운동 기록</p>
      <div className="calendar-section">
        {/* 년월 이동 */}
        <div className="calendar-nav">
          <button className="cal-nav-btn" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
          <span className="calendar-title">{year}년 {month + 1}월</span>
          <button className="cal-nav-btn" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
        </div>
        {/* 요일 헤더 */}
        <div className="cal-day-labels">
          {["일","월","화","수","목","금","토"].map(d => (
            <div key={d} className="cal-day-label">{d}</div>
          ))}
        </div>
        {/* 달력 칸 (null = 빈 칸, 숫자 = 날짜) */}
        <div className="calendar-grid">
          {calCells.map((d, i) => {
            if (!d) return <div key={i} className="cal-cell empty" />;
            const ds = toDateStr(d);
            const record = climbedDates[ds]; // 해당 날짜 기록 (없으면 undefined)
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
            return (
              <div key={i}
                // climbed: 기록 있는 날 (주황 배경), today: 오늘 (테두리 강조)
                className={`cal-cell${record ? " climbed" : ""}${isToday && !record ? " today" : ""}`}
                onClick={() => {
                  setSelectedCalDay(ds);
                  // 기록이 있으면 기존 값 채워서 수정 모드, 없으면 빈 폼
                  setCalForm(record
                    ? { gym: record.gym, memo: record.memo, duration: record.duration, condition: record.condition }
                    : { gym: "", memo: "", duration: "1시간", condition: "😐" });
                  setShowCalModal(true);
                }}>
                {/* 기록 있으면 컨디션 이모지, 없으면 날짜 숫자 */}
                {record ? <span className="cal-emoji">{record.condition}</span> : d}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── D+ 카드 (달력 바로 아래에 붙임) ── */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "14px 20px", marginTop: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)" }}>D+{daysSince}</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>클라이밍 시작일부터</span>
      </div>

      {/* ── 팔로잉 목록 모달 ── */}
      {showFollowingModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowFollowingModal(false); }}>
          <div className="modal-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>팔로잉 {followingCount}</h3>
              {/* 새로고침 버튼: followRefreshKey를 올려서 useEffect를 재실행 */}
              <button onClick={() => setFollowRefreshKey(k => k + 1)}
                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>새로고침</button>
            </div>
            {myFollowingsList.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0 8px" }}>팔로우한 사람이 없어요</div>
            ) : (
              myFollowingsList.map(f => (
                <div key={f.following} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  {/* 프로필 사진 */}
                  {followAvatarMap[f.following] ? (
                    <img src={followAvatarMap[f.following]} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🧗</div>
                  )}
                  <span style={{ fontWeight: 600, flex: 1 }}>{f.following}</span>
                  {/* accepted면 클친, pending이면 신청중 표시 */}
                  <span style={{ fontSize: 11, color: f.status === "accepted" ? "var(--accent)" : "var(--text-muted)", fontWeight: 600 }}>
                    {f.status === "accepted" ? "클친" : "신청중"}
                  </span>
                </div>
              ))
            )}
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowFollowingModal(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 클친 모달 (수락된 클친 + 신청 대기) ── */}
      {showFriendModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowFriendModal(false); }}>
          <div className="modal-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>클친 {friendCount}</h3>
              <button onClick={() => setFollowRefreshKey(k => k + 1)}
                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>새로고침</button>
            </div>
            {/* 수락된 클친 목록 */}
            {myFollowingsList.filter(f => f.status === "accepted").length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>아직 클친이 없어요</div>
            ) : (
              myFollowingsList.filter(f => f.status === "accepted").map(f => (
                <div key={f.following} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  {followAvatarMap[f.following] ? (
                    <img src={followAvatarMap[f.following]} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🧗</div>
                  )}
                  <span style={{ fontWeight: 600 }}>{f.following}</span>
                </div>
              ))
            )}
            {/* 클친 신청 대기 목록 (있을 때만) */}
            {pendingFollowers.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, margin: "14px 0 4px" }}>클친 신청 ({pendingFollowers.length})</div>
                {pendingFollowers.map(f => (
                  <div key={f.follower} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    {followAvatarMap[f.follower] ? (
                      <img src={followAvatarMap[f.follower]} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🧗</div>
                    )}
                    <span style={{ fontWeight: 600, flex: 1 }}>{f.follower}</span>
                    {/* 수락 버튼 → handleAcceptFollow 호출 */}
                    <button className="btn btn-primary" style={{ padding: "5px 14px", fontSize: 13 }}
                      onClick={() => handleAcceptFollow(f.follower)}>수락</button>
                  </div>
                ))}
              </>
            )}
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowFriendModal(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 회원권 모달 ── */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowMemberModal(false); setMemberInput(""); } }}>
          <div className="modal-sheet">
            <h3>🎫 회원권</h3>
            {memberships.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>등록된 회원권이 없어요</div>
            )}
            {/* 회원권 목록 + × 버튼으로 삭제 */}
            {memberships.map((m, i) => (
              <div key={i} className="edit-list-item">
                <span>{m}</span>
                <button onClick={() => saveMemberships(memberships.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {/* 새 회원권 추가: Enter 또는 추가 버튼 */}
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

      {/* ── 세팅일정 모달 ── */}
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

      {/* ── 달력 기록 추가/수정 모달 ── */}
      {showCalModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCalModal(false); }}>
          <div className="modal-sheet">
            {/* 기존 기록 있으면 "수정", 없으면 "추가" */}
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
              {/* 기존 기록 있을 때만 삭제 버튼 표시 */}
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

      {/* ── 커뮤니티 글 수정/삭제 모달 ── */}
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

      {/* ── 피드 게시물 수정/삭제 모달 ── */}
      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPostModal(false); }}>
          <div className="modal-sheet">
            <h3>📝 게시물 관리</h3>
            <div className="form-group">
              <label>사진 / 영상</label>
              <div className="media-upload-row">
                {/* 기존 미디어 URL 미리보기 (× 버튼으로 제거 가능) */}
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
                {/* 새로 추가된 파일 미리보기 */}
                {newMediaFiles.map((f, i) => (
                  <div key={`new-${i}`} className="media-preview-item">
                    {f.type.startsWith("video")
                      ? <video src={URL.createObjectURL(f)} className="media-preview-thumb" />
                      : <img src={URL.createObjectURL(f)} alt="" className="media-preview-thumb" />}
                    <button className="media-preview-del"
                      onClick={() => setNewMediaFiles(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                {/* 최대 10개 미만일 때만 추가 버튼 표시 */}
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
