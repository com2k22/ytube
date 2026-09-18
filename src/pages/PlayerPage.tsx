import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SafeYouTubePlayer } from '@/components/player/SafeYouTubePlayer';
import { DirectVideoPlayer } from '@/components/player/DirectVideoPlayer';
import { VideoCard } from '@/components/common/VideoCard';
import { usePlayerEngine, type PlayerEngineParams } from '@/hooks/usePlayerEngine';
import { useIsPhoneScreen } from '@/lib/screenSize';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';

/**
 * PlayerPage — trang phát 1 video, dùng chung cho: video trong playlist đã whitelist,
 * playlist "mượn" từ kênh, hoặc video/link trực tiếp đã whitelist riêng lẻ.
 * Nhận dữ liệu qua query string: ?sourceId=&videoId=&directUrl=&title=&playlistId=
 *
 * Cố tình ưu tiên đọc videoId/directUrl thẳng từ query string (nếu nơi điều hướng đã biết
 * sẵn — xem HomePage.tsx) thay vì luôn chờ tải lại từ Supabase: nhờ vậy video render được
 * NGAY ở lượt render đầu tiên, giữ được "cử chỉ bấm" của bé để trình duyệt cho phép tự toàn
 * màn hình + tự phát — chờ tải xong mới phát dễ bị chặn tự phát (màn hình đen).
 *
 * Toàn bộ logic "nghiệp vụ" (tiến độ xem, phiên xem, playlist, đếm tự chuyển video...) nằm
 * trong usePlayerEngine — dùng chung với trình phát nổi trên điện thoại (MobilePlayerHost),
 * xem chú thích ở hook đó. File này chỉ còn phần GIAO DIỆN cho TV/iPad/máy tính, giữ NGUYÊN
 * VẸN như trước.
 *
 * Trên ĐIỆN THOẠI THẬT: màn hình này không tự vẽ trình phát (xem PlayerPageMobileBridge bên
 * dưới) — MobilePlayerHost (mount trong Layout.tsx, sống ngoài router nên không bị tắt khi
 * bé lướt sang trang khác) mới là nơi vẽ. Các trang CHƯA kịp nâng cấp riêng cho điện thoại
 * (HomePage/ChannelPage/PlaylistVideosView... hiện vẫn điều hướng thẳng bằng URL
 * `/player?videoId=...` y hệt trước đây) vẫn phải chạy được — nên PlayerPageMobileBridge tự
 * đọc lại đúng query string đó rồi báo cho MobilePlaybackContext biết "phát bài này", KHÔNG
 * bắt buộc nơi điều hướng phải gọi context trước. Các trang điện thoại mới sau này (task
 * "Trang chủ điện thoại"...) có thể gọi thẳng `playVideo()` trước khi điều hướng để có sẵn
 * ảnh đại diện — bridge này vẫn chạy vô hại (đọc lại đúng những gì vừa gán).
 */
export function PlayerPage() {
  // Tách hẳn ra các component con phía dưới thay vì chỉ "return null"/rẽ nhánh giữa chừng ở
  // đây: usePlayerEngine bên trong PlayerPageDesktop mở phiên xem + lưu tiến độ + đếm mạch
  // xem liên tục — nếu gọi hook đó ngay tại đây rồi mới quyết định ẩn đi thì trên điện thoại
  // sẽ có ĐẾN 2 nơi cùng chạy các việc đó (component này + MobilePlayerHost), ghi trùng lặp.
  // Tách thành các component riêng (mount/unmount hẳn, không phải if giữa các hook) mới an toàn.
  const isPhone = useIsPhoneScreen();
  if (isPhone) return <PlayerPageMobileBridge />;
  return <PlayerPageDesktop />;
}

/**
 * PlayerPageMobileBridge — SỬA LỖI "bấm phát ra màn hình đen trên điện thoại": trước đây
 * component này chỉ return null, không ai báo cho MobilePlaybackContext biết cần phát video
 * nào cả, nên MobilePlayerHost cũng không có gì để vẽ. Giờ tự đọc query string (giống hệt
 * PlayerPageDesktop) và gọi `playVideo()` — mọi nơi điều hướng CŨ (HomePage, ChannelPage,
 * PlaylistVideosView...) vẫn hoạt động nguyên vẹn trên điện thoại mà không cần sửa gì thêm.
 *
 * Bỏ qua khi query string RỖNG (mở `/player` không kèm gì) — đây là trường hợp
 * MobilePlayerHost tự điều hướng tới đây để MỞ TOÀN MÀN HÌNH video đang phát sẵn (bấm vào
 * thanh mini, xem MobilePlayerHost.tsx: `openFull`) — không được ghi đè "đang phát gì" bằng
 * dữ liệu rỗng, không thì bấm mở to sẽ tự tắt luôn video đang nghe.
 */
