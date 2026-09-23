import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { SkipBack, SkipForward, Play, Pause, Captions } from 'lucide-react';
import { useTvPlayerControls, type PanelAction, type MobilePlayerAdapter } from '@/hooks/useTvPlayerControls';
import { PlayerControlBar } from './PlayerControlBar';
import { PlayerPlaylistDrawer } from './PlayerPlaylistDrawer';
import { WatchCountdownBadge } from './WatchCountdownBadge';
import type { ResolvedVideo } from '@/types';
// toPlayableUrl (bí danh của resolvePlayableUrl) — quyết định ĐÚNG 1 NƠI DUY NHẤT link nào sẽ
// thật sự được gọi để phát: Google Drive → trạm trung chuyển Drive (/api/gdrive-file, xem
// googleDrive.ts); mọi link trực tiếp KHÁC (Dropbox, mp4/m3u8 tự host...) → trạm trung chuyển
// chung (/api/proxy-download, xem directProxy.ts + api/proxy-download.js) — NÂNG CẤP so với bản
// trước đây (chỉ đổi mỗi link Drive): giờ đây MỌI link trực tiếp đều đi qua chính máy chủ app,
// không gọi thẳng ra ngoài nữa. Lý do bắt buộc: tính năng "Tải xuống nghe offline" phải fetch()
// trọn vẹn bytes để lưu cache — nhiều máy chủ ngoài (VD Dropbox) không cho phép trang khác gốc
// đọc kiểu đó (luật CORS), đi qua gốc của chính app thì không còn vướng luật này nữa. QUAN
// TRỌNG: hàm resolvePlayableUrl() này PHẢI dùng CHUNG với lúc TẢI OFFLINE (useOfflineDownloads.
// ts) — 2 nơi tính khác nhau thì link tải và link phát thật sẽ lệch nhau, Service Worker
// (public/sw.js) sẽ không tìm thấy đúng bản đã tải trong cache lúc mất mạng, xem chú thích đầy
// đủ trong directProxy.ts.
import { resolvePlayableUrl as toPlayableUrl } from '@/lib/directProxy';

