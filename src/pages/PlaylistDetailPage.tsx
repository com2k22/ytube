import { useNavigate, useParams } from 'react-router-dom';
import { useSourceById } from '@/hooks/useSourceById';
import { extractPlaylistId } from '@/utils/youtubeParser';
import { PlaylistVideosView } from './PlaylistVideosView';

/** Trang danh sách video trong 1 playlist đã whitelist — video đang xem dở lên đầu. */
export function PlaylistDetailPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const { source, loading } = useSourceById(sourceId ?? null);
  const navigate = useNavigate();

  if (loading || !source) return null;

  const playlistId = extractPlaylistId(source.url);
  if (!playlistId) {
    return (
      <main className="main">
        <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <p style={{ marginTop: 20, opacity: 0.7 }}>
          Không đọc được ID playlist từ link đã lưu ("{source.url}"). Vào 🔒 Bố mẹ để kiểm tra lại link nhé.
        </p>
      </main>
    );
  }

  return (
    <PlaylistVideosView playlistId={playlistId} title={source.title} progressSourceId={source.id} onBack={() => navigate(-1)} />
  );
}
