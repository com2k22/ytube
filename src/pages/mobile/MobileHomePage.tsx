import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Clock, Tv, ChevronRight, Moon, Play } from 'lucide-react';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import { ProfileSwitcher } from '@/components/navigation/ProfileSwitcher';
import type { AllowedSource, ContentLabel } from '@/types';

/** Tên nhãn dùng làm nguồn cho khu Truyện trên điện thoại — so khớp không phân biệt hoa/
    thường và bỏ khoảng trắng thừa (bố mẹ tự gõ tên nhãn trong "Quản lý nhãn", không ép phải
    gõ đúng từng chữ hoa/thường). KHÔNG tạo nhãn này tự động, KHÔNG hard-code nội dung — nếu
    bố mẹ chưa từng tạo nhãn "Truyện" thì khối này tự hiện gợi ý cách tạo (xem bên dưới). */
const STORY_LABEL_NAME = 'truyện';

/** Tối đa bao nhiêu mục lấy về cho khối "Gần đây" (Trang chủ TV/máy tính không giới hạn
    khối này) — chỉ hiện RECENT_PREVIEW mục đầu trên điện thoại, bấm "Xem tất cả" mới thấy
    hết trong Khám phá, tránh cuộn quá dài trên màn hình hẹp. */
const RECENT_LIMIT = 12;
const RECENT_PREVIEW = 5;