interface Props {
  url: string;
  title: string;
  /** Gọi định kỳ với % đã xem (0-100) VÀ số giây hiện tại — dùng để hiện % đã xem trên thẻ
      video và tính giờ xem (Báo cáo tuần). KHÔNG còn dùng để tua tới chỗ cũ nữa — mọi video
      giờ luôn phát từ đầu (xem chú thích ở PlayerPage.tsx). */
  onProgress?: (percent: number, seconds: number) => void;
  onEnded?: () => void;
  /** true khi video được mở từ trong 1 playlist — tự vào chế độ TOÀN MÀN HÌNH CỦA TRÌNH
      DUYỆT (Fullscreen API thật). Trình phát nổi trên điện thoại (MobilePlayerHost) tự vẽ
      "toàn màn hình" riêng bằng CSS, KHÔNG dùng Fullscreen API — luôn truyền false ở đó,
      dùng riêng prop `autoplay` bên dưới để vẫn tự phát. Xem SafeYouTubePlayer.tsx (cùng ý
      nghĩa, cùng lý do tách 2 prop). */
  autoFullscreen?: boolean;
  /** true = tự phát ngay (tắt tiếng trước rồi bật lại khi chạy được). Mặc định lấy theo
      `autoFullscreen` nếu không truyền riêng — giữ nguyên hành vi cũ cho TV/desktop. */
  autoplay?: boolean;
  /** Chuyển sang video trước/sau trong playlist — chỉ còn gọi được qua nút trong bảng điều
      khiển (phím Lên) hoặc chọn thẳng trong danh sách playlist (phím Xuống), KHÔNG còn
      bấm nhả Trái/Phải nữa (xem useTvPlayerControls). */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** Danh sách video hiện trong bảng "bấm Xuống để xem" — hoặc toàn bộ video trong 1
      playlist THẬT (đúng thứ tự, kể cả video đang phát), hoặc — khi đang xem video LẺ,
      không thuộc playlist nào — danh sách các video lẻ KHÁC trong whitelist của bé (xem
      PlayerPage.tsx: biến drawerVideos). Component này không cần biết đang ở trường hợp
      nào, chỉ cần render đúng mảng được đưa vào. Rỗng/không truyền = không hiện gì cả. */
  playlistVideos?: ResolvedVideo[];
  /** Bé chọn 1 video khác trong danh sách đó (bấm OK khi danh sách đang mở). */
  onSelectVideo?: (v: ResolvedVideo) => void;
  /** Gọi 1 lần (mount) kèm "cầu nối" điều khiển trình phát thật — dùng cho trình phát nổi
      trên điện thoại (MobilePlayerHost). TV/desktop không truyền prop này — không đổi hành
      vi gì cả. Xem chú thích đầy đủ ở SafeYouTubePlayer.tsx (cùng ý nghĩa). */
  onAdapterReady?: (adapter: MobilePlayerAdapter) => void;
  /** Ảnh đại diện (thumbnail) — CHỈ dùng để hiện trên màn hình khoá điện thoại (Media
      Session API bên dưới), không ảnh hưởng gì tới hình trong app. null/không truyền =
      màn hình khoá không có ảnh, vẫn hiện được tên video bình thường. */
  artworkUrl?: string | null;
  /** Báo cho nơi gọi biết link vừa tải có THẬT SỰ có hình (video) hay chỉ có tiếng (audio
      thuần — mp3, hoặc file Drive không có khung hình) — dùng để trình phát điện thoại tự
      disable nút chuyển sang chế độ "Video" khi nội dung không có gì để xem (xem
      MobilePlayerHost.tsx). Link mp4/m3u8 luôn phát được qua thẻ <video>, kể cả khi thật ra
      chỉ có tiếng — trình duyệt vẫn nhận, chỉ là khung hình rộng 0 (videoWidth === 0), nên
      đây là cách đáng tin cậy duy nhất để biết có hình hay không (không thể đoán qua đuôi
      file: .mp4 vẫn có thể chỉ chứa track âm thanh). Gọi lại mỗi khi biết chắc (sau khi tải
      xong metadata) — KHÔNG gọi trước đó để tránh báo sai lúc chưa kịp tải. */
  onHasVideoChange?: (hasVideo: boolean) => void;
}

