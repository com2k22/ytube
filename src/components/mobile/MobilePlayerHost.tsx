import { useEffect, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  X,
  ChevronDown,
  Gauge,
  AlarmClock,
  MoonStar,
  Music,
  Video as VideoIcon,
  ListMusic,
  Heart,
} from 'lucide-react';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import { useProfileContext } from '@/context/ProfileContext';
import { usePlayerEngine, type PlayerEngineParams } from '@/hooks/usePlayerEngine';
import { useSleepTimer, type SleepTimerOption } from '@/hooks/useSleepTimer';
import { useFavorites } from '@/hooks/useFavorites';
import type { MobilePlayerAdapter } from '@/hooks/useTvPlayerControls';
import { SafeYouTubePlayer } from '@/components/player/SafeYouTubePlayer';
import { DirectVideoPlayer } from '@/components/player/DirectVideoPlayer';

const SPEEDS = [1, 1.25, 1.5, 2];

/** "125" giây → "2:05" — dùng để hiện thời lượng/vị trí đang nghe. */
function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/**
 * MobilePlayerHost — trình phát NỔI trên điện thoại, mount đúng 1 lần trong Layout.tsx (bên
 * ngoài `<Outlet/>`) nên KHÔNG bị gỡ bỏ khi bé chuyển trang. Tự đổi hình dạng theo URL hiện
 * tại: toàn màn hình khi đang ở `/player`, thu nhỏ thành thanh mini phía trên menu dưới đáy
 * khi ở mọi trang khác — xem UI_SPEC.md mục 7/8.
 *
 * Component này CHỈ vẽ giao diện — mọi nghiệp vụ (tiến độ xem, phiên xem, playlist, đếm tự
 * chuyển video...) đến từ usePlayerEngine, DÙNG CHUNG với PlayerPage.tsx (TV/iPad/máy tính).
 * Không tạo trình phát thứ 2: SafeYouTubePlayer/DirectVideoPlayer vẫn là nơi duy nhất thật
 * sự phát video/âm thanh, chỉ "lộ" thêm 1 cầu nối điều khiển (onAdapterReady) để thanh mini/
 * màn hình lớn ở đây điều khiển được nó.
 *
 * Tách làm 2 lớp (MobilePlayerHost/MobilePlayerHostActive) để chỉ gọi usePlayerEngine (mở
 * phiên xem, đếm giờ...) khi THẬT SỰ có video đang phát — không được gọi hook đó rồi mới
 * "ẩn đi", sẽ phạm quy tắc hook + có nguy cơ mở nhầm phiên xem rỗng.
 */
export function MobilePlayerHost() {
  const { nowPlaying } = useMobilePlayback();
  if (!nowPlaying) return null;
  return <MobilePlayerHostActive nowPlaying={nowPlaying} />;
}

