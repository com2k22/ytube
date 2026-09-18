import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Compass, ChevronLeft, Sparkles, BookOpen, Music2, GraduationCap, Gamepad2, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import type { AllowedSource } from '@/types';

type TypeFilter = 'all' | 'youtube_playlist' | 'youtube_video' | 'youtube_channel';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'youtube_playlist', label: 'Playlist' },
  { value: 'youtube_video', label: 'Video' },
  { value: 'youtube_channel', label: 'Kênh' },
];

/** Icon gợi ý cho từng ô danh mục — chỉ đoán theo TÊN NHÃN THẬT bố mẹ đã đặt (không hard-
    code danh mục nào), đoán sai/không khớp từ khoá nào thì rơi về icon Tag chung chung, không
    ảnh hưởng gì tới việc lọc nội dung bên dưới. */
function categoryIcon(name: string): LucideIcon {
  const n = name.trim().toLowerCase();
  if (n.includes('truyện') || n.includes('cổ tích') || n.includes('thơ')) return BookOpen;
  if (n.includes('nhạc')) return Music2;
  if (n.includes('học')) return GraduationCap;
  if (n.includes('giải trí') || n.includes('trò chơi') || n.includes('chơi')) return Gamepad2;
  return Tag;
}

/**
 * MobileDiscoverPage — tab "Khám phá" trên điện thoại: tìm/lọc lại ĐÚNG những nội dung bố mẹ
 * đã cho phép (whitelist), KHÔNG BAO GIỜ gọi YouTube Search hay hiện gợi ý ngoài whitelist
 * (UI_SPEC.md mục 4 + 11). Dùng LẠI useHomeContent — cùng dữ liệu/luật lọc nhãn Ẩn/thiết bị
 * với Trang chủ, chỉ thêm 1 lớp tìm kiếm theo tên + lọc theo nhãn thật do bố mẹ tự đặt/loại
 * nguồn (không tính 4 nhãn đặc biệt "Ưu tiên"/"Ẩn"/"Mobile"/"TV" — đó là cờ hành vi, không
 * phải danh mục để duyệt).
 *
 * Bố cục 2 chế độ (bám theo tài liệu thiết kế, chỉ lấy Ý TƯỞNG bố cục — xem chú thích ở
 * MobileHomePage.tsx):
 *  - CHƯA tìm/chưa chọn danh mục: hiện lưới "Khám phá theo chủ đề" (từ nhãn thật) + "Gợi ý
 *    cho <tên bé>" (dùng lại recommendedPlaylists/recommendedVideos đã có sẵn, không gọi
 *    thêm API nào).
 *  - ĐÃ gõ tìm hoặc bấm 1 danh mục (kể cả bấm từ dải danh mục ở Trang chủ, qua ?label=):
 *    hiện thanh lọc theo loại (Tất cả/Playlist/Video/Kênh) + lưới kết quả.
 */
