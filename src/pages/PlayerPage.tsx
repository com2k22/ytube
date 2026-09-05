import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useSourceById } from '@/hooks/useSourceById';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useWatchSession } from '@/hooks/useWatchSession';
import { useWatchStretchTicker } from '@/hooks/useWatchStretch';
import { SafeYouTubePlayer } from '@/components/player/SafeYouTubePlayer';
import { DirectVideoPlayer } from '@/components/player/DirectVideoPlayer';
import { VideoCard } from '@/components/common/VideoCard';
import { extractVideoId } from '@/utils/youtubeParser';
import { fetchPlaylistItems } from '@/lib/youtube';
import type { ResolvedVideo } from '@/types';

/**
 * PlayerPage — trang phát 1 video, dùng chung cho: video trong playlist đã whitelist,
 * playlist "mượn" từ kênh, hoặc video/link trực tiếp đã whitelist riêng lẻ.
 * Nhận dữ liệu qua query string: ?sourceId=&videoId=&directUrl=&title=&playlistId=
 *
 * Cố tình ưu tiên đọc videoId/directUrl thẳng từ query string (nếu nơi điều hướng đã biết
 * sẵn — xem HomePage.tsx) thay vì luôn chờ useSourceById tải lại từ Supabase: nhờ vậy video
 * render được NGAY ở lượt render đầu tiên, giữ được "cử chỉ bấm" của bé để trình duyệt cho
 * phép tự toàn màn hình + tự phát — chờ tải xong mới phát dễ bị chặn tự phát (màn hình đen).
 */
