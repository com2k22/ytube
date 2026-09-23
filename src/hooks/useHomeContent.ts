import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useFavorites } from '@/hooks/useFavorites';
import { useContentLabels } from '@/hooks/useContentLabels';
import { useIsPhoneScreen } from '@/lib/screenSize';
import { loadYouTubeApi } from '@/components/player/SafeYouTubePlayer';
import { extractVideoId, extractPlaylistId } from '@/utils/youtubeParser';
import { fetchVideoInfo } from '@/lib/youtube';
import { playerParamsToSearch, type PlayerEngineParams } from '@/hooks/usePlayerEngine';
import type { AllowedSource, ContentLabel } from '@/types';

/** Tối đa bao nhiêu video hiện trong khối "Tiếp tục xem". */
const CONTINUE_LIMIT = 5;

/**
 * useHomeContent — TOÀN BỘ logic "nội dung gì hiện ở Trang chủ" (lọc nhãn Ẩn/Ưu tiên, khối
 * Tiếp tục xem/Danh sách/Video đề xuất/Kênh yêu thích, dò tên-ảnh thật cho video "mượn" từ
 * playlist/kênh...), tách ra từ HomePage.tsx (giữ NGUYÊN VẸN hành vi cho TV/iPad/máy tính —
 * xem HomePage.tsx dùng hook này) để dùng lại được ở Trang chủ + Khám phá trên điện thoại
 * (MobileHomePage/MobileDiscoverPage), tránh viết 2 lần 2 cách lọc nội dung khác nhau — đúng
 * yêu cầu "tận dụng tối đa logic/hooks hiện có, không tạo hệ thống song song".
 *
 * Vì sao KHÔNG cố "chỉ tải 1 lần dùng chung" giữa bản TV và bản điện thoại: 2 giao diện đó
 * không bao giờ cùng mount 1 lúc (HomePage.tsx rẽ nhánh NGAY từ đầu, xem branch-at-the-top ở
 * đó và ở PlayerPage.tsx) — gọi lại hook này ở mỗi nhánh không hề gọi Supabase 2 lần cùng
 * lúc, chỉ đơn thuần là dùng CHUNG ĐÚNG 1 bộ luật lọc/sắp xếp.
 */