export function MobileDiscoverPage() {
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const { playVideo } = useMobilePlayback();
  const {
    activeProfile,
    loading,
    playable,
    channels,
    allLabels,
    isListSource,
    buildSourcePlayerParams,
    recommendedPlaylists,
    recommendedVideos,
  } = useHomeContent();
  const [query, setQuery] = useState('');
  const [labelId, setLabelId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Mở từ 1 danh mục ở Trang chủ (link "/discover?label=<id>") → vào thẳng kết quả đúng danh
  // mục đó luôn, không bắt bé/bố mẹ bấm lại từ đầu. Chỉ đọc 1 LẦN lúc vào trang.
  useEffect(() => {
    const fromHome = urlParams.get('label');
    if (fromHome) setLabelId(fromHome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => allLabels.filter((l) => !l.is_builtin), [allLabels]);
  const activeLabel = categories.find((l) => l.id === labelId) ?? null;
  const browsing = query.trim().length > 0 || !!labelId;

  /** Kho tìm kiếm — gộp cả nội dung phát thẳng/danh sách LẪN kênh yêu thích, để lọc "Kênh"
      hoạt động được (channels tách riêng khỏi playable trong useHomeContent). */
  const searchDomain = useMemo(() => [...playable, ...channels], [playable, channels]);

  const matchesType = (s: AllowedSource, filter: TypeFilter) => {
    if (filter === 'all') return true;
    if (filter === 'youtube_channel') return s.type === 'youtube_channel';
    if (filter === 'youtube_playlist') return s.type === 'youtube_playlist' || s.type === 'custom_playlist';
    return s.type === 'youtube_video' || s.type === 'direct_url';
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return searchDomain.filter((s) => {
      if (labelId && !s.label_ids.includes(labelId)) return false;
      if (q && !s.title.toLowerCase().includes(q)) return false;
      return matchesType(s, typeFilter);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDomain, labelId, query, typeFilter]);

  /** "Gợi ý cho bé" — TÁI DÙNG đúng danh sách đã ưu tiên/sắp sẵn cho Trang chủ TV/máy tính
      (recommendedPlaylists/recommendedVideos), không gọi thêm API/tự nghĩ ra luật gợi ý mới. */
  const recommended = useMemo(
    () => [...recommendedPlaylists, ...recommendedVideos].slice(0, 8),
    [recommendedPlaylists, recommendedVideos]
  );

  const openItem = (source: AllowedSource) => {
    if (source.type === 'youtube_channel') {
      navigate(`/channel/${source.id}`);
      return;
    }
    if (isListSource(source)) {
      navigate(`/playlist/${source.id}`);
      return;
    }
    const p = buildSourcePlayerParams(source);
    if (!p) return;
    playVideo(p);
    navigate('/player');
  };

  const backToTopics = () => {
    setQuery('');
    setLabelId(null);
    setTypeFilter('all');
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

      {!browsing && (
        <>
          {categories.length > 0 && (
            <div className="mobile-shelf-block">
              <div className="mobile-shelf-title">
                <Compass size={18} aria-hidden="true" /> Khám phá theo chủ đề
              </div>
              <div className="mobile-discover-tiles">
                {categories.map((l, i) => {
                  const Icon = categoryIcon(l.name);
                  return (
                    <button
                      key={l.id}
                      className={`mobile-discover-tile mobile-discover-tile-c${i % 4}`}
                      onClick={() => setLabelId(l.id)}
                    >
                      <Icon size={22} aria-hidden="true" />
                      <span>{l.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {recommended.length > 0 && (
            <div className="mobile-shelf-block">
              <div className="mobile-shelf-title">
                <Sparkles size={18} aria-hidden="true" /> Gợi ý cho {activeProfile.name}
              </div>
              <div className="mobile-discover-grid">
                {recommended.map((s) => (
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
            </div>
          )}

          {!loading && categories.length === 0 && recommended.length === 0 && (
            <div className="mobile-empty-state" style={{ marginTop: 24 }}>
              <Compass size={40} className="mobile-empty-icon" aria-hidden="true" />
              <div className="mobile-empty-title">Chưa có nội dung nào</div>
              <p className="mobile-empty-text">Vào Khu vực Bố mẹ để thêm playlist, video hoặc kênh đầu tiên nhé.</p>
            </div>
          )}
        </>
      )}

      {browsing && (
        <>
          <div className="mobile-discover-browsebar">
            <button className="mobile-story-back" onClick={backToTopics}>
              <ChevronLeft size={18} aria-hidden="true" /> Chủ đề
            </button>
            {activeLabel && <span className="mobile-discover-activelabel">{activeLabel.name}</span>}
          </div>

          <div className="mobile-discover-chips">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.value}
                className={`mobile-discover-chip ${typeFilter === t.value ? 'active' : ''}`}
                onClick={() => setTypeFilter(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && <p style={{ opacity: 0.6 }}>Đang tải nội dung...</p>}

          {!loading && results.length === 0 && (
            <div className="mobile-empty-state" style={{ marginTop: 24 }}>
              <Compass size={40} className="mobile-empty-icon" aria-hidden="true" />
              <div className="mobile-empty-title">Không tìm thấy nội dung nào</div>
              <p className="mobile-empty-text">Thử đổi từ khoá hoặc bỏ bớt bộ lọc xem sao.</p>
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
        </>
      )}
    </main>
  );
}
