import { useEffect, useMemo, useRef, useState } from 'react';
import { SkipBack, SkipForward, Play, Pause, Captions } from 'lucide-react';
import { useTvPlayerControls, type PanelAction, type MobilePlayerAdapter } from '@/hooks/useTvPlayerControls';
import { PlayerControlBar } from './PlayerControlBar';
import { PlayerPlaylistDrawer } from './PlayerPlaylistDrawer';
import { WatchCountdownBadge } from './WatchCountdownBadge';
import type { ResolvedVideo } from '@/types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;

/**
 * Nạp script chính thức của YouTube IFrame Player API (chỉ 1 lần cho cả app).
 *
 * "export" để HomePage.tsx gọi TRƯỚC, ngay khi vào Trang chủ — lúc đó bé/bố mẹ còn đang
 * chọn video, chưa cần phát gì cả, nên tải sẵn script này trong lúc rảnh (không làm chậm
 * gì thêm). Nhờ vậy tới lúc THẬT SỰ bấm 1 video thì script đã có sẵn, đỡ mất thêm 1 nhịp
 * mạng — cải thiện tốc độ mở video cho MỌI thiết bị, rõ nhất trên TV (mạng/CPU yếu hơn
 * máy tính, 1 nhịp mạng chờ tải script cũng đủ tạo cảm giác giật/chờ lâu). Gọi lại nhiều
 * lần cũng không sao — hàm tự biết nếu script đã tải xong hoặc đang tải dở thì dùng lại,
 * không tải thêm lần nữa (xem 2 dòng if đầu tiên bên dưới).
 */
export function loadYouTubeApi(): Promise<void> {
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
  /** Gọi định kỳ (mỗi ~5s) với % đã xem (0-100) VÀ số giây hiện tại — dùng để hiện % đã xem
      trên thẻ video, và để tính vào thống kê giờ xem (Báo cáo tuần). Khối "Tiếp tục xem" ở
      Trang chủ vẫn dựa vào % này để biết video nào đang xem dở — CHỈ KHÔNG còn dùng số giây
      này để tua tới chỗ cũ nữa (xem chú thích ở PlayerPage.tsx: mọi video giờ luôn phát từ
      đầu, kể cả bấm vào từ "Tiếp tục xem" — bỏ hẳn việc tua vì hay bị chậm/treo trên TV). */
  onProgress?: (percent: number, seconds: number) => void;
  /** Gọi khi video phát xong — dùng cho "xem xong phiên rồi tắt" / tự chuyển video kế tiếp. */
  onEnded?: () => void;
  /** true khi video được mở từ trong 1 playlist — tự vào chế độ TOÀN MÀN HÌNH CỦA TRÌNH
      DUYỆT (Fullscreen API). TV/desktop dùng đúng nghĩa này. Trình phát nổi trên điện thoại
      (MobilePlayerHost) KHÔNG dùng Fullscreen API thật — nó tự vẽ giao diện "toàn màn hình"
      riêng bằng CSS (để còn giữ được thanh trạng thái/nút thu nhỏ của app) — nên luôn truyền
      false ở đó, và dùng riêng prop `autoplay` bên dưới để vẫn tự phát. */
  autoFullscreen?: boolean;
  /** true = tự phát ngay khi vào (tắt tiếng trước rồi tự bật lại khi chạy được — xem trong
      component). Mặc định LẤY THEO `autoFullscreen` nếu không truyền riêng — giữ nguyên hành
      vi cũ cho TV/desktop (2 khái niệm trước đây gộp làm 1). Trình phát nổi trên điện thoại
      truyền `autoFullscreen={false}` + `autoplay={true}` để tự phát mà KHÔNG bật Fullscreen
      API thật. */
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
      trên điện thoại (MobilePlayerHost), để giao diện chạm (▶/⏸, kéo thanh tiến độ, tốc độ
      phát...) điều khiển ĐÚNG trình phát YouTube này, không tạo trình phát thứ 2. TV/desktop
      không truyền prop này — không đổi hành vi gì cả. */
  onAdapterReady?: (adapter: MobilePlayerAdapter) => void;
}

