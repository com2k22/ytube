import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { fetchPlaylistItems } from '@/lib/youtube';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { VideoCard } from '@/components/common/VideoCard';
import { useEffect, useState } from 'react';
import type { ResolvedVideo } from '@/types';

interface Props {
  playlistId: string;
  title: string;
  /** id trong bảng allowed_sources — null nếu playlist này chỉ "mượn" từ 1 kênh whitelist,
   * trường hợp đó bỏ qua theo dõi tiến độ (continue-watching) cho đơn giản. */
  progressSourceId: string | null;
  onBack: () => void;
}

/** Danh sách video của 1 playlist — dùng chung cho trang Playlist và trang Kênh. */
export function PlaylistVideosView({ playlistId, title, progressSourceId, onBack }: Props) {
  const { activeProfile } = useProfileContext();
  const [videos, setVideos] = useState<ResolvedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { progressFor } = useWatchProgress(activeProfile?.id ?? null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPlaylistItems(playlistId)
      .then((items) => {
        if (items.length === 0) {
          setError('Không tải được video thật (thiếu VITE_YOUTUBE_API_KEY trong .env, hoặc playlist riêng tư).');
        }
        setVideos(items.map((it) => ({ videoId: it.videoId, title: it.title, thumbnail: it.thumbnail, sourceType: 'youtube_playlist' as const })));
      })
      .finally(() => setLoading(false));
  }, [playlistId]);

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
          const params = new URLSearchParams({ videoId: v.videoId, title: v.title, playlistId });
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
