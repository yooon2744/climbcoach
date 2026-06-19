// ─────────────────────────────────────────────
// supabase.js
// Supabase 클라이언트를 초기화하고 내보내는 파일.
// 이 파일 하나만 수정하면 앱 전체의 DB 연결 설정이 바뀐다.
// ─────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

// .env 파일(또는 Vercel 환경변수)에서 URL과 키를 가져온다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 환경변수가 없으면 콘솔 경고 (배포 후에도 실수로 누락하는 경우 방지)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase 환경변수가 없습니다. Vercel 대시보드에서 설정해주세요.");
}

// anon key는 공개 키로, RLS(행 수준 보안)가 없는 테이블에 누구나 접근 가능하다.
// 민감한 작업은 반드시 RLS 정책 또는 서버사이드에서 처리해야 한다.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);