/**
 * SafeYouTubePlayer — nhúng video qua youtube-nocookie.com (bản riêng tư của YouTube),
 * với rel=0 + modestbranding=1 + iv_load_policy=3 để KHÔNG hiện gợi ý video liên quan.
 * Dùng chính thức YouTube IFrame Player API để theo dõi tiến độ xem thật.
 */
export function SafeYouTubePlayer({
  videoId,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const unmutedRef = useRef(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [paused, setPaused] = useState(false);
  /** true = còn đang tải/chưa phát được khung hình nào — hiện đồ hoạ "Đang tải..." thay cho
      màn hình đen, để bé/bố mẹ biết đây là đang chờ chứ không phải lỗi (xem
      .player-loading trong theme.css). Tắt ngay khi video thật sự bắt đầu chạy khung hình
      đầu tiên (state PLAYING) — sớm hơn thời điểm "đã tải xong 100%" nhiều. */
  const [loading, setLoading] = useState(true);
  /** Bản ref của captionsOn — để callback của YouTube (gắn 1 lần) đọc được giá trị mới nhất. */
  const captionsOnRef = useRef(false);
  captionsOnRef.current = captionsOn;
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

  /**
   * Tắt phụ đề (CC) của trình phát YouTube.
   *
   * Vì sao phải làm bằng tay thế này: tài liệu chính thức của YouTube CHỈ có tham số ép
   * BẬT phụ đề (cc_load_policy=1), KHÔNG có tham số nào ép tắt. Để 0 thì YouTube vẫn tự
   * bật lại theo thói quen xem trước đó. Cách duy nhất tắt được là gọi unloadModule để gỡ
   * hẳn bộ phụ đề ra khỏi trình phát. Hàm này không nằm trong tài liệu chính thức nhưng là
   * cách được dùng phổ biến và có tác dụng thật; gọi cả 2 tên module vì trình phát YouTube
   * qua các đời dùng lúc thì 'captions', lúc thì 'cc'.
   *
   * Lưu ý: nếu chữ đã được ĐỐT SẴN vào hình ảnh video (kiểu video có sẵn chữ trên hình)
   * thì không cách nào tắt được — đó là một phần của hình, không phải phụ đề.
   */
  const hideCaptions = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.unloadModule?.('captions');
      p.unloadModule?.('cc');
    } catch {
      /* trình phát đời khác không có hàm này — bỏ qua, không ảnh hưởng việc xem */
    }
  };

  /** Bật lại phụ đề (ngược với hideCaptions) — dùng cho nút bật/tắt phụ đề. */
  const showCaptions = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.loadModule?.('captions');
      p.loadModule?.('cc');
    } catch {
      /* bỏ qua */
    }
  };

  const toggleCaptions = () => {
    setCaptionsOn((on) => {
      if (on) hideCaptions();
      else showCaptions();
      return !on;
    });
  };

  useEffect(() => {
    let cancelled = false;
    // QUAN TRỌNG — đặt lại cờ "đã bật tiếng" mỗi khi ĐỔI SANG VIDEO KHÁC.
    // Đây chính là lỗi "video tự chuyển tiếp thì bị mất tiếng": trang phát không dựng lại
    // từ đầu khi chuyển video (chỉ đổi videoId), nên cờ này vẫn còn = true từ video trước.
    // Video mới lại được tắt tiếng để tự phát cho chắc, mà cờ đang bật nên không ai bật
    // tiếng lại nữa → xem tiếp trong im lặng.
    unmutedRef.current = false;
    setCaptionsOn(false);
    setPaused(false);
    setLoading(true);

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
          autoplay: autoplay ? 1 : 0,
          // mute: 1 ngay từ đầu (không chỉ gọi mute() sau ở onReady) — đây mới là chỗ sửa
          // lỗi "phải bấm Play bằng tay" trên điện thoại. Lý do: khung nhúng YouTube nằm ở
          // 1 "trang" khác (iframe riêng, khác domain) — lệnh mute()/playVideo() app gọi ở
          // onReady bên dưới phải đi qua 1 tin nhắn (postMessage) gửi SANG trang đó, đến
          // chậm hơn 1 nhịp so với lúc iframe tự tải xong và lập tức thử tự phát CÓ TIẾNG
          // theo tham số autoplay=1 — nhiều trình duyệt trên điện thoại chặn ngay lần thử
          // có tiếng đầu tiên này, và sau khi đã bị chặn 1 lần thì lệnh playVideo() gửi tới
          // sau đó (dù đã tắt tiếng) cũng không tự chạy lại được nữa, phải bé/bố mẹ tự bấm
          // Play mới chạy. Đặt mute=1 thẳng vào đây khiến lần thử tự phát ĐẦU TIÊN đã tắt
          // tiếng sẵn — trình duyệt luôn cho phép việc này, không còn bị chặn nữa.
          mute: autoplay ? 1 : 0,
          // cc_load_policy: 0 = KHÔNG chủ động bật phụ đề. Lưu ý: YouTube không có tham số
          // nào ép TẮT hẳn phụ đề — chỉ có tham số ép BẬT (đặt 1). Khi để 0, YouTube vẫn có
          // thể tự bật lại theo thói quen xem trước đó của thiết bị. Vì vậy còn phải gỡ hẳn
          // bộ phụ đề bằng tay ở phần onReady bên dưới.
          cc_load_policy: 0,
        },
        events: {
          onReady: () => {
            hideCaptions();
            if (autoplay) {
              // Trình duyệt luôn cho phép tự phát nếu video đang TẮT TIẾNG — nên chủ động
              // tắt tiếng rồi tự bấm play qua API (đáng tin cậy hơn nhiều so với chỉ dựa
              // vào tham số autoplay=1 trên URL, vốn hay bị chặn). Bật lại tiếng ngay khi
              // video thật sự chạy được (xem onStateChange bên dưới).
              playerRef.current?.mute?.();
              playerRef.current?.playVideo?.();
            }
            intervalRef.current = setInterval(() => {
              const p = playerRef.current;
              if (!p?.getDuration) return;
              const duration = p.getDuration();
              const current = p.getCurrentTime();
              if (duration > 0) onProgressRef.current?.(Math.min(100, (current / duration) * 100), current);
            }, 5000);
          },
          onStateChange: (e: any) => {
            const S = window.YT.PlayerState;
            setPaused(e.data === S.PAUSED);
            // Vừa có state đầu tiên (BUFFERING/PLAYING/PAUSED/CUED...) — trình phát YouTube
            // đã thật sự cầm lái, không còn là màn hình đen vô danh nữa (kể cả lúc nó còn
            // đang tự tải/đệm thì cũng đã có hình ảnh/vòng xoay riêng của YouTube). Tắt đồ
            // hoạ "Đang tải..." của app từ đây — khắc phục lỗi "mất ~4s đen thui
            // không biết đang tải hay đang lỗi" ở khoảng thời gian TRƯỚC lúc này.
            setLoading(false);
            // Gỡ phụ đề lần nữa ngay khi video BẮT ĐẦU CHẠY: lúc onReady, bộ phụ đề nhiều
            // khi còn chưa nạp xong nên gỡ chưa ăn — gỡ thêm lần này mới chắc.
            // (Không gỡ nếu bố mẹ vừa chủ động bật phụ đề lên.)
            if (e.data === S.PLAYING && !captionsOnRef.current) hideCaptions();
            if (!unmutedRef.current && e.data === S.PLAYING) {
              unmutedRef.current = true;
              playerRef.current?.unMute?.();
            }
            if (e.data === S.ENDED) {
              onProgressRef.current?.(100, 0);
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

  // Ghi chú: KHÔNG có nút chọn chất lượng video trong bảng điều khiển. Từ 24/10/2019
  // YouTube đã vô hiệu hoá các hàm đổi chất lượng của thư viện nhúng (setPlaybackQuality
  // trở thành hàm rỗng), nên nút đó chỉ là nút giả. YouTube tự chọn chất lượng cao nhất
  // mà đường truyền chịu được — đúng việc cần làm cho TV.

  // useMemo (deps rỗng) để giữ ĐÚNG 1 object trong suốt vòng đời component — các hàm bên
  // trong đọc playerRef.current lúc GỌI chứ không phải lúc TẠO, nên vẫn luôn điều khiển đúng
  // trình phát hiện tại dù videoId đổi (xem effect [videoId] ở trên, tự huỷ/tạo lại
  // playerRef.current). Giữ 1 object cố định là vì onAdapterReady chỉ nên bắn ra 1 lần — nơi
  // nhận (MobilePlayerHost) lưu lại đúng 1 "cầu nối" cho suốt phiên nghe/xem.
  const adapter = useMemo<MobilePlayerAdapter>(
    () => ({
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      getDuration: () => playerRef.current?.getDuration?.() ?? 0,
      seekTo: (seconds: number, final: boolean) => playerRef.current?.seekTo?.(seconds, final),
      isPaused: () => {
        const p = playerRef.current;
        const YT = window.YT;
        if (!p?.getPlayerState || !YT?.PlayerState) return false;
        return p.getPlayerState() !== YT.PlayerState.PLAYING;
      },
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      setPlaybackRate: (rate: number) => playerRef.current?.setPlaybackRate?.(rate),
    }),
    []
  );

  useEffect(() => {
    onAdapterReady?.(adapter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  const actions: PanelAction[] = [
    { key: 'prev', label: 'Video trước', icon: SkipBack, disabled: !hasPrev, onSelect: () => onPrev?.() },
    { key: 'playpause', label: paused ? 'Phát tiếp' : 'Tạm dừng', icon: paused ? Play : Pause, onSelect: togglePlay },
    { key: 'next', label: 'Video tiếp', icon: SkipForward, disabled: !hasNext, onSelect: () => onNext?.() },
    { key: 'cc', label: captionsOn ? 'Phụ đề: BẬT' : 'Phụ đề: TẮT', icon: Captions, keepOpen: true, onSelect: toggleCaptions },
  ];

  const playlist = playlistVideos ?? [];

  const { panelOpen, panelIndex, seekLabel, playlistStage, playlistIndex, centerIcon } = useTvPlayerControls({
    wrapRef,
    adapter,
    actions,
    playlistCount: playlist.length,
    onSelectPlaylistItem: (i) => {
      const v = playlist[i];
      if (v && v.videoId !== videoId) onSelectVideo?.(v);
    },
  });

  return (
    <div className="player-wrap" ref={wrapRef} data-region="player" tabIndex={0} onClick={togglePlay}>
      <div ref={containerRef} title={title} />
      {loading && (
        <div className="player-loading" aria-hidden="true">
          <div className="player-loading-spinner" />
          <div className="player-loading-text">Đang tải...</div>
        </div>
      )}
      <WatchCountdownBadge />
      {centerIcon && (
        <div className="player-center-icon" aria-hidden="true">
          {centerIcon === 'pause' ? <Pause /> : <Play />}
        </div>
      )}
      <PlayerControlBar open={panelOpen} actions={actions} activeIndex={panelIndex} seekLabel={seekLabel} />
      <PlayerPlaylistDrawer stage={playlistStage} videos={playlist} activeIndex={playlistIndex} currentVideoId={videoId} />
    </div>
  );
}
