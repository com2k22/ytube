import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchPlaylistItems } from '@/lib/youtube';
import { PlaylistVideosView } from './PlaylistVideosView';
import type { ResolvedVideo } from '@/types';

/** Danh sách video của 1 playlist "mượn" từ kênh đã whitelist (không lưu riêng trong whitelist). */
export function ChannelPlaylistPage() {
  const { playlistId, sourceId } = useParams<{ playlistId: string; sourceId: string }>();
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
      // TRƯỚC ĐÂY để null — "bỏ qua theo dõi tiến độ (continue-watching) cho đơn giản" vì
      // playlist này chỉ "mượn" từ kênh, không có dòng whitelist riêng của chính nó. Giờ
      // dùng ĐÚNG sourceId của KÊNH (dòng "Kênh yêu thích" trong whitelist, xem
      // allowed_sources) làm chỗ lưu tiến độ — thoả điều kiện khoá ngoại của bảng
      // watch_progress (source_id phải trỏ tới 1 dòng có thật trong allowed_sources) mà
      // không cần thêm bảng/cột gì mới. Nhờ vậy video xem từ Kênh yêu thích cũng lên được
      // khối "Tiếp tục xem" ở Trang chủ (xem HomePage.tsx).
      progressSourceId={sourceId ?? null}
      onBack={() => navigate(-1)}
    />
  );
}
