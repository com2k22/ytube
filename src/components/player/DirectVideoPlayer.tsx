import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { SkipBack, SkipForward, Play, Pause, Captions } from 'lucide-react';
import { useTvPlayerControls, type PanelAction } from '@/hooks/useTvPlayerControls';
import { PlayerControlBar } from './PlayerControlBar';
import { PlayerPlaylistDrawer } from './PlayerPlaylistDrawer';
import { WatchCountdownBadge } from './WatchCountdownBadge';
import type { ResolvedVideo } from '@/types';

interface Props {
  url: string;
  title: string;
  /** Gọi định kỳ với % đã xem (0-100) VÀ số giây hiện tại — dùng để lưu "tiếp tục xem". */
  onProgress?: (percent: number, seconds: number) => void;
  /** Vị trí xem dở lần trước (giây) — tua tới đây ngay khi video có thể tua được, để "Tiếp
      tục xem" phát đúng chỗ đã dừng thay vì phát lại từ đầu. 0/undefined = phát từ đầu. */
  startSeconds?: number;
  onEnded?: () => void;
  /** true khi video được mở từ trong 1 playlist — tự phát + tự vào chế độ toàn màn hình. */
  autoFullscreen?: boolean;
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
}

/** DirectVideoPlayer — phát link mp4 trực tiếp, hoặc m3u8 (HLS) qua thư viện hls.js khi trình duyệt chưa hỗ trợ sẵn. */
export function DirectVideoPlayer({
  url,
  title,
  onProgress,
  startSeconds,
  onEnded,
  autoFullscreen,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  playlistVideos,
  onSelectVideo,
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
    if (autoFullscreen) {
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
      if (autoFullscreen) video.muted = false;
    };
    // 'loadeddata' = đã có khung hình đầu tiên để xem, dù đã BẤM PHÁT được hay chưa (autoplay
    // bị chặn thì video vẫn đứng yên ở khung hình đó, chờ bé bấm) — cả 2 trường hợp đều
    // không còn là màn hình đen "không biết đang tải hay lỗi" nữa nên tắt đồ hoạ tải ở đây.
    const onLoadedData = () => setLoading(false);

    /** Tua tới chỗ xem dở lần trước — chỉ làm được khi đã biết duration (metadata tải xong),
        và chỉ tua 1 LẦN cho mỗi lượt mở video (đặt qua ref, không phải state, để không phụ
        thuộc thứ tự render). Bỏ qua nếu là link HLS đang chờ hls.js đính kèm — nghe cùng
        sự kiện này trên chính thẻ <video> vẫn hoạt động bình thường vì hls.js phát ra sự
        kiện chuẩn của HTML5 video. */
    const onLoadedMetadata = () => {
      if (startSeconds && startSeconds > 0 && startSeconds < video.duration) {
        video.currentTime = startSeconds;
      }
    };

    const onTimeUpdate = () => {
      if (video.duration > 0) onProgress?.((video.currentTime / video.duration) * 100, video.currentTime);
    };
    const onEndedHandler = () => {
      onProgress?.(100, 0);
      onEnded?.();
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEndedHandler);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
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

  const adapter = {
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
    seekTo: (seconds: number) => {
      if (videoRef.current) videoRef.current.currentTime = seconds;
    },
    isPaused: () => videoRef.current?.paused ?? true,
    play: () => videoRef.current?.play().catch(() => {}),
    pause: () => videoRef.current?.pause(),
  };

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
