// ─────────────────────────────────────────────
// Chat.jsx
// 클친(accepted 팔로우)끼리만 사용할 수 있는 채팅 페이지.
//
// 화면 구성:
//   1. 클친 목록 (selectedFriend가 null일 때)
//      - 미확인 메시지가 있는 친구는 빨간 테두리 + 아바타 점 + NEW 배지
//      - 친구 탭하면 채팅 창으로 전환
//   2. 채팅 창 (selectedFriend가 설정됐을 때)
//      - 상단: ‹ 뒤로가기 버튼 + 친구 이름
//      - 중단: 메시지 목록 (내 메시지 오른쪽, 상대 왼쪽)
//      - 하단: 텍스트 입력창 + 전송 버튼
//
// 메시지 저장소: Supabase messages 테이블
//   컬럼: id, sender_name, receiver_name, content, created_at
//
// 실시간성: 3초 폴링 (selectedFriend 바뀔 때마다 인터벌 재설정)
//   .in(sender, [me, friend]).in(receiver, [me, friend]) 로 양방향 메시지 조회
//
// 알림 연동:
//   AuthContext의 unreadSenders (Set) 에서 이 친구 이름이 있으면 빨간 표시
//   채팅 창에 들어가면 clearUnreadSender(name)으로 해당 친구 알림 제거
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Chat() {
  const { user, unreadSenders, clearUnreadSender } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  const [friends, setFriends] = useState([]);           // 클친 목록 (닉네임 문자열 배열)
  const [avatarMap, setAvatarMap] = useState({});        // 닉네임 → 프로필 사진 URL
  const [selectedFriend, setSelectedFriend] = useState(null); // 현재 채팅 중인 친구
  const [messages, setMessages] = useState([]);          // 현재 대화 메시지 목록
  const [input, setInput] = useState("");                // 입력창 텍스트
  const [sending, setSending] = useState(false);         // 전송 중 여부 (중복 전송 방지)
  const [loadingFriends, setLoadingFriends] = useState(true); // 클친 목록 로딩 중
  const messagesEndRef = useRef(null);  // 스크롤 끝 지점 참조
  const pollRef = useRef(null);         // setInterval ID 저장 (cleanup용)

  // 마운트 시 클친 목록 로드
  useEffect(() => { loadFriends(); }, []);

  // 친구 선택/변경 시: 이전 인터벌 정리 → 새 메시지 로드 → 3초 폴링 시작
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!selectedFriend) { setMessages([]); return; }
    fetchMessages(selectedFriend);
    pollRef.current = setInterval(() => fetchMessages(selectedFriend), 3000);
    return () => clearInterval(pollRef.current);
  }, [selectedFriend]);

  // 메시지 목록이 바뀔 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ── 클친 목록 로드 ─────────────────────────────────────────────────
  // follows 테이블에서 follower=나, status=accepted 인 행만 가져온다.
  // 이후 프로필 사진도 한 번에 로드해 avatarMap에 저장한다.
  async function loadFriends() {
    setLoadingFriends(true);
    const { data } = await supabase
      .from("follows")
      .select("following")
      .eq("follower", myName)
      .eq("status", "accepted");
    const names = (data || []).map(f => f.following);
    setFriends(names);
    setLoadingFriends(false);
    if (names.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_name, avatar_url")
        .in("user_name", names);
      const map = {};
      profs?.forEach(p => { if (p.avatar_url) map[p.user_name] = p.avatar_url; });
      setAvatarMap(map);
    }
  }

  // ── 메시지 목록 조회 ───────────────────────────────────────────────
  // .in(sender, [나, 친구]).in(receiver, [나, 친구]) 로 양방향 메시지를 한 번에 가져온다.
  // 에러가 있으면 현재 메시지를 유지 (깜빡임 방지)
  async function fetchMessages(friendName) {
    if (!friendName) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .in("sender_name", [myName, friendName])
      .in("receiver_name", [myName, friendName])
      .order("created_at", { ascending: true });
    if (!error) setMessages(data || []);
  }

  // ── 메시지 전송 ────────────────────────────────────────────────────
  // 전송 중엔 sending=true로 중복 전송 차단.
  // 입력창을 먼저 비운 뒤 insert 해야 UX가 자연스럽다.
  // 성공 시 즉시 fetchMessages를 다시 불러 내 메시지도 목록에 반영한다.
  async function sendMessage() {
    const text = input.trim();
    if (!text || !selectedFriend || sending) return;
    setSending(true);
    setInput("");
    const { error } = await supabase.from("messages").insert({
      sender_name: myName,
      receiver_name: selectedFriend,
      content: text,
    });
    setSending(false);
    if (!error) fetchMessages(selectedFriend);
  }

  // ── 로딩 화면 ──────────────────────────────────────────────────────
  if (loadingFriends) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>불러오는 중...</div>
      </div>
    );
  }

  // ── 클친 없음 안내 화면 ────────────────────────────────────────────
  if (friends.length === 0) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>아직 클친이 없어요</div>
          <div style={{ fontSize: 13 }}>마이페이지에서 클친을 추가하면<br />여기서 채팅할 수 있어요</div>
        </div>
      </div>
    );
  }

  // ── 클친 목록 화면 (채팅 미선택) ──────────────────────────────────
  // hasUnread: AuthContext의 unreadSenders Set에 이 친구 이름이 포함돼 있으면 true
  // 친구를 탭하면 selectedFriend 설정 + clearUnreadSender로 해당 알림 점 제거
  if (!selectedFriend) {
    return (
      <div className="page">
        <p className="section-title">💬 채팅</p>
        {friends.map(name => {
          const hasUnread = unreadSenders?.has(name);
          return (
            <div key={name}
              onClick={() => { setSelectedFriend(name); clearUnreadSender(name); }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", background: "var(--surface)",
                borderRadius: 12, marginBottom: 8, cursor: "pointer",
                border: hasUnread ? "1px solid #ff3b30" : "1px solid var(--border)",
              }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                {avatarMap[name] ? (
                  <img src={avatarMap[name]} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🧗</div>
                )}
                {/* 아바타 오른쪽 아래 빨간 점 */}
                {hasUnread && (
                  <span style={{
                    position: "absolute", bottom: 1, right: 1,
                    width: 11, height: 11, background: "#ff3b30",
                    borderRadius: "50%", border: "2px solid var(--surface)",
                  }} />
                )}
              </div>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
              {hasUnread && (
                <span style={{ marginLeft: "auto", background: "#ff3b30", color: "#fff", borderRadius: 8, fontSize: 10, fontWeight: 700, padding: "2px 7px" }}>NEW</span>
              )}
              {!hasUnread && <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 20 }}>›</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── 채팅 창 화면 ───────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 128px)", background: "var(--bg)" }}>

      {/* 상단 헤더: 뒤로가기 + 친구 아바타 + 이름 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", background: "var(--surface)",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <button onClick={() => setSelectedFriend(null)}
          style={{ background: "none", border: "none", color: "var(--text)", fontSize: 24, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>‹</button>
        {avatarMap[selectedFriend] ? (
          <img src={avatarMap[selectedFriend]} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧗</div>
        )}
        <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedFriend}</span>
      </div>

      {/* 메시지 목록: 내 메시지는 오른쪽(accent색), 상대 메시지는 왼쪽(surface색) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40, fontSize: 13 }}>
            첫 메시지를 보내보세요 👋
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_name === myName;
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
              {/* 상대방 메시지에만 아바타 표시 (내 메시지엔 불필요) */}
              {!isMe && (
                avatarMap[msg.sender_name] ? (
                  <img src={avatarMap[msg.sender_name]} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🧗</div>
                )
              )}
              <div style={{ maxWidth: "72%" }}>
                <div style={{
                  background: isMe ? "var(--accent)" : "var(--surface)",
                  color: isMe ? "#fff" : "var(--text)",
                  // 내 메시지: 오른쪽 아래만 각짐 / 상대: 왼쪽 아래만 각짐
                  borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "9px 13px", fontSize: 14,
                  border: isMe ? "none" : "1px solid var(--border)",
                  wordBreak: "break-word",
                }}>
                  {msg.content}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, textAlign: isMe ? "right" : "left" }}>
                  {new Date(msg.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        {/* 이 div로 스크롤 기준점을 잡는다 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 하단 입력창: Enter로 전송, isComposing 체크로 한글 조합 중 오발송 방지 */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 12px",
        background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && sendMessage()}
          placeholder="메시지 입력..."
          style={{
            flex: 1, background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 20, padding: "9px 14px", color: "var(--text)", fontSize: 14, outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() ? "var(--accent)" : "var(--surface2)",
            border: "none", color: input.trim() ? "#fff" : "var(--text-muted)",
            borderRadius: 20, padding: "9px 16px", fontSize: 14,
            cursor: input.trim() ? "pointer" : "default", fontWeight: 600, flexShrink: 0,
          }}>
          전송
        </button>
      </div>
    </div>
  );
}