function PlayerPageMobileBridge() {
  const [params] = useSearchParams();
  const { playVideo } = useMobilePlayback();
  const sourceId = params.get('sourceId');
  const videoId = params.get('videoId');
  const directUrl = params.get('directUrl');
  const title = params.get('title');
  const playlistId = params.get('playlistId');

  useEffect(() => {
    if (!videoId && !directUrl && !sourceId) return;
    playVideo({ sourceId, videoId, directUrl, title, playlistId, thumbnail: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, videoId, directUrl, title, playlistId]);

  return null;
}

function PlayerPageDesktop() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const sourceId = params.get('sourceId');
  const engineParams: PlayerEngineParams = {
    sourceId,
    videoId: params.get('videoId'),
    directUrl: params.get('directUrl'),
    title: params.get('title'),
    playlistId: params.get('playlistId'),
  };

  const buildPlayerUrl = (next: PlayerEngineParams) => {
    const p = new URLSearchParams({ title: next.title ?? '' });
    if (next.directUrl) p.set('directUrl', next.directUrl);
    else if (next.videoId) p.set('videoId', next.videoId);
    if (next.playlistId) p.set('playlistId', next.playlistId);
    if (next.sourceId) p.set('sourceId', next.sourceId);
    return `/player?${p.toString()}`;
  };

  const engine = usePlayerEngine({
    params: engineParams,
    // replace: true — cố ý THAY THẾ trang hiện tại trong lịch sử thay vì chồng thêm 1 trang
    // mới. Không có nó thì xem liên tiếp nhiều video xong bấm Back phải bấm nhiều lần mới ra
    // được. Có nó thì bấm Back 1 lần là về thẳng chỗ cũ.
    onNavigateToVideo: (next) => navigate(buildPlayerUrl(next), { replace: true }),
    onExit: () => navigate('/'),
  });

  const { kind, ytVideoId, directUrl, title, handleProgress, handleEnded, goToVideo, prevVideo, nextVideo, nextVideos, drawerVideos, autoNextIn, setAutoNextIn } =
    engine;

  // Mở bất kỳ video nào — dù từ trong playlist, hay bấm trực tiếp 1 video đơn lẻ ở trang
  // chủ/kênh — đều tự phát + tự vào toàn màn hình ngay, không cần bấm thêm lần nào nữa.
  const autoFullscreen = true;

  return (
    <main className="main">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate(-1)}>
        ← Quay lại
      </button>

      {kind === 'youtube' && ytVideoId && (
        <SafeYouTubePlayer
          videoId={ytVideoId}
          title={title}
          onProgress={handleProgress}
          onEnded={handleEnded}
          autoFullscreen={autoFullscreen}
          onPrev={() => prevVideo && goToVideo(prevVideo)}
          onNext={() => nextVideo && goToVideo(nextVideo)}
          hasPrev={!!prevVideo}
          hasNext={!!nextVideo}
          playlistVideos={drawerVideos}
          onSelectVideo={goToVideo}
        />
      )}
      {kind === 'direct' && directUrl && (
        <DirectVideoPlayer
          url={directUrl}
          title={title}
          onProgress={handleProgress}
          onEnded={handleEnded}
          autoFullscreen={autoFullscreen}
          onPrev={() => prevVideo && goToVideo(prevVideo)}
          onNext={() => nextVideo && goToVideo(nextVideo)}
          hasPrev={!!prevVideo}
          hasNext={!!nextVideo}
          playlistVideos={drawerVideos}
          onSelectVideo={goToVideo}
        />
      )}
      {!kind && <p style={{ opacity: 0.6 }}>Đang tải video...</p>}

      {/* Thanh đếm ngược tự chuyển video kế tiếp — luôn kèm nút dừng, để bé/bố mẹ chủ động
          ở lại nếu không muốn xem tiếp. */}
      {autoNextIn !== null && nextVideo && (
        <div className="autonext-bar">
          <span className="autonext-count">{autoNextIn}</span>
          <div className="autonext-text">
            <div className="autonext-label">Tự phát video tiếp theo sau {autoNextIn} giây</div>
            <div className="autonext-title">▶ {nextVideo.title}</div>
          </div>
          <button className="add-window-btn" data-region="autonext" tabIndex={0} onClick={() => setAutoNextIn(null)}>
            ✋ Dừng lại
          </button>
        </div>
      )}

      <div className="section-title" style={{ marginBottom: 26 }}>
        ▶ {title}
      </div>

      {nextVideos.length > 0 && (
        <>
          <div className="section-title">📂 Video tiếp theo trong playlist</div>
          <div className="grid3">
            {nextVideos.map((v) => (
              <VideoCard key={v.videoId} title={v.title} thumbnail={v.thumbnail} onClick={() => goToVideo(v)} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
