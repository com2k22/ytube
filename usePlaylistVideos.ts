import { useEffect, useState } from 'react';
import { fetchPlaylistItems } from '@/lib/youtube';
import { extractPlaylistId } from '@/utils/youtubeParser';
import type { AllowedSource, ResolvedVideo } from '@/types';

/** Giải mã 1 nguồn "youtube_playlist" thành danh sách video thật để hiển thị. */
export function usePlaylistVideos(source: AllowedSource | null) {
  const [videos, setVideos] = useState<ResolvedVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source || source.type !== 'youtube_playlist') {
      setVideos([]);
      return;
    }
    const playlistId = extractPlaylistId(source.url);
    if (!playlistId) {
      setError('Không đọc được ID playlist từ link đã lưu.');
      return;
    }
    setLoading(true);
    setError(null);
    fetchPlaylistItems(playlistId)
      .then((items) => {
        if (items.length === 0) {
          setError(
            'Không tải được video thật (có thể thiếu VITE_YOUTUBE_API_KEY trong .env, hoặc playlist ở chế độ riêng tư).'
          );
        }
        setVideos(
          items.map((it) => ({
            videoId: it.videoId,
            title: it.title,
            thumbnail: it.thumbnail,
            sourceType: 'youtube_playlist' as const,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [source?.id, source?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  return { videos, loading, error };
}
