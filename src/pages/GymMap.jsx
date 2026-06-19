import { useEffect, useRef, useState } from "react";

function searchKeyword(ps, kakao, keyword, allGymsMap, onDone) {
  function callback(data, status, pagination) {
    if (status === kakao.maps.services.Status.OK) {
      data.forEach(place => {
        if (!allGymsMap.has(place.id)) allGymsMap.set(place.id, place);
      });
      if (pagination.hasNextPage) {
        pagination.nextPage();
      } else {
        onDone();
      }
    } else {
      onDone();
    }
  }
  ps.keywordSearch(keyword, callback, {
    location: new kakao.maps.LatLng(37.5665, 126.9780),
    radius: 30000,
    size: 15,
  });
}

export default function GymMap() {
  const mapRef = useRef(null);
  const [gymCount, setGymCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedGym, setSelectedGym] = useState(null);

  useEffect(() => {
    const kakao = window.kakao;
    if (!kakao?.maps) return;

    const container = mapRef.current;
    if (!container) return;

    const map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(37.5665, 126.9780),
      level: 8,
    });

    const ps = new kakao.maps.services.Places();
    const allGyms = new Map();
    const keywords = ["클라이밍 서울", "볼더링 서울"];
    let completed = 0;

    function onAllDone() {
      const list = Array.from(allGyms.values());
      setGymCount(list.length);
      setLoading(false);

      const bounds = new kakao.maps.LatLngBounds();
      list.forEach(place => {
        const pos = new kakao.maps.LatLng(place.y, place.x);
        bounds.extend(pos);

        const markerImage = new kakao.maps.MarkerImage(
          "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
          new kakao.maps.Size(24, 35)
        );
        const marker = new kakao.maps.Marker({ map, position: pos, title: place.place_name, image: markerImage });
        kakao.maps.event.addListener(marker, "click", () => {
          setSelectedGym(place);
          map.panTo(pos);
        });
      });

      if (list.length > 0) map.setBounds(bounds);
    }

    keywords.forEach(keyword => {
      searchKeyword(ps, kakao, keyword, allGyms, () => {
        completed++;
        if (completed >= keywords.length) onAllDone();
      });
    });
  }, []);

  return (
    <div style={{ position: "fixed", top: "var(--nav-height)", left: 0, right: 0, bottom: "var(--bottom-nav-height)", display: "flex", flexDirection: "column" }}>

      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, background: "rgba(32,32,32,0.92)", backdropFilter: "blur(8px)",
        padding: "7px 16px", borderRadius: 20, fontSize: 13,
        color: loading ? "var(--text-muted)" : "var(--text)",
        border: "1px solid var(--border)", whiteSpace: "nowrap", fontWeight: 500,
      }}>
        {loading ? "🔍 암장 불러오는 중..." : `🧗 서울 클라이밍 ${gymCount}곳`}
      </div>

      <div ref={mapRef} style={{ flex: 1, width: "100%" }} />

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
            <button onClick={() => setSelectedGym(null)} style={{
              background: "var(--surface2)", border: "none", color: "var(--text-muted)",
              width: 28, height: 28, borderRadius: "50%", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>×</button>
          </div>
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
