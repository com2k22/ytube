import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfileContext } from '@/context/ProfileContext';
import { useSourceById } from '@/hooks/useSourceById';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useWatchSession } from '@/hooks/useWatchSession';
import { useWatchStretchTicker } from '@/hooks/useWatchStretch';
import { extractVideoId } from '@/utils/youtubeParser';
import { fetchPlaylistItems } from '@/lib/youtube';
import type { ResolvedVideo } from '@/types';

/** Các tham số xác định "đang phát video nào" — TRÙNG với các tham số query string mà
    PlayerPage.tsx (TV/iPad/máy tính) vẫn dùng lâu nay (?sourceId=&videoId=&directUrl=&
    title=&playlistId=), nhưng tách thành 1 object riêng để dùng được ở CẢ 2 nơi: PlayerPage
    (đọc từ URL) và trình phát nổi trên điện thoại — MobilePlayerHost (đọc từ
    MobilePlaybackContext, không đổi URL mỗi lần chuyển bài vì phải sống sót qua việc bé
    chuyển trang). */
export interface PlayerEngineParams {
  sourceId: string | null;
  videoId: string | null;
  directUrl: string | null;
  title: string | null;
  playlistId: string | null;
  /** Ảnh đại diện — CHỈ dùng để vẽ mini player/màn hình "âm thanh" trên điện thoại (xem
      MobilePlayerHost); PlayerPage (TV/iPad/máy tính) bỏ qua trường này. Không bắt buộc vì
      nơi khởi tạo lần đầu (mở trực tiếp URL /player, không qua danh sách nào) có thể không
      có sẵn ảnh. */
  thumbnail?: string | null;
}

/**
 * playerParamsToSearch — đổi PlayerEngineParams thành query string cho URL `/player?...`.
 * Dùng CHUNG cho mọi nơi cần điều hướng tới trang phát bằng URL (PlayerPage.tsx, và các
 * trang mở video từ Trang chủ/Kênh/danh sách playlist) — trước đây mỗi trang tự viết lại
 * đoạn `new URLSearchParams({...})` này riêng, dễ lệch nhau (thiếu tham số, sai thứ tự ưu
 * tiên videoId/directUrl...). `thumbnail` KHÔNG đưa vào URL (chỉ có ý nghĩa trong bộ nhớ cho
 * trình phát nổi trên điện thoại — xem PlayerEngineParams).
 */
export function playerParamsToSearch(params: PlayerEngineParams): string {
  const p = new URLSearchParams({ title: params.title ?? '' });
  if (params.directUrl) p.set('directUrl', params.directUrl);
  else if (params.videoId) p.set('videoId', params.videoId);
  if (params.playlistId) p.set('playlistId', params.playlistId);
  if (params.sourceId) p.set('sourceId', params.sourceId);
  return p.toString();
}

interface UsePlayerEngineOptions {
  params: PlayerEngineParams;
  /** Chuyển sang phát 1 video KHÁC (video trước/sau trong playlist, hoặc 1 video lẻ khác
      bé chọn trong danh sách "bấm Xuống để xem"). Nơi gọi tự quyết định làm gì với tham số
      mới: PlayerPage (TV/iPad/máy tính) đổi URL `/player?...`; trình phát nổi trên điện
      thoại chỉ cần cập nhật lại state trong MobilePlaybackContext, KHÔNG đổi URL — nhờ vậy
      trình phát không bị unmount/mount lại khi bé đang lướt sang trang khác. */
  onNavigateToVideo: (next: PlayerEngineParams) => void;
  /** Rời khỏi màn hình phát hẳn — bố mẹ đã "Kết thúc phiên xem" từ xa, hoặc bố mẹ đặt "xem
      xong video này rồi tắt" và video vừa xem xong. PlayerPage điều hướng về Trang chủ;
      trình phát nổi trên điện thoại đóng lại (ẩn mini-bar/màn hình toàn màn hình). */
  onExit: () => void;
}

