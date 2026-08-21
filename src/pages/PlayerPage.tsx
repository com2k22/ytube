import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useSourceById } from '@/hooks/useSourceById';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useWatchSession } from '@/hooks/useWatchSession';
import { SafeYouTubePlayer } from '@/components/player/SafeYouTubePlayer';
import { DirectVideoPlayer } from '@/components/player/DirectVideoPlayer';
import { VideoCard } from '@/components/common/VideoCard';
import { extractVideoId } from '@/utils/youtubeParser';
import { fetchPlaylistItems } from '@/lib/youtube';
import type { ResolvedVideo } from '@/types';

/**
 * PlayerPage — trang phát 1 video, dùng chung cho: video trong playlist đã whitelist,
 * playlist "mượn" từ kênh, hoặc video/link trực tiếp đã whitelist riêng lẻ.
 * Nhận dữ liệu qua query string: ?sourceId=&videoId=&title=&playlistId=
 */
export function PlayerPage() {
  const [params] = useSearchParams();
  const sourceId = params.get('sourceId');
  const videoIdParam = params.get('videoId');
  const titleParam = params.get('title');
  const playlistId = params.get('playlistId');

  const { activeProfile } = useProfileContext();
  const { source } = useSourceById(sourceId);
  const { saveProgress } = useWatchProgress(activeProfile?.id ?? null);
  const { session, startSession, heartbeat } = useWatchSession(activeProfile?.id ?? null);
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const [nextVideos, setNextVideos] = useState<ResolvedVideo[]>([]);

  // Xác định video/nội dung thật sự cần phát dựa trên query string hoặc nguồn đã lưu.
  let kind: 'youtube' | 'direct' | null = null;
  let ytVideoId: string | null = null;
  let directUrl: string | null = null;
  let title = titleParam ?? source?.title ?? '';

  if (videoIdParam) {
    kind = 'youtube';
    ytVideoId = videoIdParam;
  } else if (source?.type === 'youtube_video') {
    kind = 'youtube';
    ytVideoId = extractVideoId(source.url);
  } else if (source?.type === 'direct_url') {
    kind = 'direct';
    directUrl = source.url;
  }

  useEffect(() => {
    if (!title || startedRef.current) return;
    startedRef.current = true;
    startSession(title, sourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Phụ huynh bấm "Kết thúc phiên xem ngay" ở xa → tự động thoát về Trang chủ.
  useEffect(() => {
    if (session && !session.is_active) navigate('/');
  }, [session?.is_active, navigate]);

  useEffect(() => {
    // Playlist tự tạo (custom_playlist) → danh sách "video tiếp theo" đọc thẳng từ
    // source.items đã lưu sẵn, không cần gọi API YouTube.
    if (source?.type === 'custom_playlist') {
      setNextVideos(
        source.items
          .filter((it) => it.videoId !== ytVideoId)
          .map((it) => ({ videoId: it.videoId, title: it.title, thumbnail: it.thumbnail, sourceType: 'custom_playlist' as const }))
      );
      return;
    }
    if (!playlistId) {
      setNextVideos([]);
      return;
    }
    fetchPlaylistItems(playlistId).then((items) =>
      setNextVideos(
        items
          .filter((it) => it.videoId !== ytVideoId)
          .map((it) => ({ videoId: it.videoId, title: it.title, thumbnail: it.thumbnail, sourceType: 'youtube_playlist' as const }))
      )
    );
  }, [playlistId, ytVideoId, source?.type, source?.items]);

  const handleProgress = (percent: number) => {
    heartbeat(Math.round(percent * 6)); // ước lượng thô — xem README mục "Giới hạn đã biết"
    if (sourceId && ytVideoId) saveProgress(sourceId, ytVideoId, percent);
  };

  const handleEnded = () => {
    if (session?.end_after_current) navigate('/');
  };

  // Mở bất kỳ video nào — dù từ trong playlist, hay bấm trực tiếp 1 video đơn lẻ ở trang
  // chủ/kênh — đều tự phát + tự vào toàn màn hình ngay, không cần bấm thêm lần nào nữa.
  const autoFullscreen = true;

  const goToVideo = (v: ResolvedVideo) => {
    const p = new URLSearchParams({ videoId: v.videoId, title: v.title });
    if (playlistId) p.set('playlistId', playlistId);
    if (sourceId) p.set('sourceId', sourceId);
    navigate(`/player?${p.toString()}`);
  };

  return (
    <main className="main">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate(-1)}>
        ← Quay lại
      </button>

      {kind === 'youtube' && ytVideoId && (
        <SafeYouTubePlayer
          videoId={ytVideoId}
          title={title}
          onProgress={handleProgress}
          onEnded={handleEnded}
          autoFullscreen={autoFullscreen}
        />
      )}
      {kind === 'direct' && directUrl && (
        <DirectVideoPlayer
          url={directUrl}
          title={title}
          onProgress={handleProgress}
          onEnded={handleEnded}
          autoFullscreen={autoFullscreen}
        />
      )}
      {!kind && <p style={{ opacity: 0.6 }}>Đang tải video...</p>}

      <div className="section-title" style={{ marginBottom: 26 }}>
        ▶ {title}
      </div>

      {nextVideos.length > 0 && (
        <>
          <div className="section-title">📂 Video tiếp theo trong playlist</div>
          <div className="grid3">
            {nextVideos.map((v) => (
              <VideoCard key={v.videoId} title={v.title} thumbnail={v.thumbnail} onClick={() => goToVideo(v)} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
