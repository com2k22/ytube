import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchPlaylistItems } from '@/lib/youtube';
import { PlaylistVideosView } from './PlaylistVideosView';
import type { ResolvedVideo } from '@/types';

/** Danh sách video của 1 playlist "mượn" từ kênh đã whitelist (không lưu riêng trong whitelist). */
export function ChannelPlaylistPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<ResolvedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playlistId) return;
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

  if (!playlistId) return null;

  return (
    <PlaylistVideosView
      title={params.get('title') ?? 'Playlist'}
      videos={videos}
      loading={loading}
      error={error}
      playlistId={playlistId}
      progressSourceId={null}
      onBack={() => navigate(-1)}
    />
  );
}