function MobilePlayerHostActive({ nowPlaying }: { nowPlaying: PlayerEngineParams }) {
  const { updateNowPlaying, closePlayer } = useMobilePlayback();
  const navigate = useNavigate();
  const location = useLocation();
  const isFull = location.pathname === '/player';

  /** "Yêu thích" — bé tự bấm tim, xem useFavorites.ts + supabase/021_favorites.sql. Theo yêu
      cầu mới: CHỈ bấm thích được NGAY TRONG trình phát video/audio này (hàng tiện ích toàn
      màn hình bên dưới) — không còn nút tim trên thẻ playlist/video ở Trang chủ/Khám phá nữa
      (bỏ hẳn, xem MobileHomePage.tsx/MobileDiscoverPage.tsx). `nowPlaying.sourceId` là đúng
      dòng whitelist của nội dung ĐANG PHÁT — CÙNG giá trị `sourceId` mà usePlayerEngine dùng
      để lưu tiến độ xem (xem handleProgress trong usePlayerEngine.ts), nên khi đang phát 1
      tập nằm TRONG playlist thì tim này đánh dấu cho CẢ playlist đó (không có id riêng cho
      từng tập bên trong 1 playlist) — đúng ý "không cho bấm thích ở [từng mục của] playlist"
      khi duyệt danh sách, còn ở đây là bấm thích cho đúng NỘI DUNG đang mở ra nghe/xem. */
  const { activeProfile } = useProfileContext();
  const { isFavorite, toggle: toggleFavorite } = useFavorites(activeProfile?.id ?? null);
  const favSourceId = nowPlaying.sourceId;
  const isCurrentFavorite = favSourceId ? isFavorite(favSourceId) : false;

  /** 'off' → 'all' (lặp lại cả danh sách, hết bài cuối quay lại bài đầu) → 'one' (lặp lại
      ĐÚNG 1 bài đang phát, không tự chuyển bài) → về lại 'off', bấm nút Lặp lại (icon
      Repeat/Repeat1) sẽ xoay vòng qua 3 trạng thái này (xem cycleRepeat bên dưới). Khai báo
      ở ĐÂY (trước usePlayerEngine) vì 'all' cần truyền thẳng vào hook để tính lại
      nextVideo/prevVideo có vòng lặp hay không — xem repeatMode trong usePlayerEngine.ts. */
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  /** Trộn bài — "video/track tiếp theo" chọn ngẫu nhiên thay vì đúng thứ tự (xem shuffle
      trong usePlayerEngine.ts). */
  const [shuffleOn, setShuffleOn] = useState(false);

  const engine = usePlayerEngine({
    params: nowPlaying,
    onNavigateToVideo: updateNowPlaying,
    onExit: () => {
      closePlayer();
      navigate('/');
    },
    repeatMode: repeatMode === 'all' ? 'playlist' : 'off',
    shuffle: shuffleOn,
  });
  const {
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
    drawerVideos,
    autoNextIn,
    setAutoNextIn,
  } = engine;

  const [adapter, setAdapter] = useState<MobilePlayerAdapter | null>(null);
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  /** true = ẩn hình, chỉ hiện ảnh đại diện (trải nghiệm "nghe truyện") — video/âm thanh vẫn
      phát y hệt, KHÔNG tách luồng riêng (xem UI_SPEC.md mục 6-7). Mặc định BẬT — trải nghiệm
      chính của khu Truyện trên điện thoại là NGHE, không phải xem màn hình. */
  const [audioMode, setAudioMode] = useState(true);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  /** Bảng chọn hẹn giờ ngủ (.mobile-player-sleep-menu) — LỖI đã báo: mở lên mà CHƯA chọn giờ
      nào, bấm ra vùng khác trên màn hình thì bảng không tự đóng (trước đây chỉ đóng được bằng
      1 trong 2 cách: chọn 1 mục trong bảng, hoặc bấm lại đúng nút hẹn giờ — chưa hề có xử lý
      "bấm ra ngoài" nào cả). Gắn ref vào khối bọc ngoài (.mobile-player-sleep-wrap, chứa cả
      nút hẹn giờ LẪN bảng chọn) rồi lắng nghe "pointerdown" trên TOÀN TRANG khi bảng đang mở —
      bấm trúng bên trong khối này (nút hẹn giờ, hoặc 1 mục trong bảng) thì bỏ qua (đã có
      onClick riêng xử lý), bấm ra NGOÀI khối này thì tự đóng bảng lại. */
  const sleepWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sleepMenuOpen) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (sleepWrapRef.current && !sleepWrapRef.current.contains(e.target as Node)) {
        setSleepMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [sleepMenuOpen]);
  const cycleRepeat = () => setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  /** true = bài đang phát THẬT SỰ có hình để xem — dùng để disable nút "Video" khi nội dung
      chỉ có tiếng (audio thuần, vd 1 file mp3/Drive không có khung hình), tránh bé bấm vào
      rồi thấy màn hình đen thui không hiểu vì sao. Mặc định true (lạc quan): video YouTube
      LUÔN có hình nên không cần báo gì; với nội dung 'direct' (link trực tiếp), giá trị THẬT
      do DirectVideoPlayer tự báo lại qua onHasVideoChange ngay sau khi tải xong metadata (xem
      prop đó) — trước lúc đó cứ tạm coi là true, không disable nhầm. */
  const [hasVideo, setHasVideo] = useState(true);
  /** Danh sách bài trong playlist hiện tại (bấm biểu tượng dưới trình phát để mở) — xem khối
      .mobile-player-queue-sheet phía dưới. */
  const [queueOpen, setQueueOpen] = useState(false);

  /**
   * Nút Đóng/Thu nhỏ ở toàn màn hình CHỈ hiện khi bé vừa bấm vào vùng video/ảnh — ẩn lại sau
   * vài giây không đụng tới, giống ứng dụng YouTube/YouTube Music (yêu cầu: "Các biểu tượng
   * đóng và thu nhỏ chỉ hiện lên khi bấm chọn vào vùng video"). Không đụng gì đến việc
   * play/pause khi bấm vào vùng video — SafeYouTubePlayer/DirectVideoPlayer đã tự xử lý việc
   * đó ở đúng khung `<video>`/YouTube của chúng (sự kiện click vẫn nổi bọt lên tới đây bình
   * thường, nên 1 lần bấm vừa play/pause vừa hiện/ẩn 2 nút này — đúng như nhiều app vẫn làm).
   */
  const [mediaControlsVisible, setMediaControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const scheduleHideMediaControls = () => {
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => setMediaControlsVisible(false), 3000);
  };
  useEffect(() => {
    if (!isFull) return;
    setMediaControlsVisible(true);
    scheduleHideMediaControls();
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFull]);
  const onMediaTap = () => {
    if (!isFull) return;
    setMediaControlsVisible((visible) => {
      const next = !visible;
      if (next) scheduleHideMediaControls();
      else if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      return next;
    });
  };

  /**
   * "Chế độ ban đêm" — CHỈ áp dụng ở toàn màn hình (xem cách gắn class ở div ngoài cùng bên
   * dưới): ẩn hẳn ảnh bìa, nền đổi hẳn sang đen tuyệt đối (#000, khác với màu nền tối
   * "#0e0f13" bình thường của app) + toàn bộ chữ/nút chuyển sang viền mảnh/màu mờ. Mục đích
   * là tiết kiệm pin trên các máy màn OLED (điểm ảnh đen gần như không tốn điện) khi bé nghe
   * truyện vào buổi tối — không có tác dụng tiết kiệm đáng kể trên máy màn LCD cũ vì đèn nền
   * LCD sáng đều bất kể màu gì, nhưng bật lên cũng không có gì hại nên cứ để tuỳ ý bật/tắt.
   *
   * Bật/tắt bằng tay qua 1 nút trong hàng tiện ích (không tự động theo giờ) và NHỚ lựa chọn
   * theo từng thiết bị (localStorage) — đây là sở thích hiển thị cá nhân, không phải quy tắc
   * kiểm soát nội dung của bố mẹ nên không cần đồng bộ lên Supabase.
   */
  const [nightMode, setNightMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ytube_mobile_night_mode') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('ytube_mobile_night_mode', nightMode ? '1' : '0');
    } catch {
      // Trình duyệt chặn localStorage (vd chế độ ẩn danh) — chỉ mất khả năng nhớ lựa chọn
      // cho lần mở app sau, không ảnh hưởng gì tới việc bật/tắt trong phiên hiện tại.
    }
  }, [nightMode]);

  const { option: sleepOption, expiresAt: sleepExpiresAt, setSleepOption } = useSleepTimer({
    onExpire: () => adapter?.pause(),
  });

  // Đang có trình phát nổi → nội dung trang phải chừa thêm chỗ phía dưới, không thì thanh
  // mini che mất phần cuối trang (xem `.main` + class này trong theme.css). Gắn vào <body>
  // thay vì 1 phần tử trong cây component vì thanh mini/toàn màn hình được vẽ TRONG chính
  // component này (sibling của <Outlet/>, không phải cha của nó) nên không "with" được các
  // trang khác bằng CSS lồng nhau thông thường.
  useEffect(() => {
    document.body.classList.add('has-mobile-mini-player');
    return () => document.body.classList.remove('has-mobile-mini-player');
  }, []);

  // Đổi sang video khác → chưa biết trạng thái play/pause/tốc độ của video mới, đặt lại cho
  // chắc (video mới luôn tự phát, xem autoFullscreen truyền cho player bên dưới). Đặt lại cả
  // hasVideo về true (lạc quan) — chờ DirectVideoPlayer báo lại giá trị THẬT của bài MỚI, chứ
  // không giữ kết quả của bài TRƯỚC (nếu không, có 1 khoảnh khắc disable nhầm nút Video của
  // bài mới bằng kết quả bài cũ trước khi metadata bài mới tải xong).
  useEffect(() => {
    setPaused(false);
    setCurrent(0);
    setDuration(0);
    setSpeedIndex(0);
    setHasVideo(true);
  }, [ytVideoId, directUrl]);

  // Bài hiện tại hoá ra không có hình (hasVideo tự chuyển false) mà đang ở chế độ "Video" →
  // tự chuyển về "Âm thanh" cho khỏi đứng nhìn màn hình đen — không chờ bé tự bấm lại.
  useEffect(() => {
    if (!hasVideo && !audioMode) setAudioMode(true);
  }, [hasVideo, audioMode]);

  // Thăm dò định kỳ vị trí/thời lượng/trạng thái tạm dừng — cả 2 trình phát chỉ lộ ra được
  // qua các hàm "hỏi trực tiếp" (getCurrentTime/getDuration/isPaused), không có sự kiện
  // riêng bắn ra mỗi khi đổi — nên phải tự hỏi định kỳ để vẽ lại thanh tiến độ/nút play-pause.
  useEffect(() => {
    if (!adapter) return;
    const id = setInterval(() => {
      setCurrent(adapter.getCurrentTime());
      setDuration(adapter.getDuration());
      setPaused(adapter.isPaused());
    }, 500);
    return () => clearInterval(id);
  }, [adapter]);

  const togglePlayPause = () => {
    if (!adapter) return;
    if (adapter.isPaused()) adapter.play();
    else adapter.pause();
  };
  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    adapter?.setPlaybackRate(SPEEDS[next]);
  };

  const openFull = () => navigate('/player');
  const minimize = () => navigate(-1);
  const handleClose = () => {
    closePlayer();
    if (isFull) navigate('/');
  };

  /**
   * Vuốt PHẢI SANG TRÁI trong khối THU NHỎ để tắt hẳn trình phát — cử chỉ quen thuộc của
   * các app nghe nhạc (Spotify/Apple Music...). CHỈ áp dụng ở chế độ thu nhỏ (`isFull` false
   * thì bỏ qua toàn bộ) — toàn màn hình đã có sẵn nút Đóng riêng, thêm cử chỉ ở đó dễ vuốt
   * nhầm lúc đang tua/thao tác khác.
   *
   * Ngưỡng `SWIPE_CLOSE_PX` mới coi là "đủ ý định tắt" — vuốt nhẹ/lỡ tay chạm thì tự bật lại
   * đúng vị trí cũ (snap back), không tắt nhầm khi bé chỉ định bấm mở toàn màn hình hoặc lỡ
   * tay quệt qua. `miniSwiping` chỉ bật SAU KHI xác định rõ đây là 1 cú vuốt NGANG thật sự
   * (di chuyển đủ xa VÀ ngang nhiều hơn dọc) — nhờ vậy ngón tay chạm vào khối này lúc đang
   * cuộn trang DỌC không bị hiểu nhầm thành vuốt ngang.
   */
  const SWIPE_CLOSE_PX = 90;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [miniSwipeX, setMiniSwipeX] = useState(0);
  const [miniSwiping, setMiniSwiping] = useState(false);

  const onMiniTouchStart = (e: ReactTouchEvent) => {
    if (isFull) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onMiniTouchMove = (e: ReactTouchEvent) => {
    if (isFull || !touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (!miniSwiping) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return;
      setMiniSwiping(true);
    }
    // Chỉ cho trôi sang TRÁI (dx âm) — vuốt phải thì đứng yên, không có ý nghĩa gì ở đây.
    if (dx < 0) setMiniSwipeX(dx);
  };
  const onMiniTouchEnd = () => {
    touchStartRef.current = null;
    if (isFull) return;
    if (miniSwiping && miniSwipeX < -SWIPE_CLOSE_PX) {
      // Đủ xa rồi → cho trôi nốt hẳn ra khỏi màn hình rồi mới thật sự đóng, đỡ giật (thấy nó
      // bay đi trước khi biến mất, không phải đột ngột "mất tăm" giữa chừng cú vuốt).
      setMiniSwiping(false);
      setMiniSwipeX(-480);
      setTimeout(handleClose, 180);
    } else {
      setMiniSwiping(false);
      setMiniSwipeX(0);
    }
  };

  /**
   * Vuốt TỪ TRÊN XUỐNG DƯỚI ngay trong vùng video/ảnh (chỉ khi đang TOÀN MÀN HÌNH) để THU
   * NHỎ trình phát — cùng cách phân biệt "vuốt thật sự" như cử chỉ đóng ở thanh mini phía
   * trên (di chuyển đủ xa VÀ dọc nhiều hơn ngang mới tính), nhưng đây là vuốt DỌC và chỉ THU
   * NHỎ chứ không tắt hẳn. Không kéo ảnh theo ngón tay khi đang vuốt (khác thanh mini) — khu
   * vực này là khung phát video thật, đổi transform liên tục trong lúc kéo dễ giật hình hơn
   * là chỉ đơn giản "chạm đủ ngưỡng thì thu nhỏ" ngay khi nhấc tay.
   *
   * LƯU Ý kỹ thuật: khi đang phát video YouTube ở chế độ "Video" (audioMode tắt, xem hình
   * thật thay vì ảnh đại diện), video nằm trong 1 khung <iframe> của YouTube — trình duyệt
   * KHÔNG cho trang cha nhận sự kiện chạm xảy ra bên trong iframe khác nguồn, nên vuốt sẽ
   * không có tác dụng trong đúng trường hợp đó (giới hạn của trình duyệt, không sửa được).
   * Ở chế độ "Âm thanh" (mặc định) và với video tải trực tiếp, phần phủ trên cùng luôn là 1
   * ảnh/thẻ <video> bình thường của chính trang nên cử chỉ vẫn hoạt động đầy đủ.
   */
  const FULL_SWIPE_MINIMIZE_PX = 70;
  const fullTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [fullSwiping, setFullSwiping] = useState(false);

  const onFullMediaTouchStart = (e: ReactTouchEvent) => {
    if (!isFull) return;
    const t = e.touches[0];
    fullTouchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onFullMediaTouchMove = (e: ReactTouchEvent) => {
    if (!isFull || !fullTouchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - fullTouchStartRef.current.x;
    const dy = t.clientY - fullTouchStartRef.current.y;
    if (!fullSwiping) {
      if (dy < 14 || Math.abs(dy) < Math.abs(dx)) return;
      setFullSwiping(true);
    }
  };
  const onFullMediaTouchEnd = (e: ReactTouchEvent) => {
    if (!isFull || !fullTouchStartRef.current) return;
    const t = e.changedTouches[0];
    const dy = t.clientY - fullTouchStartRef.current.y;
    fullTouchStartRef.current = null;
    const wasSwiping = fullSwiping;
    setFullSwiping(false);
    if (wasSwiping && dy > FULL_SWIPE_MINIMIZE_PX) minimize();
  };
  const onFullMediaTouchCancel = () => {
    fullTouchStartRef.current = null;
    setFullSwiping(false);
  };

  const sleepLabel: Record<SleepTimerOption, string> = {
    off: 'Hẹn giờ ngủ',
    15: '15 phút',
    30: '30 phút',
    45: '45 phút',
    60: '60 phút',
    end_of_video: 'Hết video',
  };

  // "Hết video" chỉ có ý nghĩa ở đây: KHÔNG tự phát video kế tiếp khi video hiện tại kết
  // thúc, dù còn video sau trong playlist (nghịch với hành vi mặc định của usePlayerEngine).
  //
  // "Lặp lại 1 bài" (repeatMode === 'one') cũng chặn ở ĐÂY, chứ không đưa vào usePlayerEngine
  // như 'all' — vì đây không phải "chuyển sang video khác" (nextVideo/goToVideo) mà là PHÁT
  // LẠI ĐÚNG bài đang mở từ đầu, việc chỉ cần tua adapter về 0 rồi play() lại, không đụng gì
  // tới playlist/điều hướng — làm ngay trong app là đủ, không cần sửa hook dùng chung với TV.
  const handleEndedWithSleep = () => {
    if (sleepOption === 'end_of_video') {
      setSleepOption('off');
      return;
    }
    if (repeatMode === 'one') {
      adapter?.seekTo(0, true);
      adapter?.play();
      return;
    }
    handleEnded();
  };

  const artUrl = nowPlaying.thumbnail || undefined;

  return (
    <div
      className={`mobile-player-host ${isFull ? 'mobile-player-host--full' : 'mobile-player-host--mini'} ${
        isFull && nightMode ? 'mobile-player-host--night' : ''
      }`}
      // Cử chỉ vuốt-để-tắt CHỈ có ý nghĩa ở chế độ thu nhỏ, nhưng vẫn gắn handler ở đây bất
      // kể (mỗi hàm tự kiểm tra `isFull` bên trong) — đơn giản hơn là tạo hẳn 1 wrapper
      // riêng chỉ cho mini, mà không tốn gì thêm vì toàn màn hình luôn thoát sớm ngay dòng
      // đầu của mỗi hàm.
      onTouchStart={onMiniTouchStart}
      onTouchMove={onMiniTouchMove}
      onTouchEnd={onMiniTouchEnd}
      onTouchCancel={onMiniTouchEnd}
      style={
        !isFull
          ? {
              transform: `translateX(${miniSwipeX}px)`,
              opacity: 1 - Math.min(0.7, Math.abs(miniSwipeX) / 220),
              // "transition" khai TRỰC TIẾP ở style (inline) này sẽ ĐÈ MẤT HẲN transition khai
              // trong theme.css cho ".mobile-player-host" (inline luôn thắng cả thuộc tính,
              // không cộng dồn) — nên phải LIỆT KÊ ĐỦ CẢ 2 NHÓM ngay tại đây: nhóm
              // transform/opacity (phục vụ cử chỉ vuốt-để-tắt, xử lý riêng ở đây vì cần đọc
              // miniSwipeX) VÀ nhóm top/height/left/right/border-radius/background-color
              // (phục vụ hiệu ứng phóng to/thu nhỏ, xem chú thích đầy đủ tại rule
              // ".mobile-player-host" trong theme.css) — thiếu nhóm sau thì lúc thu nhỏ lại
              // (full → mini) sẽ mất mượt, chỉ còn lúc phóng to (mini → full, không dùng style
              // inline nên vẫn ăn transition của theme.css bình thường) là mượt thôi.
              transition: miniSwiping
                ? 'none'
                : 'transform 0.2s ease, opacity 0.2s ease, top 0.32s cubic-bezier(0.4,0,0.2,1), height 0.32s cubic-bezier(0.4,0,0.2,1), left 0.32s cubic-bezier(0.4,0,0.2,1), right 0.32s cubic-bezier(0.4,0,0.2,1), border-radius 0.32s cubic-bezier(0.4,0,0.2,1), background-color 0.32s ease',
            }
          : undefined
      }
    >
      {/* Khung chứa trình phát thật — LUÔN gắn trong DOM (không unmount khi thu nhỏ), chỉ
          đổi kích thước bằng CSS, để video/âm thanh không bị ngắt khi bé chuyển trang. Ở chế
          độ "Âm thanh", ảnh đại diện phủ lên trên che khung hình, KHÔNG che tiếng. Cụm nút
          Thu nhỏ/Đóng (chỉ hiện khi toàn màn hình) và cử chỉ vuốt-xuống-để-thu-nhỏ đều gắn
          NGAY TRONG khối này thay vì ở .mobile-player-full bên dưới — theo đúng yêu cầu đưa
          2 nút này nổi ngay trên vùng video/ảnh, chừa hẳn phần dưới media cho tên bài. */}
      <div
        className="mobile-player-media"
        onClick={onMediaTap}
        onTouchStart={onFullMediaTouchStart}
        onTouchMove={onFullMediaTouchMove}
        onTouchEnd={onFullMediaTouchEnd}
        onTouchCancel={onFullMediaTouchCancel}
      >
        {isFull && (
          <div
            className={`mobile-player-media-header ${
              mediaControlsVisible ? '' : 'mobile-player-media-header--hidden'
            }`}
          >
            <button
              className="mobile-player-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                minimize();
              }}
              aria-label="Thu nhỏ"
            >
              <ChevronDown size={22} />
            </button>
            <button
              className="mobile-player-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              aria-label="Đóng"
            >
              <X size={22} />
            </button>
          </div>
        )}
        {kind === 'youtube' && ytVideoId && (
          <SafeYouTubePlayer
            videoId={ytVideoId}
            title={title}
            onProgress={handleProgress}
            onEnded={handleEndedWithSleep}
            autoFullscreen={false}
            autoplay
            onPrev={() => prevVideo && goToVideo(prevVideo)}
            onNext={() => nextVideo && goToVideo(nextVideo)}
            hasPrev={!!prevVideo}
            hasNext={!!nextVideo}
            onAdapterReady={setAdapter}
          />
        )}
        {kind === 'direct' && directUrl && (
          <DirectVideoPlayer
            url={directUrl}
            title={title}
            onProgress={handleProgress}
            onEnded={handleEndedWithSleep}
            autoFullscreen={false}
            autoplay
            onPrev={() => prevVideo && goToVideo(prevVideo)}
            onNext={() => nextVideo && goToVideo(nextVideo)}
            hasPrev={!!prevVideo}
            hasNext={!!nextVideo}
            onAdapterReady={setAdapter}
            artworkUrl={artUrl}
            onHasVideoChange={setHasVideo}
          />
        )}
        {audioMode && (
          <div
            className="mobile-player-artwork"
            style={artUrl ? { backgroundImage: `url(${artUrl})` } : undefined}
            aria-hidden="true"
          />
        )}
      </div>

      {!isFull && (
        // --- THANH MINI kiểu YouTube Music: 1 HÀNG DUY NHẤT (flex, xem .mobile-player-host--
        // mini trong theme.css) — ảnh nhỏ bên trái (chính .mobile-player-media ở trên, đứng
        // ĐẦU TIÊN trong DOM nên tự nhiên rơi vào vị trí đầu hàng flex, không cần đổi gì ở
        // JSX), tên bài + tên playlist/trạng thái xếp 2 dòng ở giữa (co giãn lấp đầy khoảng
        // trống), rồi nút Phát/Tạm dừng + Bài tiếp bên phải — đúng bố cục quen thuộc của app
        // nghe nhạc. Thêm 1 vạch tiến độ MẢNH ngay mép trên cùng của cả thanh — chi tiết đặc
        // trưng của thanh mini YouTube Music. BỎ nút Đóng riêng — đã có cử chỉ vuốt trái-để-
        // tắt (xem onMiniTouchStart/Move/End phía trên), thêm nút Đóng nữa là thừa. ---
        <>
          <div className="mobile-player-mini-progress" aria-hidden="true">
            <div
              className="mobile-player-mini-progress-fill"
              style={{ width: duration > 0 ? `${Math.min(100, (current / duration) * 100)}%` : '0%' }}
            />
          </div>
          <div
            className="mobile-player-mini-titlebar"
            role="button"
            tabIndex={0}
            onClick={openFull}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFull();
              }
            }}
            aria-label={`Mở trình phát: ${title}`}
          >
            <span className="mobile-player-mini-name">{title}</span>
            <span className="mobile-player-mini-sub">{listTitle || (paused ? 'Đã tạm dừng' : 'Đang phát')}</span>
          </div>
          <div className="mobile-player-mini-controls">
            <span
              className="mobile-player-mini-btn mobile-player-mini-btn--play"
              role="button"
              aria-label={paused ? 'Phát tiếp' : 'Tạm dừng'}
              onClick={togglePlayPause}
            >
              {paused ? <Play size={22} /> : <Pause size={22} />}
            </span>
            {nextVideo && (
              <span
                className="mobile-player-mini-btn"
                role="button"
                aria-label="Bài tiếp"
                onClick={(e) => {
                  e.stopPropagation();
                  goToVideo(nextVideo);
                }}
              >
                <SkipForward size={20} />
              </span>
            )}
          </div>
        </>
      )}

      {isFull && (
        // --- TOÀN MÀN HÌNH: giống ứng dụng nghe nhạc — ảnh lớn (2 nút Thu nhỏ/Đóng nổi ngay
        // trên ảnh đó, xem khối .mobile-player-media phía trên), rồi tới tên truyện (KHÔNG in
        // đậm nữa, chỉ cỡ chữ vừa — tránh "nổi bật" quá mức theo yêu cầu), 2 nút chuyển Âm
        // thanh/Video (LUÔN hiện cả 2, nút đang KHÔNG dùng bị làm mờ đi thay vì ẩn hẳn), thanh
        // tiến độ mảnh, rồi các nút điều khiển và hàng tiện ích (tốc độ/hẹn giờ ngủ). ---
        <div className="mobile-player-full">
          <div className="mobile-player-full-title">
            <div className="mobile-player-full-title-name">{title}</div>
            <div className="mobile-player-full-title-sub">{listTitle || (paused ? 'Đã tạm dừng' : 'Đang phát')}</div>
          </div>

          <div className="mobile-player-mode-toggle">
            <button
              className={`mobile-player-mode-btn ${audioMode ? 'mobile-player-mode-btn--active' : ''}`}
              onClick={() => setAudioMode(true)}
              aria-pressed={audioMode}
            >
              <Music size={16} /> Âm thanh
            </button>
            <button
              className={`mobile-player-mode-btn ${!audioMode ? 'mobile-player-mode-btn--active' : ''}`}
              onClick={() => setAudioMode(false)}
              aria-pressed={!audioMode}
              disabled={!hasVideo}
              aria-label={hasVideo ? undefined : 'Nội dung này chỉ có âm thanh, không có hình'}
            >
              <VideoIcon size={16} /> Video
            </button>
          </div>

          <div className="mobile-player-progress">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={Math.min(current, duration || 0)}
              onChange={(e) => adapter?.seekTo(Number(e.target.value), true)}
              aria-label="Vị trí đang nghe"
            />
            <div className="mobile-player-progress-labels">
              <span>{formatClock(current)}</span>
              <span>{formatClock(duration)}</span>
            </div>
          </div>

          <div className="mobile-player-transport">
            {/* Bỏ 2 nút tua nhanh/tua chậm 15 giây — thay bằng Lặp lại/Trộn bài (đúng bộ nút
                quen thuộc của app nghe nhạc). Bài trước/Bài tiếp dời vào sát 2 bên nút Phát/
                Tạm dừng; Lặp lại/Trộn bài ra 2 đầu ngoài cùng. */}
            <button
              className={`mobile-player-icon-btn ${repeatMode !== 'off' ? 'mobile-player-icon-btn--active' : ''}`}
              onClick={cycleRepeat}
              aria-label={
                repeatMode === 'off'
                  ? 'Bật lặp lại danh sách'
                  : repeatMode === 'all'
                    ? 'Đang lặp lại danh sách — bấm để chỉ lặp 1 bài'
                    : 'Đang lặp lại 1 bài — bấm để tắt lặp lại'
              }
            >
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
            <button className="mobile-player-icon-btn" onClick={() => prevVideo && goToVideo(prevVideo)} disabled={!prevVideo} aria-label="Bài trước">
              <SkipBack size={22} />
            </button>
            <button className="mobile-player-play-btn" onClick={togglePlayPause} aria-label={paused ? 'Phát' : 'Tạm dừng'}>
              {paused ? <Play size={28} /> : <Pause size={28} />}
            </button>
            <button className="mobile-player-icon-btn" onClick={() => nextVideo && goToVideo(nextVideo)} disabled={!nextVideo} aria-label="Bài tiếp">
              <SkipForward size={22} />
            </button>
            <button
              className={`mobile-player-icon-btn ${shuffleOn ? 'mobile-player-icon-btn--active' : ''}`}
              onClick={() => setShuffleOn((s) => !s)}
              aria-pressed={shuffleOn}
              aria-label={shuffleOn ? 'Tắt trộn bài' : 'Bật trộn bài'}
            >
              <Shuffle size={20} />
            </button>
          </div>

          <div className="mobile-player-utility-row">
            {/* Nút "Yêu thích" — đặt ĐẦU TIÊN trong hàng (góc ngoài cùng bên trái), cùng hàng
                với nút hẹn giờ ngủ, dùng chung style icon-tròn với các nút còn lại trong hàng
                này (mobile-player-utility-btn/--active) cho đồng bộ, không cần thêm CSS riêng.
                Chỉ ẩn đi khi vì lý do nào đó chưa có sourceId (vd mở thẳng 1 link không qua
                whitelist) — bình thường luôn có, không hiện thiếu tim. */}
            {favSourceId && (
              <button
                className={`mobile-player-utility-btn ${isCurrentFavorite ? 'mobile-player-utility-btn--active' : ''}`}
                onClick={() => toggleFavorite(favSourceId)}
                aria-pressed={isCurrentFavorite}
                aria-label={isCurrentFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
              >
                <Heart size={18} fill={isCurrentFavorite ? 'currentColor' : 'none'} />
              </button>
            )}
            <button className="mobile-player-utility-btn" onClick={cycleSpeed} aria-label="Tốc độ phát">
              <Gauge size={16} /> {SPEEDS[speedIndex]}x
            </button>
            <div className="mobile-player-sleep-wrap" ref={sleepWrapRef}>
              {/* Chỉ giữ icon — bỏ chữ "Hẹn giờ ngủ" theo yêu cầu. Đổi từ icon Moon (dễ lẫn
                  với icon MoonStar của nút Chế độ tối ngay bên cạnh) sang AlarmClock cho rõ
                  đây là hẹn giờ, không phải ban đêm. Khi đang đặt hẹn giờ (khác "off"), viền
                  nút sáng lên (class --active) để vẫn biết đang bật mà không cần chữ. */}
              <button
                className={`mobile-player-utility-btn ${
                  sleepOption !== 'off' ? 'mobile-player-utility-btn--active' : ''
                }`}
                onClick={() => setSleepMenuOpen((o) => !o)}
                aria-label={`Hẹn giờ ngủ: ${sleepLabel[sleepOption]}`}
              >
                <AlarmClock size={18} />
              </button>
              {sleepMenuOpen && (
                <div className="mobile-player-sleep-menu">
                  {(['off', 15, 30, 45, 60, 'end_of_video'] as SleepTimerOption[]).map((opt) => (
                    <button
                      key={String(opt)}
                      className={`mobile-player-sleep-item ${sleepOption === opt ? 'active' : ''}`}
                      onClick={() => {
                        setSleepOption(opt);
                        setSleepMenuOpen(false);
                      }}
                    >
                      {sleepLabel[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`mobile-player-utility-btn ${nightMode ? 'mobile-player-utility-btn--active' : ''}`}
              onClick={() => setNightMode((n) => !n)}
              aria-pressed={nightMode}
              aria-label={nightMode ? 'Tắt chế độ tối' : 'Bật chế độ tối'}
            >
              <MoonStar size={18} />
            </button>
            {drawerVideos.length > 0 && (
              <button
                className={`mobile-player-utility-btn ${queueOpen ? 'mobile-player-utility-btn--active' : ''}`}
                onClick={() => setQueueOpen((o) => !o)}
                aria-label="Danh sách phát"
              >
                <ListMusic size={18} />
              </button>
            )}
          </div>

          {sleepExpiresAt && sleepOption !== 'off' && sleepOption !== 'end_of_video' && (
            <div className="mobile-player-sleep-note">Sẽ tạm dừng sau {sleepLabel[sleepOption]}</div>
          )}

          {autoNextIn !== null && nextVideo && (
            <div className="mobile-player-autonext">
              Tự phát bài tiếp theo sau {autoNextIn}s — {nextVideo.title}
              <button onClick={() => setAutoNextIn(null)}>Dừng lại</button>
            </div>
          )}
        </div>
      )}

      {/* Danh sách bài trong playlist hiện tại — mở bằng biểu tượng ListMusic ở hàng tiện
          ích phía trên. Chạm ra ngoài (lớp nền mờ) để đóng lại, giống bottom sheet thường
          thấy ở các app nghe nhạc. `currentKey` so khớp đúng bài đang phát để tô sáng — với
          video YouTube là videoId, với link trực tiếp thì ResolvedVideo.videoId CHÍNH LÀ url
          (xem chú thích trong usePlayerEngine.ts/types/index.ts). */}
      {isFull && queueOpen && (
        <div className="mobile-player-queue-backdrop" onClick={() => setQueueOpen(false)}>
          <div className="mobile-player-queue-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-player-queue-header">
              <span>{listTitle || 'Danh sách phát'}</span>
              <button className="mobile-player-icon-btn" onClick={() => setQueueOpen(false)} aria-label="Đóng danh sách">
                <X size={20} />
              </button>
            </div>
            <div className="mobile-player-queue-list">
              {drawerVideos.map((v) => {
                const currentKey = kind === 'direct' ? directUrl : ytVideoId;
                const isCurrent = v.videoId === currentKey;
                return (
                  <button
                    key={v.videoId}
                    className={`mobile-player-queue-item ${isCurrent ? 'mobile-player-queue-item--active' : ''}`}
                    onClick={() => {
                      if (!isCurrent) goToVideo(v);
                      setQueueOpen(false);
                    }}
                  >
                    {v.thumbnail ? (
                      <img className="mobile-player-queue-thumb" src={v.thumbnail} alt="" aria-hidden="true" />
                    ) : (
                      <div className="mobile-player-queue-thumb mobile-player-queue-thumb--empty" aria-hidden="true" />
                    )}
                    <span className="mobile-player-queue-item-title">{v.title}</span>
                    {isCurrent && (paused ? <Pause size={16} /> : <Play size={16} />)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
