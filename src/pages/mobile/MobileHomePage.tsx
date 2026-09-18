import { useNavigate } from 'react-router-dom';
import { Sparkles, PlayCircle, Clock, Tv } from 'lucide-react';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import type { AllowedSource, ContentLabel } from '@/types';

/** Tên nhãn dùng làm nguồn cho khu Truyện trên điện thoại — so khớp không phân biệt hoa/
    thường và bỏ khoảng trắng thừa (bố mẹ tự gõ tên nhãn trong "Quản lý nhãn", không ép phải
    gõ đúng từng chữ hoa/thường). KHÔNG tạo nhãn này tự động, KHÔNG hard-code nội dung — nếu
    bố mẹ chưa từng tạo nhãn "Truyện" thì khối này tự hiện gợi ý cách tạo (xem bên dưới). */
const STORY_LABEL_NAME = 'truyện';

/** Tối đa bao nhiêu mục hiện trong khối "Gần đây" trên điện thoại — Trang chủ TV/máy tính
    không giới hạn khối này (chỉ giới hạn "Tiếp tục xem"), nhưng màn hình điện thoại hẹp hơn
    nhiều nên cần chặn bớt để khỏi cuộn quá dài. */
const RECENT_LIMIT = 12;

/**
 * MobileHomePage — Trang chủ trên điện thoại thật, tối ưu cho việc NGHE TRUYỆN (UI_SPEC.md
 * mục 4): mặc định nổi bật nội dung gắn nhãn "Truyện", cộng thêm "Tiếp tục nghe" và "Gần
 * đây". Dùng LẠI ĐÚNG useHomeContent (cùng hook với Trang chủ TV/iPad/máy tính) — không tự
 * lọc/sắp xếp lại theo cách khác, không tạo nguồn dữ liệu song song.
 */
