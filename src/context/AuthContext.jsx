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

  // user 바뀔 때마다 profileImg 로드 (localStorage)
  useEffect(() => {
    if (user?.id) {
      setProfileImg(localStorage.getItem(`profileImg_${user.id}`) || null);
    } else {
      setProfileImg(null);
    }
  }, [user?.id]);

  function updateProfileImg(base64) {
    if (!user?.id) return;
    if (base64) {
      localStorage.setItem(`profileImg_${user.id}`, base64);
    } else {
      localStorage.removeItem(`profileImg_${user.id}`);
    }
    setProfileImg(base64);
  }

  async function updateNickname(newName) {
    const oldName = user?.user_metadata?.name || user?.email?.split("@")[0] || "";
    const { error } = await supabase.auth.updateUser({ data: { name: newName } });
    if (error) throw error;
    if (oldName) {
      await supabase.from("profiles").update({ user_name: newName }).eq("user_name", oldName);
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
