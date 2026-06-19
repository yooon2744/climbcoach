import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileImg, setProfileImg] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // user 변경 시 프로필 이미지 로드 (커스텀 업로드 > 구글 사진 순)
  useEffect(() => {
    setProfileImg(user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null);
  }, [user]);

  // file: File 객체 - Supabase Storage에 업로드 후 profiles 테이블에 URL 저장
  async function updateProfileImg(file) {
    if (!user?.id || !file) return;
    const fileName = `avatars/avatar_${user.id}`;
    const { error: upErr } = await supabase.storage.from("Videos").upload(fileName, file, {
      contentType: file.type,
      upsert: true,
    });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from("Videos").getPublicUrl(fileName);
    const url = `${publicUrl}?t=${Date.now()}`;
    // auth metadata에 저장 → onAuthStateChange → user 갱신 → profileImg 갱신
    await supabase.auth.updateUser({ data: { avatar_url: url } });
    // profiles 테이블에도 저장 (다른 유저들이 볼 수 있게)
    const myName = user.user_metadata?.name || user.email?.split("@")[0];
    if (myName) {
      await supabase.from("profiles").upsert({ user_name: myName, avatar_url: url }, { onConflict: "user_name" });
    }
  }

  async function updateNickname(newName) {
    const oldName = user?.user_metadata?.name || user?.email?.split("@")[0] || "";
    const { error } = await supabase.auth.updateUser({ data: { name: newName } });
    if (error) throw error;
    if (oldName) {
      await supabase.from("profiles").update({ user_name: newName }).eq("user_name", oldName);
      await supabase.from("comments").update({ user_name: newName }).eq("user_name", oldName);
      await supabase.from("meetup_comments").update({ user_name: newName }).eq("user_name", oldName);
    } else {
      await supabase.from("profiles").upsert({ user_name: newName }, { onConflict: "user_name" });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, profileImg, updateProfileImg, updateNickname }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