export function MobileHomePage() {
  const navigate = useNavigate();
  const { playVideo } = useMobilePlayback();
  const home = useHomeContent();
  const {
    activeProfile,
    loading,
    sources,
    allLabels,
    channels,
    continuingVideos,
    playable,
    isListSource,
    buildSourcePlayerParams,
    buildContinuingPlayerParams,
  } = home;

  const storyLabel: ContentLabel | undefined = allLabels.find(
    (l) => l.name.trim().toLowerCase() === STORY_LABEL_NAME
  );
  const storyItems = storyLabel ? playable.filter((s) => s.label_ids.includes(storyLabel.id)) : [];
  /** "Gần đây" — sources đã được Supabase trả về sắp theo created_at giảm dần sẵn (xem
      useAllowedSources.ts), chỉ cần cắt bớt. */
  const recentItems = playable.slice(0, RECENT_LIMIT);

  /** Mở 1 video đơn lẻ/link trực tiếp — báo cho trình phát nổi biết TRƯỚC (có sẵn ảnh đại
      diện ngay), rồi mới mở trang /player để MobilePlayerHost vẽ toàn màn hình. */
  const openVideoSource = (source: AllowedSource) => {
    const p = buildSourcePlayerParams(source);
    if (!p) return;
    playVideo(p);
    navigate('/player');
  };
  const openContinuing = (entry: (typeof continuingVideos)[number]) => {
    playVideo(buildContinuingPlayerParams(entry));
    navigate('/player');
  };
  /** Mở 1 mục bất kỳ trong 1 shelf — playlist/playlist tự tạo thì vào trang danh sách video
      (chưa có bản tối ưu riêng cho điện thoại — task kế tiếp), còn lại phát thẳng. */
  const openAny = (source: AllowedSource) => {
    if (isListSource(source)) {
      navigate(`/playlist/${source.id}`);
      return;
    }
    openVideoSource(source);
  };

  if (!activeProfile) return null;

  return (
    <main className="main mobile-home">
      <div className="mobile-home-greet">
        Xin chào, <span className="accent">{activeProfile.name}</span> 👋
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Đang tải nội dung...</p>}

      {!loading && sources.length === 0 && (
        <p style={{ opacity: 0.7 }}>
          Chưa có nội dung nào trong whitelist của {activeProfile.name}. Vào "Khu vực Bố mẹ" để thêm playlist, video
          hoặc kênh đầu tiên nhé.
        </p>
      )}

      {/* --- Khu Truyện — trọng tâm của Trang chủ điện thoại (UI_SPEC.md mục 4) --- */}
      <div className="mobile-shelf-block">
        <div className="mobile-shelf-title">
          <Sparkles size={18} aria-hidden="true" /> Truyện cho bé
        </div>
        {storyItems.length > 0 ? (
          <div className="mobile-shelf">
            {storyItems.map((s) => (
              <MobileContentCard key={s.id} title={s.title} thumbnail={s.thumbnail} onClick={() => openAny(s)} />
            ))}
          </div>
        ) : (
          <div className="mobile-shelf-empty">
            {storyLabel
              ? 'Chưa có nội dung nào được gắn nhãn "Truyện" — vào Khu vực Bố mẹ ➜ Nội dung để gắn nhãn cho playlist/video bé hay nghe.'
              : 'Chưa có nhãn "Truyện" — vào Khu vực Bố mẹ ➜ Nội dung ➜ Quản lý nhãn để tạo nhãn tên "Truyện" rồi gắn cho playlist/video muốn hiện ở đây.'}
          </div>
        )}
      </div>

      {continuingVideos.length > 0 && (
        <div className="mobile-shelf-block">
          <div className="mobile-shelf-title">
            <PlayCircle size={18} aria-hidden="true" /> Tiếp tục nghe
          </div>
          <div className="mobile-shelf">
            {continuingVideos.map((entry) => (
              <MobileContentCard
                key={`${entry.source.id}:${entry.row.video_ref}`}
                title={entry.title}
                thumbnail={entry.thumbnail}
                progressPercent={entry.row.progress_percent}
                onClick={() => openContinuing(entry)}
              />
            ))}
          </div>
        </div>
      )}

      {recentItems.length > 0 && (
        <div className="mobile-shelf-block">
          <div className="mobile-shelf-title">
            <Clock size={18} aria-hidden="true" /> Gần đây
          </div>
          <div className="mobile-shelf">
            {recentItems.map((s) => (
              <MobileContentCard key={s.id} title={s.title} thumbnail={s.thumbnail} onClick={() => openAny(s)} />
            ))}
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <div className="mobile-shelf-block">
          <div className="mobile-shelf-title">
            <Tv size={18} aria-hidden="true" /> Kênh yêu thích
          </div>
          <div className="mobile-shelf">
            {channels.map((ch) => (
              <MobileContentCard key={ch.id} title={ch.title} thumbnail={ch.thumbnail} round onClick={() => navigate(`/channel/${ch.id}`)} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

/** 1 thẻ nội dung trong hàng ngang cuộn được — dùng chung cho mọi khối ở Trang chủ/Khám phá
    điện thoại (KHÔNG dùng lại PlaylistCard.tsx của TV/desktop: card đó có sẵn nhiều chi tiết
    tối ưu cho D-pad/chuột — vd label chip, khung viền — không hợp với hàng cuộn ngón tay
    hẹp trên điện thoại; tạo card riêng nhẹ hơn cho đúng UI_SPEC mục 10). */
function MobileContentCard({
  title,
  thumbnail,
  progressPercent,
  round,
  onClick,
}: {
  title: string;
  thumbnail: string | null;
  progressPercent?: number;
  round?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`mobile-content-card ${round ? 'mobile-content-card--round' : ''}`} onClick={onClick}>
      <div className="mobile-content-thumb" style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined}>
        {!thumbnail && <span className="mobile-content-thumb-fallback">🎵</span>}
        {typeof progressPercent === 'number' && (
          <div className="mobile-content-progress">
            <div className="mobile-content-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
          </div>
        )}
      </div>
      <div className="mobile-content-title">{title}</div>
    </button>
  );
}
