import { useEffect, useState } from 'react';
import { fetchPlaylistItems } from '@/lib/youtube';
import { extractPlaylistId } from '@/utils/youtubeParser';
import type { AllowedSource, ResolvedVideo } from '@/types';

/**
 * Giải mã 1 nguồn dạng "playlist" thành danh sách video thật để hiển thị:
 * - 'youtube_playlist' → gọi YouTube Data API để lấy danh sách video thật.
 * - 'custom_playlist' → đọc thẳng từ cột items (không cần gọi API, phụ huynh tự ghép).
 */
export function usePlaylistVideos(source: AllowedSource | null) {
  const [videos, setVideos] = useState<ResolvedVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setVideos([]);
      return;
    }

    if (source.type === 'custom_playlist') {
      setError(source.items.length === 0 ? 'Playlist này chưa có video nào — vào 🔒 Bố mẹ để thêm video.' : null);
      setVideos(
        source.items.map((it) => ({
          videoId: it.videoId,
          title: it.title,
          thumbnail: it.thumbnail,
          sourceType: 'custom_playlist' as const,
        }))
      );
      setLoading(false);
      return;
    }

    if (source.type !== 'youtube_playlist') {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id, source?.url, source?.type, source?.items]);

  return { videos, loading, error };
}
