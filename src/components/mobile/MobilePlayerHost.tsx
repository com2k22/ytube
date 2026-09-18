import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  X,
  ChevronDown,
  Gauge,
  Moon,
  Music,
  Video as VideoIcon,
} from 'lucide-react';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import { usePlayerEngine, type PlayerEngineParams } from '@/hooks/usePlayerEngine';
import { useSleepTimer, type SleepTimerOption } from '@/hooks/useSleepTimer';
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

  const engine = usePlayerEngine({
    params: nowPlaying,
    onNavigateToVideo: updateNowPlaying,
    onExit: () => {
      closePlayer();
      navigate('/');
    },
  });
  const { kind, ytVideoId, directUrl, title, handleProgress, handleEnded, goToVideo, prevVideo, nextVideo, autoNextIn, setAutoNextIn } = engine;

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
  // chắc (video mới luôn tự phát, xem autoFullscreen truyền cho player bên dưới).
  useEffect(() => {
    setPaused(false);
    setCurrent(0);
    setDuration(0);
    setSpeedIndex(0);
  }, [ytVideoId, directUrl]);

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
  const seekBy = (deltaSeconds: number) => {
    if (!adapter) return;
    const target = Math.max(0, Math.min(duration || Infinity, adapter.getCurrentTime() + deltaSeconds));
    adapter.seekTo(target, true);
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
  const handleEndedWithSleep = () => {
    if (sleepOption === 'end_of_video') {
      setSleepOption('off');
      return;
    }
    handleEnded();
  };

  const artUrl = nowPlaying.thumbnail || undefined;

  return (
    <div className={`mobile-player-host ${isFull ? 'mobile-player-host--full' : 'mobile-player-host--mini'}`}>
      {/* Khung chứa trình phát thật — LUÔN gắn trong DOM (không unmount khi thu nhỏ), chỉ
          đổi kích thước bằng CSS, để video/âm thanh không bị ngắt khi bé chuyển trang. Ở chế
          độ "Âm thanh", ảnh đại diện phủ lên trên che khung hình, KHÔNG che tiếng. */}
      <div className="mobile-player-media">
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
        // --- THANH MINI: chạm để mở toàn màn hình, có sẵn play/pause + đóng ---
        <button className="mobile-player-mini-tap" onClick={openFull} aria-label={`Mở trình phát: ${title}`}>
          <div className="mobile-player-mini-title">
            <div className="mobile-player-mini-name">{title}</div>
            <div className="mobile-player-mini-sub">{paused ? 'Đã tạm dừng' : 'Đang phát'}</div>
          </div>
          <span
            className="mobile-player-mini-btn"
            role="button"
            aria-label={paused ? 'Phát tiếp' : 'Tạm dừng'}
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </span>
          <span
            className="mobile-player-mini-btn"
            role="button"
            aria-label="Đóng"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
          >
            <X size={18} />
          </span>
        </button>
      )}

      {isFull && (
        // --- TOÀN MÀN HÌNH: giống ứng dụng nghe nhạc — ảnh lớn, tên truyện, thanh tiến độ,
        // các nút điều khiển, và hàng tiện ích (tốc độ/hẹn giờ ngủ/chuyển Âm thanh-Video). ---
        <div className="mobile-player-full">
          <div className="mobile-player-full-header">
            <button className="mobile-player-icon-btn" onClick={minimize} aria-label="Thu nhỏ">
              <ChevronDown size={22} />
            </button>
            <div className="mobile-player-full-header-title">Đang phát</div>
            <button className="mobile-player-icon-btn" onClick={handleClose} aria-label="Đóng">
              <X size={22} />
            </button>
          </div>

          <div className="mobile-player-full-title">{title}</div>

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
            <button className="mobile-player-icon-btn" onClick={() => prevVideo && goToVideo(prevVideo)} disabled={!prevVideo} aria-label="Bài trước">
              <SkipBack size={22} />
            </button>
            <button className="mobile-player-icon-btn" onClick={() => seekBy(-15)} aria-label="Lùi 15 giây">
              <RotateCcw size={20} />
            </button>
            <button className="mobile-player-play-btn" onClick={togglePlayPause} aria-label={paused ? 'Phát' : 'Tạm dừng'}>
              {paused ? <Play size={28} /> : <Pause size={28} />}
            </button>
            <button className="mobile-player-icon-btn" onClick={() => seekBy(15)} aria-label="Tới 15 giây">
              <RotateCw size={20} />
            </button>
            <button className="mobile-player-icon-btn" onClick={() => nextVideo && goToVideo(nextVideo)} disabled={!nextVideo} aria-label="Bài tiếp">
              <SkipForward size={22} />
            </button>
          </div>

          <div className="mobile-player-utility-row">
            <button className="mobile-player-utility-btn" onClick={cycleSpeed}>
              <Gauge size={16} /> {SPEEDS[speedIndex]}x
            </button>
            <div className="mobile-player-sleep-wrap">
              <button className="mobile-player-utility-btn" onClick={() => setSleepMenuOpen((o) => !o)}>
                <Moon size={16} /> {sleepLabel[sleepOption]}
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
            <button className="mobile-player-utility-btn" onClick={() => setAudioMode((a) => !a)}>
              {audioMode ? <Music size={16} /> : <VideoIcon size={16} />} {audioMode ? 'Âm thanh' : 'Video'}
            </button>
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
    </div>
  );
}
