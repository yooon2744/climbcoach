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

  // profiles 테이블에서 로드 (Google 재로그인해도 덮어쓰이지 않음)
  useEffect(() => {
    if (!user?.id) { setProfileImg(null); return; }
    const name = user.user_metadata?.name || user.email?.split("@")[0];
    if (!name) { setProfileImg(null); return; }
    supabase.from("profiles").select("avatar_url").eq("user_name", name).maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) {
          setProfileImg(data.avatar_url);
        } else {
          // 커스텀 사진 없으면 Google 사진을 profiles에 저장 (다른 유저도 볼 수 있게)
          const googlePic = user.user_metadata?.picture;
          setProfileImg(googlePic || null);
          if (googlePic) {
            supabase.from("profiles").upsert({ user_name: name, avatar_url: googlePic }, { onConflict: "user_name" });
          }
        }
      });
  }, [user?.id]);

  // file: File 객체 - Supabase Storage에 업로드 후 profiles 테이블에 URL 저장
  async function updateProfileImg(file) {
    if (!user?.id || !file) return;
    const ext = (file.name || "").split(".").pop() || "jpg";
    const fileName = `avatar_${user.id}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("Videos").upload(fileName, file, {
      contentType: file.type,
    });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from("Videos").getPublicUrl(fileName);
    await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
    const myName = user.user_metadata?.name || user.email?.split("@")[0];
    if (myName) {
      await supabase.from("profiles").upsert({ user_name: myName, avatar_url: publicUrl }, { onConflict: "user_name" });
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
