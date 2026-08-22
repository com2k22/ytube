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
  /** true khi video được mở từ trong 1 playlist — tự phát + tự vào chế độ toàn màn hình. */
  autoFullscreen?: boolean;
}

/**
 * SafeYouTubePlayer — nhúng video qua youtube-nocookie.com (bản riêng tư của YouTube),
 * với rel=0 + modestbranding=1 + iv_load_policy=3 để KHÔNG hiện gợi ý video liên quan.
 * Dùng chính thức YouTube IFrame Player API để theo dõi tiến độ xem thật.
 */
export function SafeYouTubePlayer({ videoId, title, onProgress, onEnded, autoFullscreen }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const unmutedRef = useRef(false);
  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;

  // Bấm vào 1 video trong playlist → vào toàn màn hình ngay, càng gần lúc bấm (cử chỉ
  // của người dùng) càng ít khả năng bị trình duyệt chặn, nên gọi sớm ở đây thay vì
  // đợi script YouTube IFrame API tải xong (có thể mất thêm 1 nhịp mạng).
  useEffect(() => {
    if (autoFullscreen) {
      wrapRef.current?.requestFullscreen?.().catch(() => {
        /* 1 số trình duyệt/TV không hỗ trợ hoặc chặn — bỏ qua, video vẫn phát bình thường */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, autoFullscreen]);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          autoplay: autoFullscreen ? 1 : 0,
        },
        events: {
          onReady: () => {
            if (autoFullscreen) {
              // Trình duyệt luôn cho phép tự phát nếu video đang TẮT TIẾNG — nên chủ động
              // tắt tiếng rồi tự bấm play qua API (đáng tin cậy hơn nhiều so với chỉ dựa
              // vào tham số autoplay=1 trên URL, vốn hay bị chặn). Video sẽ tự bật lại
              // tiếng ngay khi bắt đầu phát thật sự — xem onStateChange bên dưới.
              playerRef.current?.mute?.();
              playerRef.current?.playVideo?.();
            }
            intervalRef.current = setInterval(() => {
              const p = playerRef.current;
              if (!p?.getDuration) return;
              const duration = p.getDuration();
              const current = p.getCurrentTime();
              if (duration > 0) onProgressRef.current?.(Math.min(100, (current / duration) * 100));
            }, 5000);
          },
          onStateChange: (e: any) => {
            if (autoFullscreen && !unmutedRef.current && e.data === window.YT.PlayerState.PLAYING) {
              unmutedRef.current = true;
              playerRef.current?.unMute?.();
            }
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

  /**
   * Bấm nút OK trên điều khiển TV = tạm dừng / phát tiếp.
   *
   * Trước đây bấm OK lại thoát toàn màn hình và quay về trang trước. Lý do: bộ điều hướng
   * bằng phím mũi tên (useTvNavigation) hiểu phím Enter là "bấm vào ô đang chọn", mà ô
   * đang chọn lúc đó là nút "← Quay lại" — nên OK = bấm Quay lại.
   * Cách sửa: cho chính khung video này thành 1 ô chọn được (data-region="player"), và
   * khi mở trang phát thì con trỏ đặt sẵn vào đây (xem resetFocus trong useTvNavigation).
   * Nhờ vậy OK rơi đúng vào hàm này. Muốn thoát thì bấm nút Back của điều khiển.
   */
  const togglePlay = () => {
    const p = playerRef.current;
    const YT = window.YT;
    if (!p?.getPlayerState || !YT?.PlayerState) return;
    if (p.getPlayerState() === YT.PlayerState.PLAYING) p.pauseVideo?.();
    else p.playVideo?.();
  };

  return (
    <div className="player-wrap" ref={wrapRef} data-region="player" tabIndex={0} onClick={togglePlay}>
      <div ref={containerRef} title={title} />
    </div>
  );
}
