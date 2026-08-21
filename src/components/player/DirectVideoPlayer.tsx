import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface Props {
  url: string;
  title: string;
  onProgress?: (percent: number) => void;
  onEnded?: () => void;
  /** true khi video được mở từ trong 1 playlist — tự phát + tự vào chế độ toàn màn hình. */
  autoFullscreen?: boolean;
}

/** DirectVideoPlayer — phát link mp4 trực tiếp, hoặc m3u8 (HLS) qua thư viện hls.js khi trình duyệt chưa hỗ trợ sẵn. */
export function DirectVideoPlayer({ url, title, onProgress, onEnded, autoFullscreen }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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

    const onTimeUpdate = () => {
      if (video.duration > 0) onProgress?.((video.currentTime / video.duration) * 100);
    };
    const onEndedHandler = () => {
      onProgress?.(100);
      onEnded?.();
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEndedHandler);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEndedHandler);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div className="player-wrap" ref={wrapRef}>
      <video ref={videoRef} title={title} controls playsInline autoPlay={autoFullscreen} />
    </div>
  );
}
