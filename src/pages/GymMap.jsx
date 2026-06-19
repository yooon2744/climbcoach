// ─────────────────────────────────────────────
// GymMap.jsx
// 카카오맵 API를 이용해 서울 클라이밍 암장을 지도에 표시하는 페이지.
//
// 초기화 순서:
//   index.html에서 SDK를 autoload=false로 불러옴
//   → window.kakao.maps.load(initMap) 콜백으로 모듈 준비 완료 후 실행
//   → 키워드 검색 2개("클라이밍 서울", "볼더링 서울")를 동시에 실행
//   → 결과를 Map으로 중복 제거 후 별 마커로 표시
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

// 카카오맵 장소 API 키워드 검색 헬퍼 함수.
// 페이지네이션이 있으면 재귀적으로 다음 페이지를 가져온다.
// allGymsMap: Map(id → place) — 중복 암장을 id 기준으로 제거
function searchKeyword(ps, kakao, keyword, allGymsMap, onDone) {
  function callback(data, status, pagination) {
    if (status === kakao.maps.services.Status.OK) {
      // 검색된 장소를 Map에 추가 (이미 있으면 덮어쓰지 않아 중복 방지)
      data.forEach(place => {
        if (!allGymsMap.has(place.id)) allGymsMap.set(place.id, place);
      });
      // 다음 페이지가 있으면 계속 가져옴
      if (pagination.hasNextPage) {
        pagination.nextPage();
      } else {
        onDone(); // 이 키워드 검색 완료
      }
    } else {
      onDone(); // 결과 없어도 완료 처리 (에러 무시)
    }
  }

  ps.keywordSearch(keyword, callback, {
    location: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 중심 좌표
    radius: 30000, // 30km 반경
    size: 15,      // 한 페이지에 최대 15개
  });
}

export default function GymMap() {
  const mapRef = useRef(null);               // 지도를 렌더링할 div 요소 참조
  const [gymCount, setGymCount] = useState(0);       // 찾은 암장 수
  const [loading, setLoading] = useState(true);      // 지도/검색 로딩 여부
  const [selectedGym, setSelectedGym] = useState(null); // 마커 클릭 시 선택된 암장

  useEffect(() => {
    // 카카오맵 초기화 함수 - SDK 로드 완료 후 실행됨
    function initMap() {
      const kakao = window.kakao;
      const container = mapRef.current;
      if (!container) return;

      // 지도 생성 (서울 중심, zoom level 8)
      const map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
        level: 8,
      });

      const ps = new kakao.maps.services.Places();
      const allGyms = new Map(); // id를 키로 중복 제거
      const keywords = ["클라이밍 서울", "볼더링 서울"];
      let completed = 0; // 완료된 키워드 수 (2개 모두 끝나면 마커 생성)

      // 모든 키워드 검색이 완료됐을 때 호출
      function onAllDone() {
        const list = Array.from(allGyms.values());
        setGymCount(list.length);
        setLoading(false);

        // 모든 암장이 보이도록 지도 범위 자동 조정
        const bounds = new kakao.maps.LatLngBounds();
        list.forEach(place => {
          const pos = new kakao.maps.LatLng(place.y, place.x);
          bounds.extend(pos);

          // 별 모양 마커 이미지 사용
          const markerImage = new kakao.maps.MarkerImage(
            "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
            new kakao.maps.Size(24, 35)
          );
          const marker = new kakao.maps.Marker({ map, position: pos, title: place.place_name, image: markerImage });

          // 마커 클릭 시 하단 정보 패널에 해당 암장 표시
          kakao.maps.event.addListener(marker, "click", () => {
            setSelectedGym(place);
            map.panTo(pos); // 지도 중심을 해당 위치로 이동
          });
        });

        if (list.length > 0) map.setBounds(bounds); // 마커 전체가 보이도록 줌 자동 조정
      }

      // 두 키워드 검색을 병렬로 실행
      keywords.forEach(keyword => {
        searchKeyword(ps, kakao, keyword, allGyms, () => {
          completed++;
          if (completed >= keywords.length) onAllDone(); // 둘 다 끝나면 마커 생성
        });
      });
    }

    // ── SDK 로드 상태에 따른 초기화 분기 ────────────────────────────
    if (window.kakao?.maps?.Map) {
      // SDK와 maps 모듈이 이미 완전히 로드된 경우 (새로고침 후 캐시)
      initMap();
    } else if (window.kakao?.maps) {
      // SDK는 로드됐지만 maps 모듈이 아직 준비 중인 경우
      // autoload=false이므로 .load() 콜백이 완료되면 실행
      window.kakao.maps.load(initMap);
    } else {
      // SDK 자체가 아직 로드 안 된 경우 → 1초 후 재시도
      const timer = setTimeout(() => {
        if (window.kakao?.maps?.Map) initMap();
        else if (window.kakao?.maps) window.kakao.maps.load(initMap);
        else setLoading(false); // 그래도 없으면 에러 상태로 전환
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div style={{ position: "fixed", top: 60, left: 0, right: 0, bottom: 64 }}>

      {/* 상단 암장 수 / 로딩 상태 표시 칩 */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, background: "rgba(32,32,32,0.92)", backdropFilter: "blur(8px)",
        padding: "7px 16px", borderRadius: 20, fontSize: 13,
        color: loading ? "var(--text-muted)" : "var(--text)",
        border: "1px solid var(--border)", whiteSpace: "nowrap", fontWeight: 500,
      }}>
        {loading ? "🔍 암장 불러오는 중..." : `🧗 서울 클라이밍 ${gymCount}곳`}
      </div>

      {/* 카카오맵이 그려지는 div (mapRef로 연결) */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* 마커 클릭 시 하단에 올라오는 암장 정보 패널 */}
      {selectedGym && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          borderRadius: "18px 18px 0 0", padding: "20px 20px 28px",
          zIndex: 20, boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{selectedGym.place_name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: selectedGym.phone ? 4 : 0 }}>📍 {selectedGym.address_name}</div>
              {selectedGym.phone && (
                <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>📞 {selectedGym.phone}</div>
              )}
            </div>
            {/* 패널 닫기 버튼 */}
            <button onClick={() => setSelectedGym(null)} style={{
              background: "var(--surface2)", border: "none", color: "var(--text-muted)",
              width: 28, height: 28, borderRadius: "50%", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>×</button>
          </div>
          {/* 카카오맵 외부 링크 */}
          {selectedGym.place_url && (
            <a href={selectedGym.place_url} target="_blank" rel="noreferrer" style={{
              display: "block", textAlign: "center", padding: "11px",
              background: "var(--accent)", color: "#fff", borderRadius: 10,
              fontSize: 14, fontWeight: 600, textDecoration: "none", marginTop: 14,
            }}>카카오맵에서 보기 →</a>
          )}
        </div>
      )}
    </div>
  );
}
