import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PlaylistVideosView } from './PlaylistVideosView';

/** Danh sách video của 1 playlist "mượn" từ kênh đã whitelist (không lưu riêng trong whitelist). */
export function ChannelPlaylistPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  if (!playlistId) return null;

  return (
    <PlaylistVideosView
      playlistId={playlistId}
      title={params.get('title') ?? 'Playlist'}
      progressSourceId={null}
      onBack={() => navigate(-1)}
    />
  );
}
