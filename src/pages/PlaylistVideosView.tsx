import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { VideoCard } from '@/components/common/VideoCard';
import type { ResolvedVideo } from '@/types';

interface Props {
  title: string;
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
export function PlaylistVideosView({ title, videos, loading, error, playlistId, progressSourceId, onBack }: Props) {
  const { activeProfile } = useProfileContext();
  const { progressFor } = useWatchProgress(activeProfile?.id ?? null);
  const navigate = useNavigate();

  const sorted = progressSourceId
    ? [...videos].sort((a, b) => {
        const pa = progressFor(progressSourceId, a.videoId);
        const pb = progressFor(progressSourceId, b.videoId);
        return Number(pb > 0 && pb < 100) - Number(pa > 0 && pa < 100);
      })
    : videos;

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
