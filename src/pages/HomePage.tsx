import { useNavigate } from 'react-router-dom';
import { ListVideo, Clapperboard, Tv } from 'lucide-react';
import { useProfileContext } from '@/context/ProfileContext';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { PlaylistCard } from '@/components/common/PlaylistCard';
import { extractVideoId } from '@/utils/youtubeParser';
import type { AllowedSource } from '@/types';

/** Trang chủ — 4 khu: Tiếp tục xem / Danh sách / Video đề xuất / Kênh yêu thích. */
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

  // Nội dung đang "xem dở" ở khối Tiếp tục xem VẪN hiện tiếp ở khối Playlist/Video đề xuất
  // bên dưới (không loại trừ) — để bé dễ tìm lại kể cả khi đã cuộn qua khối đầu.

  // Video YouTube đơn lẻ đã được ghép vào 1 playlist tự tạo nào đó (trong app) thì không
  // hiện riêng ở khối "Video đề xuất" nữa — đã xem được thông qua playlist đó rồi.
  const videoIdsInCustomPlaylists = new Set(
    sources.filter((s) => s.type === 'custom_playlist').flatMap((s) => s.items.map((it) => it.videoId))
  );

  const recommendedPlaylists = playable.filter((s) => s.type === 'youtube_playlist' || s.type === 'custom_playlist');
  const recommendedVideos = playable.filter((s) => {
    if (s.type === 'direct_url') return true;
    if (s.type === 'youtube_video') {
      const vid = extractVideoId(s.url);
      return !vid || !videoIdsInCustomPlaylists.has(vid);
    }
    return false;
  });

  const openSource = (source: AllowedSource) => {
    if (source.type === 'youtube_playlist' || source.type === 'custom_playlist') {
      navigate(`/playlist/${source.id}`);
      return;
    }
    // Truyền sẵn videoId/directUrl (đã có trong bộ nhớ, khỏi cần đợi PlayerPage tải lại
    // nguồn từ Supabase) để trang phát video render được NGAY trong lượt render đầu tiên —
    // nhờ đó lệnh tự vào toàn màn hình + tự phát vẫn còn nằm trong "cử chỉ bấm" của bé,
    // tránh bị trình duyệt chặn tự phát (trước đây phải đợi tải xong mới phát nên hay bị
    // chặn, ra màn hình đen).
    const params = new URLSearchParams({ sourceId: source.id, title: source.title });
    if (source.type === 'youtube_video') {
      const vid = extractVideoId(source.url);
      if (vid) params.set('videoId', vid);
    } else if (source.type === 'direct_url') {
      params.set('directUrl', source.url);
    }
    navigate(`/player?${params.toString()}`);
  };

  return (
    <main className="main">
      <div className="greet">
        Xin chào, <span className="accent">{activeProfile.name}</span> 👋
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Đang tải nội dung...</p>}

      {!loading && sources.length === 0 && (
        <p style={{ opacity: 0.7, maxWidth: 480 }}>
          Chưa có nội dung nào trong whitelist của {activeProfile.name}. Bấm 🔒 Bố mẹ ở cuối menu bên trái để thêm
          playlist, video hoặc kênh đầu tiên nhé.
        </p>
      )}

      {continuing.length > 0 && (
        <>
          <div className="section-title">▶️ Tiếp tục xem</div>
          <div className="shelf shelf-cap3" style={{ marginBottom: 32 }}>
            {continuing.map(({ source, progress }) => (
              <PlaylistCard
                key={source.id}
                title={source.title}
                thumbnail={source.thumbnail}
                type={source.type}
                region="continue"
                inProgress
                progressPercent={progress.percent}
                onClick={() => openSource(source)}
              />
            ))}
          </div>
        </>
      )}

      {recommendedPlaylists.length > 0 && (
        <>
          <div className="section-title">
            <ListVideo className="section-icon" aria-hidden="true" /> Danh sách
          </div>
          {/* Cùng kiểu hàng ngang cuộn được như khối "Tiếp tục xem" (trước đây khối này là
              lưới nhiều hàng). Vùng điều hướng đặt tên riêng "playlistrec" — KHÔNG dùng
              chung tên "playlist" với trang Kênh, vì bên đó playlist xếp lưới 3 cột, còn ở
              đây là 1 hàng ngang; dùng chung tên thì phím mũi tên sẽ chạy sai ở một trong
              hai chỗ. */}
          <div className="shelf shelf-cap3" style={{ marginBottom: 32 }}>
            {recommendedPlaylists.map((source) => (
              <PlaylistCard
                key={source.id}
                title={source.title}
                thumbnail={source.thumbnail}
                type={source.type}
                region="playlistrec"
                onClick={() => openSource(source)}
              />
            ))}
          </div>
        </>
      )}

      {recommendedVideos.length > 0 && (
        <>
          <div className="section-title">
            <Clapperboard className="section-icon" aria-hidden="true" /> Video đề xuất
          </div>
          <div className="shelf shelf-cap3" style={{ marginBottom: 32 }}>
            {recommendedVideos.map((source) => (
              <PlaylistCard
                key={source.id}
                title={source.title}
                thumbnail={source.thumbnail}
                type={source.type}
                region="videorec"
                onClick={() => openSource(source)}
              />
            ))}
          </div>
        </>
      )}

      {channels.length > 0 && (
        <>
          <div className="section-title">
            <Tv className="section-icon" aria-hidden="true" /> Kênh yêu thích
          </div>
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