export function useHomeContent() {
  const { activeProfile } = useProfileContext();
  const { sources, loading } = useAllowedSources(activeProfile?.id ?? null);
  const { rows: progressRows } = useWatchProgress(activeProfile?.id ?? null);
  /** "Bé thích" (kệ ở Trang chủ điện thoại) — xem favoriteVideos bên dưới. Bấm tim để đánh
      dấu/bỏ đánh dấu CHỈ làm được trong trình phát (MobilePlayerHost.tsx tự gọi useFavorites
      riêng để toggle) — ở đây chỉ ĐỌC lại `rows` để dựng danh sách hiển thị. */
  const { rows: favoriteRows } = useFavorites(activeProfile?.id ?? null);
  const { labels: allLabels } = useContentLabels();
  const navigate = useNavigate();
  // Điện thoại thật hay không — dùng để lọc theo 2 nhãn "Chỉ điện thoại"/"Chỉ TV/iPad/máy
  // tính" bên dưới (xem supabase/019_device_visibility_labels.sql). Gọi lại đúng hook này ở
  // cả nhánh TV/desktop lẫn nhánh điện thoại (branch-at-the-top, xem HomePage.tsx) nên luôn
  // đọc đúng loại thiết bị đang thật sự hiển thị trang này.
  const isPhone = useIsPhoneScreen();
  /** Cache tên thật + ảnh đại diện của từng VIDEO trong 1 playlist YouTube thật/1 kênh (xem
      continuingVideos bên dưới) — cần gọi riêng YouTube Data API theo videoId. */
  const [videoInfoCache, setVideoInfoCache] = useState<Record<string, { title: string; thumbnail: string | null } | null>>(
    {}
  );

  // Tải trước script YouTube IFrame Player API — xem giải thích gốc ở HomePage.tsx (trước
  // khi tách hook), giữ nguyên lý do/hành vi.
  useEffect(() => {
    loadYouTubeApi();
  }, []);

  const hiddenLabelId = allLabels.find((l) => l.is_hidden)?.id ?? null;
  const priorityLabelId = allLabels.find((l) => l.is_priority)?.id ?? null;
  // "Mobile"/"TV" — 2 nhãn đặc biệt mới, cùng cơ chế với Ưu tiên/Ẩn ở trên (xem
  // supabase/019_device_visibility_labels.sql). Không gán nhãn nào trong 2 nhãn này thì
  // nội dung hiện ở MỌI thiết bị như trước giờ, không đổi gì.
  const phoneOnlyLabelId = allLabels.find((l) => l.is_phone_only)?.id ?? null;
  const desktopOnlyLabelId = allLabels.find((l) => l.is_desktop_only)?.id ?? null;
  const labelsOf = (s: AllowedSource): ContentLabel[] =>
    s.label_ids.map((id) => allLabels.find((l) => l.id === id)).filter((l): l is ContentLabel => !!l && !l.is_hidden);
  const isHidden = (s: AllowedSource) => !!hiddenLabelId && s.label_ids.includes(hiddenLabelId);
  const isPriority = (s: AllowedSource) => !!priorityLabelId && s.label_ids.includes(priorityLabelId);
  /** true = nội dung này bị giới hạn theo thiết bị và thiết bị ĐANG XEM không thuộc nhóm
      được phép — VD gán "Chỉ điện thoại" mà đang mở trên TV/máy tính thì true. Giống hệt
      is_hidden: chỉ ẩn khỏi Trang chủ/Khám phá, vào thẳng trang Kênh/Playlist vẫn xem được
      bình thường (những trang đó không gọi hàm này). */
  const isHiddenOnThisDevice = (s: AllowedSource) =>
    (!!phoneOnlyLabelId && s.label_ids.includes(phoneOnlyLabelId) && !isPhone) ||
    (!!desktopOnlyLabelId && s.label_ids.includes(desktopOnlyLabelId) && isPhone);
  const sortPriorityFirst = <T,>(items: T[], getSource: (item: T) => AllowedSource): T[] =>
    [...items].sort((a, b) => Number(isPriority(getSource(b))) - Number(isPriority(getSource(a))));

  const playable = sources
    .filter(
      (s) =>
        s.type === 'youtube_playlist' ||
        s.type === 'youtube_video' ||
        s.type === 'direct_url' ||
        s.type === 'custom_playlist' ||
        s.type === 'gdrive_folder'
    )
    .filter((s) => !isHidden(s) && !isHiddenOnThisDevice(s));
  const channels = sources
    .filter((s) => s.type === 'youtube_channel')
    .filter((s) => !isHidden(s) && !isHiddenOnThisDevice(s));

  const continuingRows = useMemo(() => {
    return progressRows
      .filter((r) => r.progress_percent > 0 && r.progress_percent < 100)
      .filter((r) => {
        const src = sources.find((s) => s.id === r.source_id);
        return !!src && !(hiddenLabelId && src.label_ids.includes(hiddenLabelId)) && !isHiddenOnThisDevice(src);
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, CONTINUE_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressRows, sources, hiddenLabelId, phoneOnlyLabelId, desktopOnlyLabelId, isPhone]);

  /** Cùng cách lọc như continuingRows (bỏ nguồn đã ẩn/không hợp thiết bị), nhưng KHÔNG lọc
      theo % xem dở (favorite không liên quan gì tới tiến độ xem) và KHÔNG giới hạn số lượng —
      bé thích bao nhiêu thì hiện hết bấy nhiêu. Mới nhất (bấm tim gần đây nhất) lên đầu. */
  const favoriteRowsVisible = useMemo(() => {
    return favoriteRows
      .filter((r) => {
        const src = sources.find((s) => s.id === r.source_id);
        return !!src && !(hiddenLabelId && src.label_ids.includes(hiddenLabelId)) && !isHiddenOnThisDevice(src);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteRows, sources, hiddenLabelId, phoneOnlyLabelId, desktopOnlyLabelId, isPhone]);

  useEffect(() => {
    // Gộp chung 2 nguồn cần dò tên/ảnh thật qua YouTube Data API (Tiếp tục xem + Bé thích) —
    // cùng 1 cache (videoInfoCache), cùng 1 điều kiện "chỉ playlist/kênh YouTube thật mới cần
    // dò" (custom_playlist đã có sẵn title/thumbnail trong items, direct_url/gdrive_folder/
    // video lẻ dùng thẳng title/thumbnail của chính dòng whitelist, không cần gọi API).
    const missingIds = [...continuingRows, ...favoriteRowsVisible]
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
  }, [continuingRows, favoriteRowsVisible, sources, videoInfoCache]);

  /** Dò tên/ảnh THẬT + tham số phát cho ĐÚNG 1 video, từ 1 dòng chỉ có (source_id, video_ref)
      — dùng CHUNG cho cả "Tiếp tục xem" (continuingRows, từ watch_progress) LẪN "Bé thích"
      (favoriteRowsVisible, từ favorites): 2 bảng khác nhau nhưng cùng chung đúng 1 quy ước
      (source_id, video_ref) nên dò ra video y hệt nhau — tách hàm này ra để khỏi viết lặp lại
      2 lần cùng 1 khối if/else if. null = không tìm thấy dòng whitelist gốc (VD nguồn đã bị
      phụ huynh xoá sau khi bé từng xem/thích). */
  const resolveRowVideo = <R extends { source_id: string; video_ref: string }>(r: R) => {
    const source = sources.find((s) => s.id === r.source_id);
    if (!source) return null;
    let title = source.title;
    let thumbnail = source.thumbnail;
    const videoParam = r.video_ref;
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
      const info = videoInfoCache[r.video_ref];
      if (info) {
        title = info.title;
        thumbnail = info.thumbnail;
      }
    } else if (source.type === 'direct_url' || source.type === 'gdrive_folder') {
      directUrlParam = source.url;
    }

    return { row: r, source, title, thumbnail, videoParam, directUrlParam, playlistId };
  };

  const continuingVideos = continuingRows
    .map(resolveRowVideo)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  /** "Bé thích" — mỗi mục là ĐÚNG 1 video/audio (dù đứng riêng lẻ hay là 1 tập trong
      playlist/kênh), hiện đúng tên/ảnh của CHÍNH tập đó (không phải tên/ảnh chung của cả
      playlist) — xem resolveRowVideo ở trên + supabase/022_favorites_video_ref.sql. */
  const favoriteVideos = favoriteRowsVisible
    .map(resolveRowVideo)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const videoIdsInCustomPlaylists = new Set(
    sources.filter((s) => s.type === 'custom_playlist').flatMap((s) => s.items.map((it) => it.videoId))
  );

  const recommendedPlaylists = sortPriorityFirst(
    playable.filter((s) => s.type === 'youtube_playlist' || s.type === 'custom_playlist'),
    (s) => s
  );
  const recommendedVideos = sortPriorityFirst(
    playable.filter((s) => {
      if (s.type === 'direct_url' || s.type === 'gdrive_folder') return true;
      if (s.type === 'youtube_video') {
        const vid = extractVideoId(s.url);
        return !vid || !videoIdsInCustomPlaylists.has(vid);
      }
      return false;
    }),
    (s) => s
  );

  /** true = nguồn này mở ra 1 TRANG DANH SÁCH video (playlist/playlist tự tạo) chứ không
      phải phát thẳng 1 video — dùng để quyết định điều hướng ở nơi gọi. */
  const isListSource = (source: AllowedSource) => source.type === 'youtube_playlist' || source.type === 'custom_playlist';

  /** Dựng tham số phát cho 1 nguồn video/link trực tiếp đơn lẻ (KHÔNG dùng cho playlist —
      xem isListSource ở trên, nơi gọi phải tự điều hướng `/playlist/:id`). null = nguồn
      không phải video phát thẳng được (vd thiếu videoId hợp lệ). */
  const buildSourcePlayerParams = (source: AllowedSource): PlayerEngineParams | null => {
    if (isListSource(source)) return null;
    if (source.type === 'youtube_video') {
      const vid = extractVideoId(source.url);
      if (!vid) return null;
      return { sourceId: source.id, title: source.title, videoId: vid, directUrl: null, playlistId: null, thumbnail: source.thumbnail };
    }
    if (source.type === 'direct_url' || source.type === 'gdrive_folder') {
      return { sourceId: source.id, title: source.title, videoId: null, directUrl: source.url, playlistId: null, thumbnail: source.thumbnail };
    }
    return null;
  };

  /** Dựng tham số phát cho 1 mục trong "Tiếp tục xem" — LUÔN phát thẳng được (đã lọc sẵn ở
      continuingVideos), không cần trả về null. */
  const buildContinuingPlayerParams = (entry: (typeof continuingVideos)[number]): PlayerEngineParams => ({
    sourceId: entry.source.id,
    title: entry.title,
    videoId: entry.directUrlParam ? null : entry.videoParam,
    directUrl: entry.directUrlParam,
    playlistId: entry.playlistId,
    thumbnail: entry.thumbnail,
  });

  /** Dựng tham số phát cho 1 mục trong "Bé thích" — CÙNG hình dạng dữ liệu với "Tiếp tục
      xem" ở trên (cả 2 đều đi qua resolveRowVideo) nên thân hàm y hệt, chỉ tách riêng tên hàm
      cho rõ ngữ cảnh gọi (MobileHomePage.tsx). */
  const buildFavoritePlayerParams = (entry: (typeof favoriteVideos)[number]): PlayerEngineParams => ({
    sourceId: entry.source.id,
    title: entry.title,
    videoId: entry.directUrlParam ? null : entry.videoParam,
    directUrl: entry.directUrlParam,
    playlistId: entry.playlistId,
    thumbnail: entry.thumbnail,
  });

  /** Mở 1 playlist/kênh/video từ khối "Danh sách"/"Video đề xuất" bằng ĐIỀU HƯỚNG URL — dùng
      cho TV/iPad/máy tính (giữ nguyên hành vi cũ). Trang điện thoại nên dùng
      buildSourcePlayerParams + MobilePlaybackContext.playVideo() thay vì hàm này, để có sẵn
      ảnh đại diện cho mini player mà không cần round-trip qua URL. */
  const openSource = (source: AllowedSource) => {
    if (isListSource(source)) {
      navigate(`/playlist/${source.id}`);
      return;
    }
    const p = buildSourcePlayerParams(source);
    if (!p) return;
    navigate(`/player?${playerParamsToSearch(p)}`);
  };

  /** Mở đúng 1 VIDEO từ khối "Tiếp tục xem" bằng ĐIỀU HƯỚNG URL — xem ghi chú ở openSource. */
  const openContinuingVideo = (entry: (typeof continuingVideos)[number]) => {
    navigate(`/player?${playerParamsToSearch(buildContinuingPlayerParams(entry))}`);
  };

  return {
    activeProfile,
    loading,
    sources,
    allLabels,
    labelsOf,
    isHidden,
    isPriority,
    playable,
    channels,
    continuingVideos,
    favoriteVideos,
    recommendedPlaylists,
    recommendedVideos,
    isListSource,
    buildSourcePlayerParams,
    buildContinuingPlayerParams,
    buildFavoritePlayerParams,
    openSource,
    openContinuingVideo,
  };
}
