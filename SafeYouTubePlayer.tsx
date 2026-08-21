import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;

/** Nạp script chính thức của YouTube IFrame Player API (chỉ 1 lần cho cả app). */
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiLoadPromise;
}

interface Props {
  videoId: string;
  title: string;
  /** Gọi định kỳ (mỗi ~5s) với % đã xem (0-100) — dùng để lưu "tiếp tục xem". */
  onProgress?: (percent: number) => void;
  /** Gọi khi video phát xong — dùng cho "xem xong phiên rồi tắt" / tự chuyển video kế tiếp. */
  onEnded?: () => void;
}

/**
 * SafeYouTubePlayer — nhúng video qua youtube-nocookie.com (bản riêng tư của YouTube),
 * với rel=0 + modestbranding=1 + iv_load_policy=3 để KHÔNG hiện gợi ý video liên quan.
 * Dùng chính thức YouTube IFrame Player API để theo dõi tiến độ xem thật.
 */
export function SafeYouTubePlayer({ videoId, title, onProgress, onEnded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1 },
        events: {
          onReady: () => {
            intervalRef.current = setInterval(() => {
              const p = playerRef.current;
              if (!p?.getDuration) return;
              const duration = p.getDuration();
              const current = p.getCurrentTime();
              if (duration > 0) onProgressRef.current?.(Math.min(100, (current / duration) * 100));
            }, 5000);
          },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) {
              onProgressRef.current?.(100);
              onEndedRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="player-wrap">
      <div ref={containerRef} title={title} />
    </div>
  );
}
