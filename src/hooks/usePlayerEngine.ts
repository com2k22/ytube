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
  /** 'off' (mặc định) = giữ NGUYÊN hành vi cũ — hết playlist thì dừng lại, không có "video
      tiếp theo" nữa. 'playlist' = hết playlist thì coi video ĐẦU TIÊN là "tiếp theo" (và
      video CUỐI CÙNG là "trước đó" khi đang ở video đầu) — vòng lặp lại từ đầu. CHỈ trình
      phát điện thoại (MobilePlayerHost, nút Lặp lại) truyền 'playlist'; PlayerPage (TV/iPad/
      máy tính) không truyền gì, luôn giữ hành vi cũ. */
  repeatMode?: 'off' | 'playlist';
  /** true = "video/track tiếp theo" (cả nút Next lẫn tự chuyển khi video hiện tại kết thúc)
      chọn NGẪU NHIÊN 1 video KHÁC trong playlist, thay vì đúng thứ tự — CHỈ trình phát điện
      thoại bật được (nút Trộn bài), mặc định false giữ nguyên hành vi cũ. Không đụng tới
      "video trước" (prevVideo) — bấm Trước vẫn đi đúng thứ tự, giống hầu hết app nghe nhạc
      (trộn bài chỉ áp dụng hướng TỚI). */
  shuffle?: boolean;
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
export function usePlayerEngine({
  params,
  onNavigateToVideo,
  onExit,
  repeatMode = 'off',
  shuffle = false,
}: UsePlayerEngineOptions) {
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

  // Vị trí video đang phát trong danh sách, và video đứng ngay sau/trước nó.
  //
  // "currentKey" — SỬA LỖI: trước đây so khớp bằng đúng `ytVideoId`, mà `ytVideoId` CHỈ có
  // giá trị khi kind === 'youtube'. Với video/audio kind 'direct' (link trực tiếp — Google
  // Drive/Dropbox...), `ytVideoId` luôn là null, nên currentIndex luôn ra -1 (không bao giờ
  // khớp được), khiến nextVideo/prevVideo LUÔN là null dù đang ở giữa playlist — đúng lỗi
  // "nút Bài tiếp không hiện" ở 1 số vị trí (chính xác là MỌI vị trí đang phát 1 tập kind
  // 'direct'). `v.videoId` của 1 mục 'direct' CHÍNH LÀ url (xem chú thích goToVideo bên
  // dưới) nên phải so khớp với `directUrl`, không phải `ytVideoId`, trong trường hợp đó.
  const currentKey = kind === 'direct' ? directUrl : ytVideoId;
  const currentIndex = playlistVideos.findIndex((v) => v.videoId === currentKey);
  let nextVideo = currentIndex >= 0 ? playlistVideos[currentIndex + 1] ?? null : null;
  let prevVideo = currentIndex > 0 ? playlistVideos[currentIndex - 1] : null;

  // Trộn bài (shuffle) — chọn ngẫu nhiên 1 video KHÁC video đang phát làm "video tiếp theo".
  // Tính bằng useMemo (không phải biến thường) để KHÔNG bốc số ngẫu nhiên MỚI mỗi lần
  // component vẽ lại (MobilePlayerHost thăm dò vị trí phát mỗi 500ms) — chỉ bốc lại đúng 1
  // lần mỗi khi ĐỔI bài hoặc bật/tắt trộn bài, nhờ vậy trong lúc đang nghe, "bài tiếp theo"
  // đứng yên 1 chỗ chứ không nhảy số liên tục.
  const shuffledNextVideo = useMemo(() => {
    if (!shuffle || playlistVideos.length < 2) return null;
    const others = playlistVideos.filter((v) => v.videoId !== currentKey);
    if (others.length === 0) return null;
    return others[Math.floor(Math.random() * others.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffle, playlistVideos, currentKey]);

  if (shuffle) {
    nextVideo = shuffledNextVideo;
  } else if (!nextVideo && repeatMode === 'playlist' && playlistVideos.length > 0) {
    // Hết playlist mà đang bật "Lặp lại danh sách" → video ĐẦU TIÊN coi như "tiếp theo".
    nextVideo = playlistVideos[0];
  }
  if (!prevVideo && !shuffle && repeatMode === 'playlist' && playlistVideos.length > 0) {
    // Đang ở video ĐẦU mà bật "Lặp lại danh sách" → video CUỐI coi như "trước đó".
    prevVideo = playlistVideos[playlistVideos.length - 1];
  }

  /** Danh sách hiện ở dưới trang — bỏ video đang phát ra cho gọn. */
  const nextVideos = playlistVideos.filter((v) => v.videoId !== currentKey);

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

  // Tên playlist hiện tại (để trình phát điện thoại hiện thay cho chữ "Đang phát" — xem
  // MobilePlayerHost.tsx). CHỈ có ý nghĩa khi thật sự đang ở trong 1 playlist (còn video
  // khác cùng danh sách) — video lẻ (playlistVideos rỗng) thì không có "tên playlist" nào cả,
  // trả về null để nơi gọi tự dùng lại chữ "Đang phát/Đã tạm dừng" như cũ. `source?.title` là
  // tên của CHÍNH DÒNG WHITELIST playlist đó (đặt lúc bố mẹ thêm playlist), luôn đúng dù đang
  // xem tập nào bên trong — vì goToVideo() giữ nguyên sourceId là playlist cha khi chuyển tập.
  const listTitle = playlistVideos.length > 0 ? source?.title ?? null : null;

  return {
    kind,
    ytVideoId,
    directUrl,
    title,
    listTitle,
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
