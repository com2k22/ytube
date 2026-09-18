import { useNavigate } from 'react-router-dom';
import { ListVideo, Clapperboard, Tv, PlayCircle } from 'lucide-react';
import { PlaylistCard } from '@/components/common/PlaylistCard';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useIsPhoneScreen } from '@/lib/screenSize';
import { MobileHomePage } from '@/pages/mobile/MobileHomePage';

/**
 * HomePage — Trang chủ, 4 khu: Tiếp tục xem / Danh sách / Video đề xuất / Kênh yêu thích.
 *
 * Toàn bộ logic lọc/sắp xếp nội dung nằm trong useHomeContent — DÙNG CHUNG với Trang chủ +
 * Khám phá trên điện thoại (xem hook đó). File này chỉ còn phần GIAO DIỆN cho TV/iPad/máy
 * tính, giữ NGUYÊN VẸN như trước khi tách hook.
 *
 * Trên ĐIỆN THOẠI THẬT: rẽ sang MobileHomePage (Trang chủ tối ưu cho nghe truyện) NGAY từ
 * đầu — xem chú thích ở HomePage() bên dưới (branch-at-the-top, giống PlayerPage.tsx).
 */
export function HomePage() {
  const isPhone = useIsPhoneScreen();
  if (isPhone) return <MobileHomePage />;
  return <HomePageDesktop />;
}

function HomePageDesktop() {
  const navigate = useNavigate();
  const home = useHomeContent();
  const {
    activeProfile,
    loading,
    sources,
    labelsOf,
    channels,
    continuingVideos,
    recommendedPlaylists,
    recommendedVideos,
    openSource,
    openContinuingVideo,
  } = home;

  if (!activeProfile) return null;

  return (
    <main className="main">
      <div className="greet">
        Xin chào, <span className="accent">{activeProfile.name}</span> 👋
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Đang tải nội dung...</p>}

      {!loading && sources.length === 0 && (
        <p style={{ opacity: 0.7, maxWidth: 480 }}>
          Chưa có nội dung nào trong whitelist của {activeProfile.name}. Bấm 🔒 Bố mẹ ở cuối menu bên trái để thêm
          playlist, video hoặc kênh đầu tiên nhé.
        </p>
      )}

      {continuingVideos.length > 0 && (
        // .section-block: bọc chung tiêu đề + hàng thẻ, để CSS ":focus-within" biết lúc nào
        // ô chọn đang nằm trong ĐÚNG khối này mà phóng to riêng dòng tiêu đề của khối đó —
        // xem .section-block:focus-within .section-title trong theme.css.
        // Mỗi thẻ ở đây LÀ 1 VIDEO cụ thể (không phải cả playlist) — xem continuingVideos.
        // "shelf-continue" — đánh dấu riêng khối này (khác "Danh sách"/"Video đề xuất")
        // để CSS giới hạn riêng khối này chỉ hiện tối đa 3 video/1 hàng trên iPad/tablet/
        // máy tính (xem ".shelf-continue" trong theme.css) — 2 khối kia vẫn xuống hàng
        // bình thường khi nhiều hơn 3.
        <div className="section-block">
          <div className="section-title">
            <PlayCircle className="section-icon" aria-hidden="true" /> Tiếp tục xem
          </div>
          <div className="shelf shelf-cap3 shelf-continue" style={{ marginBottom: 32 }}>
            {continuingVideos.map((entry) => (
              <PlaylistCard
                key={`${entry.source.id}:${entry.row.video_ref}`}
                title={entry.title}
                thumbnail={entry.thumbnail}
                type="youtube_video"
                region="continue"
                inProgress
                progressPercent={entry.row.progress_percent}
                labels={labelsOf(entry.source)}
                onClick={() => openContinuingVideo(entry)}
              />
            ))}
          </div>
        </div>
      )}

      {recommendedPlaylists.length > 0 && (
        <div className="section-block">
          <div className="section-title">
            <ListVideo className="section-icon" aria-hidden="true" /> Danh sách
          </div>
          {/* Cùng kiểu hàng ngang cuộn được như khối "Tiếp tục xem" (trước đây khối này là
              lưới nhiều hàng). Vùng điều hướng đặt tên riêng "playlistrec" — KHÔNG dùng
              chung tên "playlist" với trang Kênh, vì bên đó playlist xếp lưới 3 cột, còn ở
              đây là 1 hàng ngang; dùng chung tên thì phím mũi tên sẽ chạy sai ở một trong
              hai chỗ. */}
          <div className="shelf shelf-cap3" style={{ marginBottom: 32 }}>
            {recommendedPlaylists.map((source) => (
              <PlaylistCard
                key={source.id}
                title={source.title}
                thumbnail={source.thumbnail}
                type={source.type}
                region="playlistrec"
                labels={labelsOf(source)}
                onClick={() => openSource(source)}
              />
            ))}
          </div>
        </div>
      )}

      {recommendedVideos.length > 0 && (
        <div className="section-block">
          <div className="section-title">
            <Clapperboard className="section-icon" aria-hidden="true" /> Video đề xuất
          </div>
          <div className="shelf shelf-cap3" style={{ marginBottom: 32 }}>
            {recommendedVideos.map((source) => (
              <PlaylistCard
                key={source.id}
                title={source.title}
                thumbnail={source.thumbnail}
                type={source.type}
                region="videorec"
                labels={labelsOf(source)}
                onClick={() => openSource(source)}
              />
            ))}
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <div className="section-block">
          <div className="section-title">
            <Tv className="section-icon" aria-hidden="true" /> Kênh yêu thích
          </div>
          <div className="shelf channel-shelf" style={{ marginBottom: 32 }}>
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="channel-item"
                data-region="channel"
                tabIndex={0}
                onClick={() => navigate(`/channel/${ch.id}`)}
              >
                <div
                  className="channel-avatar"
                  style={ch.thumbnail ? { backgroundImage: `url(${ch.thumbnail})`, backgroundSize: 'cover' } : undefined}
                >
                  {!ch.thumbnail && '📺'}
                </div>
                <div className="channel-name">{ch.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
