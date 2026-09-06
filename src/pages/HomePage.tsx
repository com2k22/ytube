import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListVideo, Clapperboard, Tv, PlayCircle } from 'lucide-react';
import { useProfileContext } from '@/context/ProfileContext';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useContentLabels } from '@/hooks/useContentLabels';
import { PlaylistCard } from '@/components/common/PlaylistCard';
import { StreakBadge } from '@/components/common/StreakBadge';
import { extractVideoId, extractPlaylistId } from '@/utils/youtubeParser';
import { fetchVideoInfo } from '@/lib/youtube';
import type { AllowedSource, ContentLabel } from '@/types';

/** Tối đa bao nhiêu video hiện trong khối "Tiếp tục xem" — xem giải thích đầy đủ ở
    continuingVideos bên dưới. */
const CONTINUE_LIMIT = 5;

/** Trang chủ — 4 khu: Tiếp tục xem / Danh sách / Video đề xuất / Kênh yêu thích. */
export function HomePage() {
  const { activeProfile } = useProfileContext();
  const { sources, loading } = useAllowedSources(activeProfile?.id ?? null);
  const { rows: progressRows } = useWatchProgress(activeProfile?.id ?? null);
  const { labels: allLabels } = useContentLabels();
  const navigate = useNavigate();
  /** Cache tên thật + ảnh đại diện của từng VIDEO trong 1 playlist YouTube thật (không phải
      playlist tự tạo) — cần gọi riêng YouTube Data API theo videoId vì playlist YouTube
      không tải sẵn danh sách video ở Trang chủ (xem continuingRows/continuingVideos bên
      dưới). Khai báo TRƯỚC return sớm — đây là hook, phải gọi đều mỗi lượt render. */
  const [videoInfoCache, setVideoInfoCache] = useState<Record<string, { title: string; thumbnail: string | null } | null>>(
    {}
  );

  const hiddenLabelId = allLabels.find((l) => l.is_hidden)?.id ?? null;
  const priorityLabelId = allLabels.find((l) => l.is_priority)?.id ?? null;
  /** Nhãn thật (đối tượng đầy đủ) đã gán cho 1 nguồn — bỏ qua nhãn Ẩn (không cần hiện chip
      cho nhãn đó, xem PlaylistCard.tsx) và bỏ qua id nhãn "ma" (đã xoá nhưng lỡ còn sót). */
  const labelsOf = (s: AllowedSource): ContentLabel[] =>
    s.label_ids.map((id) => allLabels.find((l) => l.id === id)).filter((l): l is ContentLabel => !!l && !l.is_hidden);
  const isHidden = (s: AllowedSource) => !!hiddenLabelId && s.label_ids.includes(hiddenLabelId);
  const isPriority = (s: AllowedSource) => !!priorityLabelId && s.label_ids.includes(priorityLabelId);
  /** Sắp nội dung gán nhãn "Ưu tiên" lên ĐẦU mỗi mục — giữ nguyên thứ tự tương đối giữa các
      video còn lại (Array.prototype.sort ổn định), chỉ kéo nhóm Ưu tiên lên trước. */
  const sortPriorityFirst = <T,>(items: T[], getSource: (item: T) => AllowedSource): T[] =>
    [...items].sort((a, b) => Number(isPriority(getSource(b))) - Number(isPriority(getSource(a))));

  const playable = sources
    .filter(
      (s) =>
        s.type === 'youtube_playlist' || s.type === 'youtube_video' || s.type === 'direct_url' || s.type === 'custom_playlist'
    )
    // Nhãn "Ẩn" — tạm ẩn khỏi Trang chủ (vẫn xem được nếu vào thẳng trang Kênh chứa nó).
    .filter((s) => !isHidden(s));
  const channels = sources.filter((s) => s.type === 'youtube_channel').filter((s) => !isHidden(s));

  /**
   * "Tiếp tục xem" — NÂNG CẤP theo yêu cầu: hiện đúng từng VIDEO đang xem dở gần đây nhất
   * (tối đa CONTINUE_LIMIT), KHÔNG còn gộp theo playlist nữa. Trước đây bấm vào 1 playlist ở
   * đây chỉ biết "playlist này có xem dở", phải tự mở playlist rồi tìm lại đúng video — giờ
   * mỗi thẻ ở đây LÀ đúng 1 video, bấm vào là vào thẳng video đó (đã tự tua đúng chỗ đang
   * xem dở, xem PlayerPage.tsx). Trang danh sách video của playlist (bấm từ khối "Danh
   * sách" bên dưới) vẫn giữ nguyên như cũ — mở ra để bé tự chọn video.
   *
   * Sắp theo lần xem gần nhất (updated_at, mới nhất trước), bỏ qua video mà nguồn của nó
   * không còn trong whitelist nữa (đã xoá) hoặc đang bị gắn nhãn "Ẩn".
   */
  const continuingRows = useMemo(() => {
    return progressRows
      .filter((r) => r.progress_percent > 0 && r.progress_percent < 100)
      .filter((r) => {
        const src = sources.find((s) => s.id === r.source_id);
        return !!src && !(hiddenLabelId && src.label_ids.includes(hiddenLabelId));
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, CONTINUE_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressRows, sources, hiddenLabelId]);

  // Video thuộc playlist YouTube THẬT hoặc video "mượn" từ 1 kênh whitelist (KHÔNG phải
  // playlist tự tạo) — chưa biết tên/ảnh thật của đúng video đó (chỉ có tên/ảnh của cả
  // playlist/kênh), phải tự dò riêng qua YouTube Data API theo videoId (giống cách
  // AddSourceForm dò tiêu đề khi thêm nội dung).
  useEffect(() => {
    const missingIds = continuingRows
      .map((r) => ({ r, src: sources.find((s) => s.id === r.source_id) }))
      .filter(
        ({ src, r }) =>
          (src?.type === 'youtube_playlist' || src?.type === 'youtube_channel') && !(r.video_ref in videoInfoCache)
      )
      .map(({ r }) => r.video_ref);
    if (missingIds.length === 0) return;
    let cancelled = false;
    Promise.all(missingIds.map((id) => fetchVideoInfo(id).then((info) => [id, info] as const))).then((results) => {
      if (cancelled) return;
      setVideoInfoCache((prev) => {
        const next = { ...prev };
        for (const [id, info] of results) next[id] = info;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [continuingRows, sources, videoInfoCache]);

  /** Dựng đủ thông tin hiển thị (tên/ảnh THẬT của đúng video, không phải của cả playlist)
      + tham số điều hướng cho từng thẻ "Tiếp tục xem". */
  const continuingVideos = continuingRows
    .map((r) => {
      const source = sources.find((s) => s.id === r.source_id);
      if (!source) return null;
      let title = source.title;
      let thumbnail = source.thumbnail;
      let videoParam = r.video_ref;
      let directUrlParam: string | null = null;
      let playlistId: string | null = null;

      if (source.type === 'custom_playlist') {
        const item = source.items.find((it) => it.videoId === r.video_ref);
        if (item) {
          title = item.title;
          thumbnail = item.thumbnail;
        }
      } else if (source.type === 'youtube_playlist') {
        playlistId = extractPlaylistId(source.url);
        const info = videoInfoCache[r.video_ref];
        if (info) {
          title = info.title;
          thumbnail = info.thumbnail;
        }
      } else if (source.type === 'youtube_channel') {
        // Video "mượn" từ 1 playlist của kênh — không có playlistId cố định lưu sẵn theo
        // video (chỉ có sourceId của kênh), nên mở lại như 1 video lẻ (vẫn tua đúng chỗ
        // đang xem dở bình thường, chỉ không kèm "video tiếp theo trong playlist").
        const info = videoInfoCache[r.video_ref];
        if (info) {
          title = info.title;
          thumbnail = info.thumbnail;
        }
      } else if (source.type === 'direct_url') {
        directUrlParam = source.url;
      }
      // youtube_video: video_ref đã đúng là videoId của chính source đó, title/thumbnail
      // của source đã là của đúng video này rồi — không cần xử lý thêm.

      return { row: r, source, title, thumbnail, videoParam, directUrlParam, playlistId };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Nội dung đang "xem dở" ở khối Tiếp tục xem VẪN hiện tiếp ở khối Playlist/Video đề xuất
  // bên dưới (không loại trừ) — để bé dễ tìm lại kể cả khi đã cuộn qua khối đầu.

  // Video YouTube đơn lẻ đã được ghép vào 1 playlist tự tạo nào đó (trong app) thì không
  // hiện riêng ở khối "Video đề xuất" nữa — đã xem được thông qua playlist đó rồi.
  const videoIdsInCustomPlaylists = new Set(
    sources.filter((s) => s.type === 'custom_playlist').flatMap((s) => s.items.map((it) => it.videoId))
  );

  const recommendedPlaylists = sortPriorityFirst(
    playable.filter((s) => s.type === 'youtube_playlist' || s.type === 'custom_playlist'),
    (s) => s
  );
  const recommendedVideos = sortPriorityFirst(
    playable.filter((s) => {
      if (s.type === 'direct_url') return true;
      if (s.type === 'youtube_video') {
        const vid = extractVideoId(s.url);
        return !vid || !videoIdsInCustomPlaylists.has(vid);
      }
      return false;
    }),
    (s) => s
  );

  /** Mở 1 playlist/kênh/video từ khối "Danh sách"/"Video đề xuất" — GIỮ NGUYÊN như cũ:
      playlist/playlist tự tạo mở trang danh sách video để bé tự chọn (không đoán hộ đang
      xem dở video nào — xem khối "Tiếp tục xem" phía trên, giờ đã tách riêng theo video). */
  const openSource = (source: AllowedSource) => {
    if (source.type === 'youtube_playlist' || source.type === 'custom_playlist') {
      navigate(`/playlist/${source.id}`);
      return;
    }
    // Truyền sẵn videoId/directUrl (đã có trong bộ nhớ, khỏi cần đợi PlayerPage tải lại
    // nguồn từ Supabase) để trang phát video render được NGAY trong lượt render đầu tiên —
    // nhờ đó lệnh tự vào toàn màn hình + tự phát vẫn còn nằm trong "cử chỉ bấm" của bé,
    // tránh bị trình duyệt chặn tự phát (trước đây phải đợi tải xong mới phát nên hay bị
    // chặn, ra màn hình đen).
    const params = new URLSearchParams({ sourceId: source.id, title: source.title });
    if (source.type === 'youtube_video') {
      const vid = extractVideoId(source.url);
      if (vid) params.set('videoId', vid);
    } else if (source.type === 'direct_url') {
      params.set('directUrl', source.url);
    }
    navigate(`/player?${params.toString()}`);
  };

  /** Mở đúng 1 VIDEO từ khối "Tiếp tục xem" — vào thẳng video đó (đã tự tua tới chỗ đang
      xem dở, xem PlayerPage.tsx mục startSeconds), không phải qua trang danh sách nữa. */
  const openContinuingVideo = (entry: (typeof continuingVideos)[number]) => {
    const params = new URLSearchParams({ sourceId: entry.source.id, title: entry.title });
    if (entry.directUrlParam) params.set('directUrl', entry.directUrlParam);
    else params.set('videoId', entry.videoParam);
    if (entry.playlistId) params.set('playlistId', entry.playlistId);
    navigate(`/player?${params.toString()}`);
  };

  if (!activeProfile) return null;

  return (
    <main className="main">
      <div className="greet">
        Xin chào, <span className="accent">{activeProfile.name}</span> 👋
      </div>

      {/* Huy hiệu nhỏ "giữ đúng giờ xem N ngày liên tiếp" — tự ẩn khi bé chưa giữ được ngày
          nào hoặc gia đình chưa đặt lịch giờ xem (xem StreakBadge.tsx). */}
      <StreakBadge profileId={activeProfile.id} />

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
        <div className="section-block">
          <div className="section-title">
            <PlayCircle className="section-icon" aria-hidden="true" /> Tiếp tục xem
          </div>
          <div className="shelf shelf-cap3" style={{ marginBottom: 32 }}>
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
