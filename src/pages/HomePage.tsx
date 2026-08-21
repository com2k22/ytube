import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { PlaylistCard } from '@/components/common/PlaylistCard';

/** Trang chủ — 3 khu: Tiếp tục xem / Playlist đề xuất / Kênh yêu thích. */
export function HomePage() {
  const { activeProfile } = useProfileContext();
  const { sources, loading } = useAllowedSources(activeProfile?.id ?? null);
  const { summarizeSource } = useWatchProgress(activeProfile?.id ?? null);
  const navigate = useNavigate();

  if (!activeProfile) return null;

  const playable = sources.filter(
    (s) => s.type === 'youtube_playlist' || s.type === 'youtube_video' || s.type === 'direct_url' || s.type === 'custom_playlist'
  );
  const channels = sources.filter((s) => s.type === 'youtube_channel');

  const withProgress = playable.map((s) => ({ source: s, progress: summarizeSource(s.id) }));
  const continuing = withProgress.filter((x) => x.progress.inProgress);
  const others = withProgress.filter((x) => !x.progress.inProgress);

  const openSource = (sourceId: string, type: string) => {
    if (type === 'youtube_playlist' || type === 'custom_playlist') navigate(`/playlist/${sourceId}`);
    else navigate(`/player?sourceId=${sourceId}`);
  };

  return (
    <main className="main">
      <div className="greet">
        Xin chào, <span className="accent">{activeProfile.name}</span> 👋
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Đang tải nội dung...</p>}

      {!loading && sources.length === 0 && (
        <p style={{ opacity: 0.7, maxWidth: 480 }}>
          Chưa có nội dung nào trong whitelist của {activeProfile.name}. Bấm 🔒 Bố mẹ ở góc trên để thêm playlist,
          video hoặc kênh đầu tiên nhé.
        </p>
      )}

      {continuing.length > 0 && (
        <>
          <div className="section-title">▶️ Tiếp tục xem</div>
          <div className="grid3" style={{ marginBottom: 32 }}>
            {continuing.map(({ source, progress }) => (
              <PlaylistCard
                key={source.id}
                title={source.title}
                thumbnail={source.thumbnail}
                type={source.type}
                region="continue"
                inProgress
                progressPercent={progress.percent}
                onClick={() => openSource(source.id, source.type)}
              />
            ))}
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <div className="section-title">📂 Playlist đề xuất</div>
          <div className="grid3" style={{ marginBottom: 32 }}>
            {others.map(({ source }) => (
              <PlaylistCard
                key={source.id}
                title={source.title}
                thumbnail={source.thumbnail}
                type={source.type}
                region="playlist"
                onClick={() => openSource(source.id, source.type)}
              />
            ))}
          </div>
        </>
      )}

      {channels.length > 0 && (
        <>
          <div className="section-title">📺 Kênh yêu thích</div>
          <div className="shelf channel-shelf" style={{ marginBottom: 32 }}>
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="channel-item"
                data-region="channel"
                tabIndex={0}
                onClick={() => navigate(`/channel/${ch.id}`)}
              >
                <div
                  className="channel-avatar"
                  style={ch.thumbnail ? { backgroundImage: `url(${ch.thumbnail})`, backgroundSize: 'cover' } : undefined}
                >
                  {!ch.thumbnail && '📺'}
                </div>
                <div className="channel-name">{ch.title}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
