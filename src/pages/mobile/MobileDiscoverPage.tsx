import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass } from 'lucide-react';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import type { AllowedSource } from '@/types';

/**
 * MobileDiscoverPage — tab "Khám phá" trên điện thoại: tìm/lọc lại ĐÚNG những nội dung bố mẹ
 * đã cho phép (whitelist), KHÔNG BAO GIỜ gọi YouTube Search hay hiện gợi ý ngoài whitelist
 * (UI_SPEC.md mục 4 + 11). Dùng LẠI useHomeContent — cùng dữ liệu/luật lọc nhãn Ẩn với Trang
 * chủ, chỉ thêm 1 lớp tìm kiếm theo tên + lọc theo nhãn thật do bố mẹ tự đặt (không tính 2
 * nhãn đặc biệt "Ưu tiên"/"Ẩn" — đó là cờ hành vi, không phải danh mục để duyệt).
 */
export function MobileDiscoverPage() {
  const navigate = useNavigate();
  const { playVideo } = useMobilePlayback();
  const { activeProfile, loading, playable, allLabels, isListSource, buildSourcePlayerParams } = useHomeContent();
  const [query, setQuery] = useState('');
  const [labelId, setLabelId] = useState<string | null>(null);

  const categories = useMemo(() => allLabels.filter((l) => !l.is_builtin), [allLabels]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return playable.filter((s) => {
      if (labelId && !s.label_ids.includes(labelId)) return false;
      if (q && !s.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [playable, labelId, query]);

  const openItem = (source: AllowedSource) => {
    if (isListSource(source)) {
      navigate(`/playlist/${source.id}`);
      return;
    }
    const p = buildSourcePlayerParams(source);
    if (!p) return;
    playVideo(p);
    navigate('/player');
  };

  if (!activeProfile) return null;

  return (
    <main className="main mobile-discover">
      <div className="mobile-discover-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm trong nội dung đã được phép..."
          aria-label="Tìm kiếm"
        />
      </div>

      {categories.length > 0 && (
        <div className="mobile-discover-chips">
          <button
            className={`mobile-discover-chip ${labelId === null ? 'active' : ''}`}
            onClick={() => setLabelId(null)}
          >
            Tất cả
          </button>
          {categories.map((l) => (
            <button
              key={l.id}
              className={`mobile-discover-chip ${labelId === l.id ? 'active' : ''}`}
              onClick={() => setLabelId((cur) => (cur === l.id ? null : l.id))}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {loading && <p style={{ opacity: 0.6 }}>Đang tải nội dung...</p>}

      {!loading && results.length === 0 && (
        <div className="mobile-empty-state" style={{ marginTop: 24 }}>
          <Compass size={40} className="mobile-empty-icon" aria-hidden="true" />
          <div className="mobile-empty-title">Không tìm thấy nội dung nào</div>
          <p className="mobile-empty-text">
            {query.trim() || labelId
              ? 'Thử đổi từ khoá hoặc bỏ bớt bộ lọc nhãn xem sao.'
              : 'Chưa có nội dung nào trong whitelist — vào Khu vực Bố mẹ để thêm nhé.'}
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mobile-discover-grid">
          {results.map((s) => (
            <button key={s.id} className="mobile-discover-item" onClick={() => openItem(s)}>
              <div
                className="mobile-discover-item-thumb"
                style={s.thumbnail ? { backgroundImage: `url(${s.thumbnail})` } : undefined}
              >
                {!s.thumbnail && <span className="mobile-content-thumb-fallback">🎵</span>}
              </div>
              <div className="mobile-discover-item-title">{s.title}</div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
