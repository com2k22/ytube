import { useNavigate, useParams } from 'react-router-dom';
import { useSourceById } from '@/hooks/useSourceById';
import { usePlaylistVideos } from '@/hooks/usePlaylistVideos';
import { extractPlaylistId } from '@/utils/youtubeParser';
import { PlaylistVideosView } from './PlaylistVideosView';

/**
 * Trang danh sách video trong 1 playlist đã whitelist — video đang xem dở lên đầu.
 * Dùng chung cho cả playlist thật lấy từ YouTube VÀ playlist tự tạo (custom_playlist).
 */
export function PlaylistDetailPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const { source, loading } = useSourceById(sourceId ?? null);
  const { videos, loading: loadingVideos, error } = usePlaylistVideos(source);
  const navigate = useNavigate();

  if (loading || !source) return null;

  const playlistId = source.type === 'youtube_playlist' ? extractPlaylistId(source.url) : null;

  return (
    <PlaylistVideosView
      title={source.title}
      videos={videos}
      loading={loadingVideos}
      error={error}
      playlistId={playlistId}
      progressSourceId={source.id}
      onBack={() => navigate(-1)}
    />
  );
}