/**
 * usePlayerEngine — TOÀN BỘ logic "nghiệp vụ" của việc phát 1 video (khác với phần GIAO
 * DIỆN): xác định video/nguồn cần phát, tải playlist, lưu tiến độ xem, phiên xem
 * (useWatchSession — dùng cho "Báo cáo tuần" + để bố mẹ thấy đang xem gì/kết thúc từ xa),
 * mạch xem liên tục (useWatchStretchTicker — nghỉ giải lao), danh sách "video tiếp theo"/
 * "video lẻ khác", và đếm ngược tự chuyển video kế tiếp.
 *
 * Tách ra từ PlayerPage.tsx (giữ NGUYÊN VĂN mọi hành vi cho TV/iPad/máy tính — xem PlayerPage
 * dùng hook này y hệt logic cũ) để dùng lại được ở trình phát nổi trên điện thoại
 * (MobilePlayerHost), thay vì viết 2 lần và có nguy cơ lệch nhau (tiến độ xem, phiên xem,
 * đếm giờ nghỉ giải lao... đều là những phần TUYỆT ĐỐI không được có 2 hệ thống riêng).
 */
export function usePlayerEngine({ params, onNavigateToVideo, onExit }: UsePlayerEngineOptions) {
  const { sourceId, videoId: videoIdParam, directUrl: directUrlParam, title: titleParam, playlistId } = params;

  const { activeProfile } = useProfileContext();
  const { source } = useSourceById(sourceId);
  // Toàn bộ whitelist của bé — chỉ dùng để dựng "danh sách video lẻ khác" bên dưới (không
  // phải chờ tải xong mới phát được video hiện tại, vì kind/ytVideoId/directUrl đã lấy
  // thẳng từ tham số truyền vào rồi).
  const { sources: allSources } = useAllowedSources(activeProfile?.id ?? null);
  const { saveProgress } = useWatchProgress(activeProfile?.id ?? null);
  const { session, startSession, heartbeat } = useWatchSession(activeProfile?.id ?? null);
  const startedRef = useRef(false);
  /** Toàn bộ video của playlist, ĐÚNG THỨ TỰ (kể cả video đang phát). */
  const [playlistVideos, setPlaylistVideos] = useState<ResolvedVideo[]>([]);
  /** Số giây còn lại trước khi tự chuyển video kế tiếp. null = không đang đếm. */
  const [autoNextIn, setAutoNextIn] = useState<number | null>(null);

  // Xác định video/nội dung thật sự cần phát dựa trên tham số truyền vào hoặc nguồn đã lưu.
  let kind: 'youtube' | 'direct' | null = null;
  let ytVideoId: string | null = null;
  let directUrl: string | null = null;
  const title = titleParam ?? source?.title ?? '';

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

  // Phụ huynh bấm "Kết thúc phiên xem ngay" ở xa → tự động thoát.
  useEffect(() => {
    if (session && !session.is_active) onExit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.is_active]);

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
          // it.kind === 'direct' (VD: ghép từ "Nhập cả thư mục tổng" Google Drive) → đánh dấu
          // sourceType 'direct_url' để goToVideo() bên dưới biết đường phát qua directUrl thay
          // vì videoId — video YouTube thường (kind mặc định/thiếu) giữ nguyên như cũ.
          sourceType: (it.kind === 'direct' ? 'direct_url' : 'custom_playlist') as const,
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

  // Vị trí video đang phát trong danh sách, và video đứng ngay sau/trước nó. Video đang phát
  // có thể là 1 video YouTube (nhận diện qua ytVideoId) HOẶC 1 link trực tiếp/Google Drive
  // (nhận diện qua directUrl, lưu trong đúng trường "videoId" của playlist item — xem
  // CustomPlaylistItem trong types/index.ts) — dùng "currentMediaId" gộp cả 2 trường hợp để
  // playlist trộn cả video YouTube lẫn nội dung Drive vẫn tìm đúng video đang phát.
  const currentMediaId = ytVideoId ?? directUrl;
  const currentIndex = playlistVideos.findIndex((v) => v.videoId === currentMediaId);
  const nextVideo = currentIndex >= 0 ? playlistVideos[currentIndex + 1] ?? null : null;
  const prevVideo = currentIndex > 0 ? playlistVideos[currentIndex - 1] : null;
  /** Danh sách hiện ở dưới trang — bỏ video đang phát ra cho gọn. */
  const nextVideos = playlistVideos.filter((v) => v.videoId !== currentMediaId);

  /**
   * "Video lẻ khác" — dùng khi đang xem 1 video KHÔNG nằm trong playlist nào (playlistVideos
   * rỗng). Lọc & khử trùng THEO ĐÚNG logic "Video đề xuất" ở HomePage.tsx: 1 video YouTube lẻ
   * đã được ghép sẵn vào 1 playlist tự tạo nào đó thì không tính là "lẻ" nữa.
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

  /** Danh sách đưa vào bảng "bấm Xuống để xem" (TV) / danh sách chờ (điện thoại): có
      playlist thật thì ưu tiên playlist đó; không có (đang xem video lẻ) thì dùng danh sách
      video lẻ khác. */
  const drawerVideos = playlistVideos.length > 0 ? playlistVideos : looseVideos;

  // Đếm mạch xem liên tục để biết khi nào bắt bé nghỉ giải lao (xem useWatchStretch). Chỉ
  // đếm khi cửa sổ đang hiện — bé tắt màn hình thì dừng đếm, không tính oan.
  const [windowVisible, setWindowVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const onVisible = () => setWindowVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  useWatchStretchTicker(windowVisible);

  const handleProgress = useCallback(
    (percent: number, seconds: number) => {
      heartbeat(Math.round(percent * 6)); // ước lượng thô — xem README mục "Giới hạn đã biết"
      if (sourceId && ytVideoId) saveProgress(sourceId, ytVideoId, percent, seconds);
    },
    [heartbeat, saveProgress, sourceId, ytVideoId]
  );

  /**
   * Chuyển sang video khác — TRONG CÙNG playlist, hoặc sang 1 video lẻ KHÁC HẲN trong
   * whitelist (khi đang xem video lẻ và bé chọn video lẻ khác qua danh sách bấm-Xuống/mini
   * player). Tự tính sẵn sourceId đúng cho video đích rồi giao lại cho nơi gọi qua
   * `onNavigateToVideo` — PlayerPage đổi URL, trình phát điện thoại chỉ cập nhật state.
   */
  const goToVideo = useCallback(
    (v: ResolvedVideo) => {
      // v.sourceId: video lẻ khác có DÒNG WHITELIST RIÊNG của chính nó, phải dùng đúng id đó
      // (không phải id của video đang xem) để lưu tiến độ/thống kê cho đúng video. Video
      // trong cùng 1 playlist thì không có sourceId riêng — dùng lại sourceId hiện tại.
      const targetSourceId = v.sourceId ?? sourceId ?? null;
      onNavigateToVideo({
        sourceId: targetSourceId,
        title: v.title,
        // Link trực tiếp (direct_url) đi theo directUrl, video YouTube đi theo videoId — với
        // direct_url thì v.videoId CHÍNH LÀ url (xem chú thích trong types/index.ts).
        videoId: v.sourceType === 'direct_url' ? null : v.videoId,
        directUrl: v.sourceType === 'direct_url' ? v.videoId : null,
        playlistId: playlistId ?? null,
        thumbnail: v.thumbnail ?? null,
      });
    },
    [sourceId, playlistId, onNavigateToVideo]
  );

  const handleEnded = useCallback(() => {
    // Bố mẹ đã bấm "xem xong video này rồi tắt" từ xa → thoát, không phát tiếp.
    if (session?.end_after_current) {
      onExit();
      return;
    }
    // Còn video kế tiếp trong danh sách → đếm ngược 3 giây rồi tự phát.
    if (nextVideo) setAutoNextIn(3);
  }, [session?.end_after_current, onExit, nextVideo]);

  /**
   * Đồng hồ đếm ngược tự chuyển video. Tách riêng khỏi handleEnded để React quản lý được
   * việc dọn dẹp: rời màn hình phát giữa chừng, hay bé bấm "Dừng lại", là bộ đếm tự huỷ.
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

  return {
    kind,
    ytVideoId,
    directUrl,
    title,
    handleProgress,
    handleEnded,
    goToVideo,
    prevVideo,
    nextVideo,
    nextVideos,
    drawerVideos,
    autoNextIn,
    setAutoNextIn,
  };
}
