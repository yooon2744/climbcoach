// ─────────────────────────────────────────────
// AuthContext.jsx
// 앱 전체에서 사용하는 로그인 정보와 프로필 관련 함수들을 관리한다.
// 어느 컴포넌트에서든 useAuth()로 꺼내 쓸 수 있다.
//
// 제공하는 값:
//   user           - 현재 로그인한 Supabase 유저 객체 (null이면 비로그인)
//   loading        - 초기 세션 확인 중 여부
//   profileImg     - 현재 유저의 프로필 사진 URL (localStorage 아닌 DB 기반)
//   signOut        - 로그아웃 함수
//   updateProfileImg(file) - 프로필 사진 업로드 + DB 저장 + 즉시 반영
//   updateNickname(name)   - 닉네임 변경 + 관련 테이블 일괄 동기화
// ─────────────────────────────────────────────

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);         // 로그인한 유저 (null = 비로그인)
  const [loading, setLoading] = useState(true);   // 초기 세션 로딩 완료 여부
  const [profileImg, setProfileImg] = useState(null); // 프로필 사진 URL

  // ── 1. 앱 시작 시 세션 복원 & 로그인/로그아웃 감지 ──────────────────
  useEffect(() => {
    // 페이지 새로고침 시 기존 세션을 가져와 로그인 상태 유지
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 로그인/로그아웃 이벤트가 발생할 때마다 user 상태 업데이트
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // 컴포넌트 언마운트 시 구독 해제 (메모리 누수 방지)
    return () => subscription.unsubscribe();
  }, []);

  // ── 2. 로그인한 유저의 프로필 사진 로드 ─────────────────────────────
  // user.id가 바뀔 때만 실행 (계정 전환 시)
  // localStorage가 아닌 profiles 테이블에서 읽기 때문에
  // Google 재로그인해도 커스텀 사진이 구글 사진으로 덮어씌워지지 않는다.
  useEffect(() => {
    if (!user?.id) { setProfileImg(null); return; }

    // 닉네임: Google 계정이면 user_metadata.name, 이메일 계정이면 이메일 앞부분
    const name = user.user_metadata?.name || user.email?.split("@")[0];
    if (!name) { setProfileImg(null); return; }

    supabase.from("profiles").select("avatar_url").eq("user_name", name).maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) {
          // 직접 업로드한 사진이 있으면 그걸 사용
          setProfileImg(data.avatar_url);
        } else {
          // 없으면 Google 프로필 사진을 대신 사용하고 DB에도 저장
          // (다른 유저가 피드에서 볼 수 있도록 profiles 테이블에 저장)
          const googlePic = user.user_metadata?.picture;
          setProfileImg(googlePic || null);
          if (googlePic) {
            supabase.from("profiles").upsert({ user_name: name, avatar_url: googlePic }, { onConflict: "user_name" });
          }
        }
      });
  }, [user?.id]);

  // ── 3. 프로필 사진 업로드 ─────────────────────────────────────────
  // File 객체를 받아 Supabase Storage에 업로드하고, profiles 테이블에 URL 저장.
  // 파일명에 user.id와 timestamp를 붙여 중복을 방지한다.
  // (서브폴더 없이 루트에 저장 → 기존 Storage RLS 정책과 충돌하지 않음)
  async function updateProfileImg(file) {
    if (!user?.id || !file) return;

    const ext = (file.name || "").split(".").pop() || "jpg";
    const fileName = `avatar_${user.id}_${Date.now()}.${ext}`; // 고유 파일명

    // Storage에 업로드
    const { error: upErr } = await supabase.storage.from("Videos").upload(fileName, file, {
      contentType: file.type,
    });
    if (upErr) throw upErr;

    // 업로드된 파일의 공개 URL 취득
    const { data: { publicUrl } } = supabase.storage.from("Videos").getPublicUrl(fileName);

    const myName = user.user_metadata?.name || user.email?.split("@")[0];
    if (myName) {
      // profiles 테이블에 URL 저장 (upsert: 없으면 insert, 있으면 update)
      const { error: dbErr } = await supabase.from("profiles").upsert(
        { user_name: myName, avatar_url: publicUrl },
        { onConflict: "user_name" }
      );
      if (dbErr) throw dbErr;
    }

    // useEffect([user?.id])는 user.id가 바뀔 때만 실행되므로
    // 업로드 직후 화면에 반영하려면 직접 setState를 호출해야 한다.
    setProfileImg(publicUrl);
  }

  // ── 4. 닉네임 변경 ────────────────────────────────────────────────
  // Supabase Auth의 user_metadata.name을 바꾸고,
  // 기존 닉네임으로 저장된 profiles, comments, meetup_comments 레코드도 일괄 업데이트.
  async function updateNickname(newName) {
    const oldName = user?.user_metadata?.name || user?.email?.split("@")[0] || "";

    // Auth 메타데이터 업데이트 (로그인 세션의 user_metadata.name 변경)
    const { error } = await supabase.auth.updateUser({ data: { name: newName } });
    if (error) throw error;

    if (oldName) {
      // 기존 닉네임이 있으면 관련 테이블 전체 업데이트
      await supabase.from("profiles").update({ user_name: newName }).eq("user_name", oldName);
      await supabase.from("comments").update({ user_name: newName }).eq("user_name", oldName);
      await supabase.from("meetup_comments").update({ user_name: newName }).eq("user_name", oldName);
    } else {
      // 기존 닉네임이 없는 경우 profiles에 새 row 생성
      await supabase.from("profiles").upsert({ user_name: newName }, { onConflict: "user_name" });
    }
  }

  // ── 5. 로그아웃 ───────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, profileImg, updateProfileImg, updateNickname }}>
      {children}
    </AuthContext.Provider>
  );
}

// 다른 컴포넌트에서 useAuth()로 바로 꺼내 쓸 수 있게 해주는 훅
export const useAuth = () => useContext(AuthContext);