/**
 * MobileHomePage — Trang chủ trên điện thoại thật, tối ưu cho việc NGHE TRUYỆN (UI_SPEC.md
 * mục 4): mặc định nổi bật "Danh sách truyện" (playlist gắn CẢ 2 nhãn "Truyện" + "Mobile"),
 * cộng thêm "Gần đây" (video/playlist gắn nhãn "Mobile", mới thêm gần đây nhất) — KHÔNG còn
 * khối "Tiếp tục nghe" nữa (đã bỏ theo yêu cầu). Dùng LẠI ĐÚNG useHomeContent (cùng hook với
 * Trang chủ TV/iPad/máy tính) — không tự lọc/sắp xếp lại theo cách khác, không tạo nguồn dữ
 * liệu song song; riêng việc lọc thêm theo nhãn "Mobile" cho 2 khối trên làm ngay trong file
 * này (xem phoneOnlyLabelId/storyItems/recentItems bên dưới), vì đây là quy tắc RIÊNG của
 * Trang chủ điện thoại, không áp dụng cho TV/iPad/máy tính.
 *
 * Bố cục (banner chào (kèm nút đổi hồ sơ) + dải danh mục + các khối "Xem tất cả") bám theo
 * bộ ảnh tham khảo trong tài liệu thiết kế — CHỈ lấy Ý TƯỞNG bố cục, không nhúng lại hình ảnh
 * minh hoạ gốc (tài liệu ghi rõ PNG chỉ để tham khảo): banner dùng icon trăng/sao có sẵn
 * (lucide-react) thay cho tranh vẽ, dải danh mục dựng từ NHÃN THẬT bố mẹ đã tạo (không có
 * danh mục "Nhạc/Học tập/Giải trí" cứng nào cả — nhãn nào có thật thì hiện đúng nhãn đó).
 * KHÔNG còn thanh riêng ở đầu trang (nút Tìm kiếm/"Khu vực Bố mẹ") — cả 2 đều đã có lối vào
 * riêng ở thanh menu dưới đáy, để thêm ở đây chỉ trùng lặp; nút chọn hồ sơ cũng dời hẳn
 * xuống ghép vào banner (xem ProfileSwitcher region="homebanner").
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
    labelsOf,
    channels,
    playable,
    isListSource,
    buildSourcePlayerParams,
  } = home;

  /** Nhãn "Mobile" (is_phone_only) — xem supabase/019_device_visibility_labels.sql. Dùng để
      lọc riêng cho "Danh sách truyện" + "Gần đây" bên dưới (chỉ hiện nội dung bố mẹ đã CHỦ
      ĐỘNG gắn nhãn này, không phải "mọi thứ không bị ẩn trên điện thoại" như useHomeContent
      vẫn dùng cho các khối khác — 2 việc khác nhau, xem chú thích ở từng khối). */
  const phoneOnlyLabelId = allLabels.find((l) => l.is_phone_only)?.id ?? null;

  const storyLabel: ContentLabel | undefined = allLabels.find(
    (l) => l.name.trim().toLowerCase() === STORY_LABEL_NAME
  );
  /** "Danh sách truyện" — CHỈ hiện PLAYLIST (không phải video/link lẻ) vừa gắn nhãn "Truyện"
      VỪA gắn nhãn "Mobile" (bố mẹ chủ động chọn playlist nào dùng cho khu nghe truyện trên
      điện thoại), theo đúng yêu cầu — không còn gộp mọi loại nội dung gắn nhãn "Truyện" như
      trước nữa. */
  const storyItems =
    storyLabel && phoneOnlyLabelId
      ? playable.filter(
          (s) => isListSource(s) && s.label_ids.includes(storyLabel.id) && s.label_ids.includes(phoneOnlyLabelId)
        )
      : [];
  /** "Gần đây" — CHỈ video/playlist đã gắn nhãn "Mobile" (bố mẹ chủ động chọn cho điện
      thoại), lấy MỚI THÊM GẦN ĐÂY NHẤT trước — sources đã được Supabase trả về sắp theo
      created_at giảm dần sẵn (xem useAllowedSources.ts), lọc xong chỉ cần cắt bớt, không
      cần sắp lại. */
  const recentItems = phoneOnlyLabelId
    ? playable.filter((s) => s.label_ids.includes(phoneOnlyLabelId)).slice(0, RECENT_LIMIT)
    : [];

  /** Dải danh mục ngay dưới banner — TOÀN BỘ nhãn thường (không tính 2 nhãn hành vi đặc
      biệt "Ưu tiên"/"Ẩn" và 2 nhãn giới hạn thiết bị "Mobile"/"TV", xem useContentLabels.ts),
      "Truyện" (nếu có) luôn đứng đầu vì đó là trọng tâm của Trang chủ điện thoại. */
  const categories = useMemo(
    () => allLabels.filter((l) => !l.is_builtin),
    [allLabels]
  );
  const orderedCategories = useMemo(() => {
    if (!storyLabel) return categories;
    return [storyLabel, ...categories.filter((c) => c.id !== storyLabel.id)];
  }, [categories, storyLabel]);

  /** Mở 1 video đơn lẻ/link trực tiếp — báo cho trình phát nổi biết TRƯỚC (có sẵn ảnh đại
      diện ngay), rồi mới mở trang /player để MobilePlayerHost vẽ toàn màn hình. */
  const openVideoSource = (source: AllowedSource) => {
    const p = buildSourcePlayerParams(source);
    if (!p) return;
    playVideo(p);
    navigate('/player');
  };
  /** Mở 1 mục bất kỳ trong 1 shelf — playlist/playlist tự tạo thì vào trang danh sách video,
      còn lại phát thẳng. */
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
      {/* Lớp nền ánh sáng mờ (hero) sau lưng thanh trên cùng/dải danh mục/lời chào — thuần CSS
          (xem .mobile-home-hero-bg trong theme.css), KHÔNG lấy màu từ ảnh bìa nội dung thật
          (việc "dò màu chủ đạo từ ảnh" cần xử lý ảnh riêng, phức tạp hơn nhiều — nếu sau này
          muốn làm đúng kiểu "đổi màu theo bài đang nghe" thì đây sẽ là việc làm thêm). */}
      <div className="mobile-home-hero-bg" aria-hidden="true" />

      {/* --- Thanh trên cùng: góc trái là logo + tên "Ytube" (thương hiệu app — dùng icon
          Play có sẵn làm dấu hiệu thay vì ảnh logo thật, chưa có sẵn file ảnh nào; tô màu ĐỎ-
          TRẮNG theo đúng yêu cầu, không đổi theo theme sáng/tối nữa), góc phải là avatar emoji
          hồ sơ đang xem BO TRÒN, ẨN HẲN TÊN chữ (chỉ còn icon) — bấm vào để đổi hồ sơ (dùng
          lại ProfileSwitcher, region="homebanner", chỉ đổi className để CSS ẩn phần tên/mũi
          tên xổ đi, xem .mobile-home-topbar-avatar trong theme.css). --- */}
      <div className="mobile-home-topbar">
        <div className="mobile-home-logo">
          <span className="mobile-home-logo-mark" aria-hidden="true">
            <Play size={13} fill="currentColor" />
          </span>
          <span className="mobile-home-logo-text">Ytube</span>
        </div>
        <ProfileSwitcher region="homebanner" className="mobile-home-topbar-avatar" />
      </div>

      {orderedCategories.length > 0 && (
        <div className="mobile-discover-chips mobile-home-categories">
          {orderedCategories.map((l) => (
            <button
              key={l.id}
              className={`mobile-discover-chip ${storyLabel && l.id === storyLabel.id ? 'active' : ''}`}
              onClick={() => navigate(`/discover?label=${l.id}`)}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* --- Lời chào: bỏ hẳn khung/nền thẻ cũ (banner), giờ CHỈ còn icon mặt trăng + đúng 1
          dòng "Chào <tên bé>!" — dời xuống DƯỚI dải danh mục theo đúng yêu cầu. Không bấm
          được nữa (nút đổi hồ sơ đã dời hẳn lên thanh trên cùng, avatar góc phải). --- */}
      <div className="mobile-home-greet-line">
        <Moon size={20} aria-hidden="true" />
        <span>Chào {activeProfile.name}!</span>
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Đang tải nội dung...</p>}

      {!loading && sources.length === 0 && (
        <p style={{ opacity: 0.7 }}>
          Chưa có nội dung nào trong whitelist của {activeProfile.name}. Vào "Khu vực Bố mẹ" để thêm playlist, video
          hoặc kênh đầu tiên nhé.
        </p>
      )}

      {/* --- Danh sách truyện — trọng tâm của Trang chủ điện thoại (UI_SPEC.md mục 4). CHỈ
          hiện playlist vừa gắn nhãn "Truyện" vừa gắn nhãn "Mobile" (2 điều kiện, xem
          storyItems phía trên) — không phải mọi nội dung gắn nhãn "Truyện" như trước. --- */}
      <div className="mobile-shelf-block">
        <div className="mobile-shelf-header">
          <div className="mobile-shelf-title">
            <Sparkles size={18} aria-hidden="true" /> Danh sách truyện
          </div>
          {storyItems.length > 0 && (
            <button
              className="mobile-shelf-viewall"
              onClick={() => navigate(storyLabel ? `/discover?label=${storyLabel.id}` : '/discover')}
            >
              Xem tất cả <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
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
              ? 'Chưa có playlist nào gắn ĐỦ CẢ 2 nhãn "Truyện" và "Mobile" — vào Khu vực Bố mẹ ➜ Nội dung để gắn thêm nhãn cho playlist truyện muốn hiện ở đây.'
              : 'Chưa có nhãn "Truyện" — vào Khu vực Bố mẹ ➜ Nội dung ➜ Quản lý nhãn để tạo nhãn tên "Truyện" rồi gắn (cùng nhãn "Mobile") cho playlist muốn hiện ở đây.'}
          </div>
        )}
      </div>

      {recentItems.length > 0 && (
        <div className="mobile-shelf-block">
          <div className="mobile-shelf-header">
            <div className="mobile-shelf-title">
              <Clock size={18} aria-hidden="true" /> Gần đây
            </div>
            <button className="mobile-shelf-viewall" onClick={() => navigate('/discover')}>
              Xem tất cả <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="mobile-story-list">
            {recentItems.slice(0, RECENT_PREVIEW).map((s) => (
              <button key={s.id} className="mobile-story-item" onClick={() => openAny(s)}>
                <div
                  className="mobile-story-item-thumb"
                  style={s.thumbnail ? { backgroundImage: `url(${s.thumbnail})` } : undefined}
                >
                  {!s.thumbnail && <span className="mobile-content-thumb-fallback">🎵</span>}
                </div>
                <div className="mobile-story-item-info">
                  <div className="mobile-story-item-title">{s.title}</div>
                  {labelsOf(s)[0] && <span className="mobile-recent-tag">{labelsOf(s)[0].name}</span>}
                </div>
                <Play size={16} className="mobile-story-item-play" aria-hidden="true" />
              </button>
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
