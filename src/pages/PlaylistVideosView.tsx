import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useBlockedItems } from '@/hooks/useBlockedItems';
import { VideoCard } from '@/components/common/VideoCard';
import { useIsPhoneScreen } from '@/lib/screenSize';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import { MobileStoryDetailShell } from '@/pages/mobile/MobileStoryDetailShell';
import type { PlayerEngineParams } from '@/hooks/usePlayerEngine';
import type { ResolvedVideo } from '@/types';

interface Props {
  title: string;
  /** Ảnh đại diện của cả playlist — CHỈ dùng cho phần "hero" trên điện thoại (xem
      MobileStoryDetailShell); TV/iPad/máy tính vẫn hiện ảnh riêng từng video như cũ, không
      dùng prop này. null/không truyền = chưa có sẵn (vẫn hiện được, chỉ không có ảnh nền). */
  thumbnail?: string | null;
  videos: ResolvedVideo[];
  loading?: boolean;
  error?: string | null;
  /** id playlist THẬT trên YouTube — null cho playlist tự tạo (custom_playlist) hoặc khi
   * không áp dụng; dùng để trang phát video tải tiếp "video tiếp theo" qua API YouTube. */
  playlistId?: string | null;
  /** id trong bảng allowed_sources dùng làm CHỖ LƯU tiến độ xem (continue-watching) —
   * playlist/video riêng thì dùng đúng id của chính nó; playlist "mượn" từ 1 kênh whitelist
   * (không có dòng whitelist riêng) thì dùng ĐÚNG id của dòng "Kênh yêu thích" đó (xem
   * ChannelPlaylistPage.tsx) — vẫn thoả khoá ngoại của watch_progress mà không cần thêm dữ
   * liệu gì mới. null = không áp dụng, bỏ qua theo dõi tiến độ. */
  progressSourceId: string | null;
  onBack: () => void;
}

/** Danh sách video của 1 playlist — dùng chung cho playlist YouTube, playlist tự tạo, và trang Kênh. */
export function PlaylistVideosView({ title, thumbnail, videos, loading, error, playlistId, progressSourceId, onBack }: Props) {
  const { activeProfile } = useProfileContext();
  const { progressFor } = useWatchProgress(activeProfile?.id ?? null);
  // Ẩn riêng từng VIDEO đã bị phụ huynh chủ động chặn (khối "Chặn nội dung" trong khu Bố
  // mẹ) — áp dụng cho MỌI danh sách video hiển thị qua component này (playlist đã thêm,
  // playlist "mượn" từ 1 kênh...), không cần biết đang xem playlist nào (xem useBlockedItems.ts).
  const { blockedIdsOfType } = useBlockedItems();
  const blockedVideoIds = blockedIdsOfType('video');
  const visible = videos.filter((v) => !blockedVideoIds.has(v.videoId));
  const navigate = useNavigate();
  const isPhone = useIsPhoneScreen();
  const { playVideo } = useMobilePlayback();

  const sorted = progressSourceId
    ? [...visible].sort((a, b) => {
        const pa = progressFor(progressSourceId, a.videoId);
        const pb = progressFor(progressSourceId, b.videoId);
        return Number(pb > 0 && pb < 100) - Number(pa > 0 && pa < 100);
      })
    : visible;

  /** Mọi video trong 1 playlist (thật hoặc tự tạo) luôn có videoId YouTube thật — playlist
      không chứa được link trực tiếp (xem CustomPlaylistItem trong types/index.ts) — nên
      dựng tham số phát luôn đi theo videoId, không cần nhánh directUrl. */
  const buildVideoParams = (v: ResolvedVideo): PlayerEngineParams => ({
    sourceId: progressSourceId,
    title: v.title,
    videoId: v.videoId,
    directUrl: null,
    playlistId: playlistId ?? null,
    thumbnail: v.thumbnail,
  });

  if (isPhone) {
    return (
      <MobileStoryDetailShell
        title={title}
        thumbnail={thumbnail ?? null}
        itemCountLabel={`${sorted.length} video`}
        loading={loading}
        error={error}
        onBack={onBack}
        onPlayAll={
          sorted.length > 0
            ? () => {
                playVideo(buildVideoParams(sorted[0]));
                navigate('/player');
              }
            : undefined
        }
        items={sorted.map((v) => ({
          id: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          progressPercent: progressSourceId ? progressFor(progressSourceId, v.videoId) : undefined,
          onSelect: () => {
            playVideo(buildVideoParams(v));
            navigate('/player');
          },
        }))}
      />
    );
  }

  return (
    <main className="main">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={onBack}>
        ← Quay lại
      </button>
      <div className="section-title" style={{ marginTop: 20 }}>
        {title}
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Đang tải danh sách video...</p>}
      {error && <p style={{ opacity: 0.7, color: '#e05a5a', maxWidth: 480 }}>{error}</p>}

      <div className="grid3">
        {sorted.map((v) => {
          const percent = progressSourceId ? progressFor(progressSourceId, v.videoId) : 0;
          const watching = percent > 0 && percent < 100;
          const params = new URLSearchParams({ videoId: v.videoId, title: v.title });
          if (playlistId) params.set('playlistId', playlistId);
          if (progressSourceId) params.set('sourceId', progressSourceId);
          return (
            <VideoCard
              key={v.videoId}
              title={v.title}
              thumbnail={v.thumbnail}
              watching={watching}
              progressPercent={percent}
              onClick={() => navigate(`/player?${params.toString()}`)}
            />
          );
        })}
      </div>
    </main>
  );
}