/** DirectVideoPlayer — phát link mp4 trực tiếp, hoặc m3u8 (HLS) qua thư viện hls.js khi trình duyệt chưa hỗ trợ sẵn. */
export function DirectVideoPlayer({
  url,
  title,
  onProgress,
  onEnded,
  autoFullscreen,
  autoplay = autoFullscreen,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  playlistVideos,
  onSelectVideo,
  onAdapterReady,
  artworkUrl,
  onHasVideoChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [paused, setPaused] = useState(false);
  /** true = còn đang tải/chưa có khung hình nào để xem — hiện đồ hoạ "Đang tải..." thay cho
      màn hình đen (xem giải thích đầy đủ ở SafeYouTubePlayer.tsx). Tắt ngay khi
      có khung hình đầu tiên (sự kiện 'loadeddata'), dù video tự phát được hay bị chặn phải
      bấm nút play bằng tay — cả 2 trường hợp đều không còn là "màn hình đen bí ẩn" nữa. */
  const [loading, setLoading] = useState(true);
  /** Thông báo lỗi khi video/âm thanh KHÔNG phát được (link hỏng, thư mục Google Drive bị tắt
      chia sẻ/tắt quyền tải xuống, mất mạng...) — khác != null thì hiện thông báo này THAY cho
      vòng tròn tải vô tận. Trước đây không bắt sự kiện 'error' của thẻ <video> nên mọi lỗi loại
      này đều hiện y hệt "đang tải" mãi mãi, không biết là đang tải chậm hay đã lỗi hẳn. */
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bấm vào 1 video trong playlist → vào toàn màn hình ngay (càng gần cử chỉ bấm của
  // người dùng càng ít khả năng bị trình duyệt chặn quyền toàn màn hình).
  useEffect(() => {
    if (autoFullscreen) {
      wrapRef.current?.requestFullscreen?.().catch(() => {
        /* không hỗ trợ/bị chặn — bỏ qua, video vẫn phát bình thường */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, autoFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setLoadError(null);
    // true = ĐÃ thử quay lại gọi thẳng nguồn gốc (bỏ qua trạm trung chuyển) cho đúng url hiện
    // tại — chỉ thử lại ĐÚNG 1 LẦN, tránh lặp mãi nếu cả 2 cách đều lỗi thật (link hỏng...).
    let usedFallback = false;

    /** Gán nguồn phát cho thẻ <video> — tách riêng thành hàm vì cần gọi lại LẦN 2 nếu trạm
        trung chuyển lỗi (xem onVideoError bên dưới): lỡ trạm trung chuyển CHƯA cấu hình xong
        (thiếu GDRIVE_SERVICE_ACCOUNT_JSON trên Vercel, hoặc /api/proxy-download đang lỗi tạm
        thời) thì tự động quay về gọi thẳng như cách cũ — không để nội dung đứng hẳn chỉ vì
        bước nâng cấp trạm trung chuyển chưa hoàn tất phía anh. */
    const applySrc = (src: string) => {
      const isHls = src.toLowerCase().includes('.m3u8');
      if (isHls && !video.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
        hlsRef.current?.destroy();
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else {
        video.src = src;
      }
    };

    applySrc(toPlayableUrl(url));

    // Trình duyệt luôn cho phép tự phát nếu video đang TẮT TIẾNG — nên chủ động tắt tiếng
    // rồi tự gọi play() (đáng tin cậy hơn nhiều so với chỉ dựa vào thuộc tính autoPlay, vốn
    // hay bị chặn khi phát có tiếng). Tự bật lại tiếng ngay khi video thật sự bắt đầu chạy.
    if (autoplay) {
      video.muted = true;
      video.play().catch(() => {
        /* vẫn có thể bị chặn trên 1 số trình duyệt/TV — bé bấm nút play trên player là được */
      });
    }
    /** Tắt sẵn mọi phụ đề đi kèm video (nếu có) — mặc định app không hiện phụ đề. */
    const hideTextTracks = () => {
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i += 1) tracks[i].mode = 'disabled';
    };
    hideTextTracks();

    const onPlaying = () => {
      hideTextTracks();
      if (autoplay) video.muted = false;
    };
    // 'loadeddata' = đã có khung hình đầu tiên để xem, dù đã BẤM PHÁT được hay chưa (autoplay
    // bị chặn thì video vẫn đứng yên ở khung hình đó, chờ bé bấm) — cả 2 trường hợp đều
    // không còn là màn hình đen "không biết đang tải hay lỗi" nữa nên tắt đồ hoạ tải ở đây.
    const onLoadedData = () => setLoading(false);

    // Bắt lỗi thật sự (link hỏng/hết quyền chia sẻ/mất mạng...) — KHÔNG để rơi vào im lặng
    // rồi đứng mãi ở màn hình "Đang tải video..." như trước, khiến phụ huynh không biết là
    // đang chậm hay đã lỗi hẳn. `video.error` cho biết chính xác loại lỗi (theo chuẩn HTML).
    const onVideoError = () => {
      const rewritten = toPlayableUrl(url);
      if (!usedFallback && rewritten !== url) {
        usedFallback = true;
        setLoading(true);
        applySrc(url);
        return;
      }
      setLoading(false);
      const mediaError = video.error;
      let msg = 'Không phát được nội dung này.';
      if (mediaError) {
        if (mediaError.code === mediaError.MEDIA_ERR_NETWORK) {
          msg = 'Lỗi mạng khi tải — kiểm tra lại kết nối Internet rồi thử lại.';
        } else if (mediaError.code === mediaError.MEDIA_ERR_DECODE) {
          msg = 'Định dạng này không phát được trên thiết bị.';
        } else if (mediaError.code === mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          // Cùng 1 mã lỗi này còn hiện ra khi Google Drive tạm thời CHẶN do phát hiện quá
          // nhiều lượt tải liên tiếp trong thời gian ngắn (dùng API key không đăng nhập dễ bị
          // Google nghi ngờ là "truy vấn tự động" hơn tài khoản đăng nhập thật) — trình duyệt
          // không phân biệt được đây với link hỏng/mất quyền, nên liệt kê đủ cả 3 khả năng.
          msg =
            'Không tải được nội dung — có thể link đã hỏng, thư mục/file Google Drive không còn ở chế độ "Bất kỳ ai có đường liên kết", hoặc Google đang tạm chặn do có quá nhiều lượt tải liên tiếp (thử lại sau vài phút hoặc vài giờ).';
        }
      }
      setLoadError(msg);
    };

    const onTimeUpdate = () => {
      if (video.duration > 0) onProgress?.((video.currentTime / video.duration) * 100, video.currentTime);
    };
    const onEndedHandler = () => {
      onProgress?.(100, 0);
      onEnded?.();
    };
    // Biết có hình hay chỉ có tiếng: chờ tới khi trình duyệt đọc xong metadata (kích thước
    // khung hình thật — 0x0 nghĩa là không có track hình nào cả) rồi mới báo ra ngoài, xem
    // chú thích đầy đủ ở khai báo prop onHasVideoChange phía trên. 'loadedmetadata' luôn xảy
    // ra TRƯỚC 'loadeddata' nên kịp báo trước khi màn hình hiện nội dung.
    const onLoadedMetadata = () => {
      onHasVideoChange?.(video.videoWidth > 0 && video.videoHeight > 0);
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onVideoError);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEndedHandler);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onVideoError);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEndedHandler);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  /** Bấm nút OK trên điều khiển TV = tạm dừng / phát tiếp (xem giải thích ở SafeYouTubePlayer). */
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    setPaused(!video.paused);
  };

  /** Bật/tắt phụ đề đi kèm video (nếu link video có sẵn phụ đề). */
  const toggleCaptions = () => {
    const video = videoRef.current;
    if (!video) return;
    const on = !captionsOn;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      video.textTracks[i].mode = on ? 'showing' : 'disabled';
    }
    setCaptionsOn(on);
  };

  // useMemo (deps rỗng): giữ ĐÚNG 1 object cho suốt vòng đời component — xem giải thích đầy
  // đủ ở SafeYouTubePlayer.tsx (cùng lý do: các hàm đọc videoRef.current lúc GỌI, không phải
  // lúc TẠO, nên luôn đúng dù đổi url; onAdapterReady chỉ bắn ra đúng 1 lần).
  const adapter = useMemo<MobilePlayerAdapter>(
    () => ({
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => videoRef.current?.duration ?? 0,
      seekTo: (seconds: number) => {
        if (videoRef.current) videoRef.current.currentTime = seconds;
      },
      isPaused: () => videoRef.current?.paused ?? true,
      play: () => videoRef.current?.play().catch(() => {}),
      pause: () => videoRef.current?.pause(),
      setPlaybackRate: (rate: number) => {
        if (videoRef.current) videoRef.current.playbackRate = rate;
      },
    }),
    []
  );

  useEffect(() => {
    onAdapterReady?.(adapter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  // --- Media Session API: cho phép hiện tên video + ảnh + nút phát/dừng/trước/sau ngay
  // trên MÀN HÌNH KHOÁ điện thoại (giống nghe nhạc/podcast bình thường) — CHỈ áp dụng cho
  // video/link trực tiếp (SafeYouTubePlayer dùng iframe khác nguồn, trình duyệt không cho
  // gắn Media Session vào đó, xem chú thích ở kế hoạch). Đây là bước cải thiện cơ hội phát
  // nền/khoá màn hình được lâu hơn, KHÔNG PHẢI đảm bảo tuyệt đối — hệ điều hành (đặc biệt
  // iOS Safari) vẫn có thể tự dừng video khi khoá máy, đây là giới hạn của nền tảng chứ
  // không phải lỗi có thể sửa được ở đây.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'Ytube',
        artwork: artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    } catch {
      /* MediaMetadata không có sẵn trên 1 số trình duyệt cũ — bỏ qua, video vẫn phát bình thường */
    }
  }, [title, artworkUrl]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    const session = navigator.mediaSession;
    const safeSetHandler = (action: MediaSessionAction, handler: (() => void) | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* trình duyệt không hỗ trợ đúng action này — bỏ qua, không ảnh hưởng các nút khác */
      }
    };
    safeSetHandler('play', () => videoRef.current?.play().catch(() => {}));
    safeSetHandler('pause', () => videoRef.current?.pause());
    safeSetHandler('seekbackward', () => {
      const video = videoRef.current;
      if (video) video.currentTime = Math.max(0, video.currentTime - 10);
    });
    safeSetHandler('seekforward', () => {
      const video = videoRef.current;
      if (video) video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    });
    safeSetHandler('previoustrack', hasPrev ? () => onPrev?.() : null);
    safeSetHandler('nexttrack', hasNext ? () => onNext?.() : null);

    return () => {
      safeSetHandler('play', null);
      safeSetHandler('pause', null);
      safeSetHandler('seekbackward', null);
      safeSetHandler('seekforward', null);
      safeSetHandler('previoustrack', null);
      safeSetHandler('nexttrack', null);
    };
  }, [onPrev, onNext, hasPrev, hasNext]);

  // Báo đúng trạng thái phát/dừng cho màn hình khoá (nút play/pause ở đó tự đổi hình theo).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof navigator === 'undefined' || !navigator.mediaSession) return;
    const updatePlaybackState = () => {
      navigator.mediaSession!.playbackState = video.paused ? 'paused' : 'playing';
    };
    video.addEventListener('play', updatePlaybackState);
    video.addEventListener('pause', updatePlaybackState);
    updatePlaybackState();
    return () => {
      video.removeEventListener('play', updatePlaybackState);
      video.removeEventListener('pause', updatePlaybackState);
    };
  }, [url]);

  const hasTextTracks = (videoRef.current?.textTracks.length ?? 0) > 0;
  const actions: PanelAction[] = [
    { key: 'prev', label: 'Video trước', icon: SkipBack, disabled: !hasPrev, onSelect: () => onPrev?.() },
    { key: 'playpause', label: paused ? 'Phát tiếp' : 'Tạm dừng', icon: paused ? Play : Pause, onSelect: togglePlay },
    { key: 'next', label: 'Video tiếp', icon: SkipForward, disabled: !hasNext, onSelect: () => onNext?.() },
    {
      key: 'cc',
      label: captionsOn ? 'Phụ đề: BẬT' : 'Phụ đề: TẮT',
      icon: Captions,
      disabled: !hasTextTracks,
      keepOpen: true,
      onSelect: toggleCaptions,
    },
  ];

  const playlist = playlistVideos ?? [];

  const { panelOpen, panelIndex, seekLabel, playlistStage, playlistIndex, centerIcon } = useTvPlayerControls({
    wrapRef,
    adapter,
    actions,
    playlistCount: playlist.length,
    onSelectPlaylistItem: (i) => {
      const v = playlist[i];
      if (v && v.videoId !== url) onSelectVideo?.(v);
    },
  });

  return (
    <div className="player-wrap" ref={wrapRef} data-region="player" tabIndex={0} onClick={togglePlay}>
      <video ref={videoRef} title={title} controls playsInline />
      {(loading || loadError) && (
        <div className="player-loading" aria-hidden="true">
          {loading && !loadError && <div className="player-loading-spinner" />}
          <div className="player-loading-text">{loadError ? `⚠️ ${loadError}` : 'Đang tải...'}</div>
        </div>
      )}
      <WatchCountdownBadge />
      {centerIcon && (
        <div className="player-center-icon" aria-hidden="true">
          {centerIcon === 'pause' ? <Pause /> : <Play />}
        </div>
      )}
      <PlayerControlBar open={panelOpen} actions={actions} activeIndex={panelIndex} seekLabel={seekLabel} />
      <PlayerPlaylistDrawer stage={playlistStage} videos={playlist} activeIndex={playlistIndex} currentVideoId={url} />
    </div>
  );
}
