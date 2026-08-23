import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useTvPlayerControls, type PanelAction } from '@/hooks/useTvPlayerControls';
import { PlayerControlBar } from './PlayerControlBar';

interface Props {
  url: string;
  title: string;
  onProgress?: (percent: number) => void;
  onEnded?: () => void;
  /** true khi video được mở từ trong 1 playlist — tự phát + tự vào chế độ toàn màn hình. */
  autoFullscreen?: boolean;
  /** Chuyển sang video trước/sau trong playlist (bấm nhả phím ◀ ▶, hoặc nút trong bảng điều khiển). */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

/** DirectVideoPlayer — phát link mp4 trực tiếp, hoặc m3u8 (HLS) qua thư viện hls.js khi trình duyệt chưa hỗ trợ sẵn. */
export function DirectVideoPlayer({
  url,
  title,
  onProgress,
  onEnded,
  autoFullscreen,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [paused, setPaused] = useState(false);

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

    const onTimeUpdate = () => {
      if (video.duration > 0) onProgress?.((video.currentTime / video.duration) * 100);
    };
    const onEndedHandler = () => {
      onProgress?.(100);
      onEnded?.();
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEndedHandler);

    return () => {
      video.removeEventListener('playing', onPlaying);
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
    { key: 'prev', label: '⏮ Video trước', disabled: !hasPrev, onSelect: () => onPrev?.() },
    { key: 'playpause', label: paused ? '▶ Phát tiếp' : '⏸ Tạm dừng', onSelect: togglePlay },
    { key: 'next', label: '⏭ Video tiếp', disabled: !hasNext, onSelect: () => onNext?.() },
    {
      key: 'cc',
      label: captionsOn ? '💬 Phụ đề: BẬT' : '💬 Phụ đề: TẮT',
      disabled: !hasTextTracks,
      keepOpen: true,
      onSelect: toggleCaptions,
    },
  ];

  const { panelOpen, panelIndex, seekLabel } = useTvPlayerControls({
    wrapRef,
    adapter,
    actions,
    onPrev: hasPrev ? onPrev : undefined,
    onNext: hasNext ? onNext : undefined,
  });

  return (
    <div className="player-wrap" ref={wrapRef} data-region="player" tabIndex={0} onClick={togglePlay}>
      <video ref={videoRef} title={title} controls playsInline />
      <PlayerControlBar open={panelOpen} actions={actions} activeIndex={panelIndex} seekLabel={seekLabel} />
    </div>
  );
}
