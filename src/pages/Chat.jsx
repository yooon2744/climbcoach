import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Chat() {
  const { user, clearUnreadMessages } = useAuth();
  const myName = user?.user_metadata?.name || user?.email?.split("@")[0] || "나";

  // 채팅 페이지 진입 시: 알림 권한 요청 + 읽지 않은 카운트 초기화
  useEffect(() => {
    clearUnreadMessages();
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const [friends, setFriends] = useState([]);
  const [avatarMap, setAvatarMap] = useState({});
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  // 마운트 시 클친 목록 로드
  useEffect(() => { loadFriends(); }, []);

  // 친구 선택 시 메시지 로드 + 3초 폴링
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!selectedFriend) { setMessages([]); return; }
    fetchMessages(selectedFriend);
    pollRef.current = setInterval(() => fetchMessages(selectedFriend), 3000);
    return () => clearInterval(pollRef.current);
  }, [selectedFriend]);

  // 새 메시지 오면 스크롤 맨 아래로
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function loadFriends() {
    setLoadingFriends(true);
    // accepted 상태인 팔로잉만 클친으로 표시
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

  async function fetchMessages(friendName) {
    if (!friendName) return;
    // 나↔친구 사이의 모든 메시지 (양방향)
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .in("sender_name", [myName, friendName])
      .in("receiver_name", [myName, friendName])
      .order("created_at", { ascending: true });
    if (!error) setMessages(data || []);
  }

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

  // 로딩 중
  if (loadingFriends) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>불러오는 중...</div>
      </div>
    );
  }

  // 클친 없는 경우
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

  // 친구 목록 화면
  if (!selectedFriend) {
    return (
      <div className="page">
        <p className="section-title">💬 채팅</p>
        {friends.map(name => (
          <div key={name}
            onClick={() => setSelectedFriend(name)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", background: "var(--surface)",
              borderRadius: 12, marginBottom: 8, cursor: "pointer",
              border: "1px solid var(--border)",
            }}>
            {avatarMap[name] ? (
              <img src={avatarMap[name]} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🧗</div>
            )}
            <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
            <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 20 }}>›</span>
          </div>
        ))}
      </div>
    );
  }

  // 채팅 화면
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 128px)", background: "var(--bg)" }}>
      {/* 채팅 헤더 */}
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

      {/* 메시지 목록 */}
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
              {/* 상대방 메시지에만 아바타 표시 */}
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
                  // 내 메시지: 오른쪽 아래 모서리 각짐 / 상대: 왼쪽 아래 모서리 각짐
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
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력창 */}
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
