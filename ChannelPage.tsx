import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSourceById } from '@/hooks/useSourceById';
import { extractChannelRef } from '@/utils/youtubeParser';
import { fetchChannelPlaylists, resolveChannelHandle, type YtPlaylistInfo } from '@/lib/youtube';
import { PlaylistCard } from '@/components/common/PlaylistCard';

/** Trang danh sách playlist thuộc 1 kênh đã whitelist — tin cả kênh thì xem được mọi playlist của kênh. */
export function ChannelPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const { source, loading: loadingSource } = useSourceById(sourceId ?? null);
  const [playlists, setPlaylists] = useState<YtPlaylistInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!source) return;

    const loadPlaylists = (channelId: string) => {
      setLoading(true);
      fetchChannelPlaylists(channelId)
        .then((items) => {
          if (items.length === 0) setError('Không tải được playlist nào (thiếu VITE_YOUTUBE_API_KEY, hoặc kênh chưa có playlist công khai).');
          setPlaylists(items);
        })
        .finally(() => setLoading(false));
    };

    const { channelId, handle } = extractChannelRef(source.url);
    if (channelId) {
      loadPlaylists(channelId);
    } else if (handle) {
      // Link đã lưu vẫn ở dạng @handle (chưa từng dò qua nút "🔎 Dò tiêu đề") —
      // tự đổi sang channelId thật ngay khi mở trang, không cần sửa link thủ công.
      setLoading(true);
      resolveChannelHandle(handle)
        .then((resolved) => {
          if (resolved) loadPlaylists(resolved.channelId);
          else {
            setError(`Không đổi được "${handle}" sang channelId — kiểm tra API key YouTube, hoặc mở lại link này trong tab Thêm nội dung và bấm "Dò tiêu đề".`);
            setLoading(false);
          }
        });
    } else {
      setError('Không nhận diện được channelId từ link đã lưu.');
      setLoading(false);
    }
  }, [source?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingSource || !source) return null;

  return (
    <main className="main">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate(-1)}>
        ← Quay lại
      </button>
      <div className="section-title" style={{ marginTop: 20 }}>
        📺 {source.title}
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Đang tải danh sách playlist...</p>}
      {error && <p style={{ opacity: 0.7, color: '#e05a5a', maxWidth: 480 }}>{error}</p>}

      <div className="grid3">
        {playlists.map((p) => (
          <PlaylistCard
            key={p.playlistId}
            title={p.title}
            thumbnail={p.thumbnail}
            type="youtube_playlist"
            region="playlist"
            onClick={() =>
              navigate(`/channel/${source.id}/playlist/${p.playlistId}?title=${encodeURIComponent(p.title)}`)
            }
          />
        ))}
      </div>
    </main>
  );
}