export function PlayerPage() {
  const [params] = useSearchParams();
  const sourceId = params.get('sourceId');
  const videoIdParam = params.get('videoId');
  const directUrlParam = params.get('directUrl');
  const titleParam = params.get('title');
  const playlistId = params.get('playlistId');

  const { activeProfile } = useProfileContext();
  const { source } = useSourceById(sourceId);
  // Toàn bộ whitelist của bé — chỉ dùng để dựng "danh sách video lẻ khác" bên dưới (không
  // phải chờ tải xong mới phát được video hiện tại, vì kind/ytVideoId/directUrl đã lấy
  // thẳng từ query string ở trên rồi).
  const { sources: allSources } = useAllowedSources(activeProfile?.id ?? null);
  const { saveProgress, positionFor, progressFor } = useWatchProgress(activeProfile?.id ?? null);
  const { session, startSession, heartbeat } = useWatchSession(activeProfile?.id ?? null);
  const navigate = useNavigate();
  const startedRef = useRef(false);
  /** Toàn bộ video của playlist, ĐÚNG THỨ TỰ (kể cả video đang phát). */
  const [playlistVideos, setPlaylistVideos] = useState<ResolvedVideo[]>([]);
  /** Số giây còn lại trước khi tự chuyển video kế tiếp. null = không đang đếm. */
  const [autoNextIn, setAutoNextIn] = useState<number | null>(null);

  // Xác định video/nội dung thật sự cần phát dựa trên query string hoặc nguồn đã lưu.
  let kind: 'youtube' | 'direct' | null = null;
  let ytVideoId: string | null = null;
  let directUrl: string | null = null;
  let title = titleParam ?? source?.title ?? '';

  if (videoIdParam) {
    kind = 'youtube';
    ytVideoId = videoIdParam;
  } else if (directUrlParam) {
    kind = 'direct';
    directUrl = directUrlParam;
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
    // Giữ NGUYÊN THỨ TỰ và giữ cả video đang phát trong danh sách — nhờ vậy mới biết được
    // "video kế tiếp" là video nào (video đứng ngay sau video đang xem), thay vì chỉ biết
    // "các video còn lại".
    if (source?.type === 'custom_playlist') {
      setPlaylistVideos(
        source.items.map((it) => ({
          videoId: it.videoId,
          title: it.title,
          thumbnail: it.thumbnail,
          sourceType: 'custom_playlist' as const,
        }))
      );
      return;
    }
    if (!playlistId) {
      setPlaylistVideos([]);
      return;
    }
    fetchPlaylistItems(playlistId).then((items) =>
      setPlaylistVideos(
        items.map((it) => ({
          videoId: it.videoId,
          title: it.title,
          thumbnail: it.thumbnail,
          sourceType: 'youtube_playlist' as const,
        }))
      )
    );
  }, [playlistId, source?.type, source?.items]);

  // Vị trí video đang phát trong danh sách, và video đứng ngay sau nó.
  const currentIndex = playlistVideos.findIndex((v) => v.videoId === ytVideoId);
  const nextVideo = currentIndex >= 0 ? playlistVideos[currentIndex + 1] ?? null : null;
  /** Danh sách hiện ở dưới trang — bỏ video đang phát ra cho gọn. */
  const nextVideos = playlistVideos.filter((v) => v.videoId !== ytVideoId);

  /**
   * "Video lẻ khác" — dùng khi đang xem 1 video KHÔNG nằm trong playlist nào (playlistVideos
   * rỗng): trước đây bấm Xuống ở màn hình này không có gì để hiện (nhường phím cho trang),
   * giờ hiện đúng danh sách các video lẻ/link trực tiếp khác trong whitelist của bé — cùng
   * kiểu 2 giai đoạn với danh sách playlist (xem SafeYouTubePlayer/DirectVideoPlayer).
   *
   * Lọc & khử trùng THEO ĐÚNG logic "Video đề xuất" ở HomePage.tsx: 1 video YouTube lẻ đã
   * được ghép sẵn vào 1 playlist tự tạo nào đó thì không tính là "lẻ" nữa (đã xem được qua
   * playlist đó rồi, hiện lại đây thành 2 lần trùng nhau).
   */
  const looseVideos = useMemo<ResolvedVideo[]>(() => {
    const idsInCustomPlaylists = new Set(
      allSources.filter((s) => s.type === 'custom_playlist').flatMap((s) => s.items.map((it) => it.videoId))
    );
    return allSources
      .filter((s) => {
        if (s.type === 'direct_url') return true;
        if (s.type === 'youtube_video') {
          const vid = extractVideoId(s.url);
          return !vid || !idsInCustomPlaylists.has(vid);
        }
        return false;
      })
      .map((s): ResolvedVideo | null => {
        if (s.type === 'direct_url') {
          return { videoId: s.url, title: s.title, thumbnail: s.thumbnail, sourceType: s.type, sourceId: s.id };
        }
        const vid = extractVideoId(s.url);
        if (!vid) return null;
        return { videoId: vid, title: s.title, thumbnail: s.thumbnail, sourceType: s.type, sourceId: s.id };
      })
      .filter((v): v is ResolvedVideo => v !== null);
  }, [allSources]);

  /** Danh sách đưa vào bảng "bấm Xuống để xem" trong trình phát: có playlist thật thì ưu
      tiên playlist đó; không có (đang xem video lẻ) thì dùng danh sách video lẻ khác. */
  const drawerVideos = playlistVideos.length > 0 ? playlistVideos : looseVideos;

  // Đếm mạch xem liên tục để biết khi nào bắt bé nghỉ giải lao (xem useWatchStretch).
  // Chỉ đếm khi trang phát đang mở VÀ cửa sổ đang hiện — bé bấm về trang chủ hay tắt màn
  // hình thì dừng đếm, không tính oan.
  const [windowVisible, setWindowVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const onVisible = () => setWindowVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  useWatchStretchTicker(windowVisible);

  const handleProgress = (percent: number, seconds: number) => {
    heartbeat(Math.round(percent * 6)); // ước lượng thô — xem README mục "Giới hạn đã biết"
    if (sourceId && ytVideoId) saveProgress(sourceId, ytVideoId, percent, seconds);
  };

  /**
   * Vị trí (giây) để tua tới khi mở video này — nhờ đó "Tiếp tục xem" thật sự phát tiếp
   * đúng chỗ đã dừng, thay vì lúc nào cũng phát lại từ đầu (xem useWatchProgress.ts).
   * Bỏ qua (coi như 0 = phát từ đầu) khi: chưa có tiến độ lưu, hoặc đã xem gần xong rồi
   * (≥ 97%) — lúc đó phát lại từ đầu hợp lý hơn là tua gần tới cuối.
   */
  const savedPercent = sourceId && ytVideoId ? progressFor(sourceId, ytVideoId) : 0;
  const startSeconds = savedPercent > 0 && savedPercent < 97 && sourceId && ytVideoId ? positionFor(sourceId, ytVideoId) : 0;

  /**
   * Chuyển sang video khác — TRONG CÙNG playlist (playlistVideos), hoặc sang 1 video lẻ
   * KHÁC HẲN trong whitelist (looseVideos, khi đang xem video lẻ và bé chọn video lẻ khác
   * qua danh sách bấm-Xuống).
   *
   * replace: true — cố ý THAY THẾ trang hiện tại trong lịch sử thay vì chồng thêm 1 trang
   * mới. Không có nó thì xem liên tiếp nhiều video xong bấm Back phải bấm nhiều lần mới ra
   * được (lùi lại từng video vừa xem một) — rất khó chịu. Có nó thì bấm Back 1 lần là về
   * thẳng chỗ cũ.
   */
  const goToVideo = (v: ResolvedVideo) => {
    const p = new URLSearchParams({ title: v.title });
    // Link trực tiếp (direct_url) đi theo tham số directUrl, video YouTube đi theo videoId
    // — v.videoId với direct_url CHÍNH LÀ url (xem chú thích trong types/index.ts).
    if (v.sourceType === 'direct_url') p.set('directUrl', v.videoId);
    else p.set('videoId', v.videoId);
    if (playlistId) p.set('playlistId', playlistId);
    // v.sourceId: video lẻ khác có DÒNG WHITELIST RIÊNG của chính nó, phải dùng đúng id đó
    // (không phải id của video đang xem) để lưu tiến độ/thống kê cho đúng video. Video
    // trong cùng 1 playlist thì không có sourceId riêng — dùng lại sourceId của trang hiện
    // tại như trước giờ (mọi video trong playlist đó dùng chung 1 dòng whitelist).
    const targetSourceId = v.sourceId ?? sourceId;
    if (targetSourceId) p.set('sourceId', targetSourceId);
    navigate(`/player?${p.toString()}`, { replace: true });
  };

  /** Video đứng ngay TRƯỚC video đang xem (dùng cho nút ⏮ / bấm nhả phím ◀). */
  const prevVideo = currentIndex > 0 ? playlistVideos[currentIndex - 1] : null;

  const handleEnded = () => {
    // Bố mẹ đã bấm "xem xong video này rồi tắt" từ xa → về trang chủ, không phát tiếp.
    if (session?.end_after_current) {
      navigate('/');
      return;
    }
    // Còn video kế tiếp trong danh sách → đếm ngược 3 giây rồi tự phát.
    if (nextVideo) setAutoNextIn(3);
  };

  /**
   * Đồng hồ đếm ngược tự chuyển video. Tách riêng khỏi handleEnded để React quản lý được
   * việc dọn dẹp: rời trang giữa chừng, hay bé bấm "Dừng lại", là bộ đếm tự huỷ, không có
   * chuyện đang xem video khác thì bị nhảy trang oan.
   */
  useEffect(() => {
    if (autoNextIn === null) return;
    if (autoNextIn <= 0) {
      setAutoNextIn(null);
      if (nextVideo) goToVideo(nextVideo);
      return;
    }
    const timer = setTimeout(() => setAutoNextIn((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNextIn, nextVideo?.videoId]);

  // Đổi sang video khác thì huỷ bộ đếm cũ (phòng khi bé tự bấm chọn video khác lúc đang đếm).
  useEffect(() => {
    setAutoNextIn(null);
  }, [ytVideoId, directUrl]);

  // Mở bất kỳ video nào — dù từ trong playlist, hay bấm trực tiếp 1 video đơn lẻ ở trang
  // chủ/kênh — đều tự phát + tự vào toàn màn hình ngay, không cần bấm thêm lần nào nữa.
  const autoFullscreen = true;

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
          startSeconds={startSeconds}
          onEnded={handleEnded}
          autoFullscreen={autoFullscreen}
          onPrev={() => prevVideo && goToVideo(prevVideo)}
          onNext={() => nextVideo && goToVideo(nextVideo)}
          hasPrev={!!prevVideo}
          hasNext={!!nextVideo}
          playlistVideos={drawerVideos}
          onSelectVideo={goToVideo}
        />
      )}
      {kind === 'direct' && directUrl && (
        <DirectVideoPlayer
          url={directUrl}
          title={title}
          onProgress={handleProgress}
          startSeconds={startSeconds}
          onEnded={handleEnded}
          autoFullscreen={autoFullscreen}
          onPrev={() => prevVideo && goToVideo(prevVideo)}
          onNext={() => nextVideo && goToVideo(nextVideo)}
          hasPrev={!!prevVideo}
          hasNext={!!nextVideo}
          playlistVideos={drawerVideos}
          onSelectVideo={goToVideo}
        />
      )}
      {!kind && <p style={{ opacity: 0.6 }}>Đang tải video...</p>}

      {/* Thanh đếm ngược tự chuyển video kế tiếp — luôn kèm nút dừng, để bé/bố mẹ chủ động
          ở lại nếu không muốn xem tiếp. */}
      {autoNextIn !== null && nextVideo && (
        <div className="autonext-bar">
          <span className="autonext-count">{autoNextIn}</span>
          <div className="autonext-text">
            <div className="autonext-label">Tự phát video tiếp theo sau {autoNextIn} giây</div>
            <div className="autonext-title">▶ {nextVideo.title}</div>
          </div>
          <button className="add-window-btn" data-region="autonext" tabIndex={0} onClick={() => setAutoNextIn(null)}>
            ✋ Dừng lại
          </button>
        </div>
      )}

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
