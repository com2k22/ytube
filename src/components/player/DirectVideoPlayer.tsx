import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { SkipBack, SkipForward, Play, Pause, Captions } from 'lucide-react';
import { useTvPlayerControls, type PanelAction, type MobilePlayerAdapter } from '@/hooks/useTvPlayerControls';
import { PlayerControlBar } from './PlayerControlBar';
import { PlayerPlaylistDrawer } from './PlayerPlaylistDrawer';
import { WatchCountdownBadge } from './WatchCountdownBadge';
import type { ResolvedVideo } from '@/types';

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
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [paused, setPaused] = useState(false);
  /** true = còn đang tải/chưa có khung hình nào để xem — hiện đồ hoạ "Đang tải video..."
      thay cho màn hình đen (xem giải thích đầy đủ ở SafeYouTubePlayer.tsx). Tắt ngay khi
      có khung hình đầu tiên (sự kiện 'loadeddata'), dù video tự phát được hay bị chặn phải
      bấm nút play bằng tay — cả 2 trường hợp đều không còn là "màn hình đen bí ẩn" nữa. */
  const [loading, setLoading] = useState(true);

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

    const isHls = url.toLowerCase().includes('.m3u8');
    if (isHls && !video.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else {
      video.src = url;
    }

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

    const onTimeUpdate = () => {
      if (video.duration > 0) onProgress?.((video.currentTime / video.duration) * 100, video.currentTime);
    };
    const onEndedHandler = () => {
      onProgress?.(100, 0);
      onEnded?.();
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEndedHandler);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('loadeddata', onLoadedData);
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
      {loading && (
        <div className="player-loading" aria-hidden="true">
          <div className="player-loading-spinner" />
          <div className="player-loading-text">Đang tải video...</div>
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
