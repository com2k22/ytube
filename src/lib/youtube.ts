// Gọi YouTube Data API v3 để lấy danh sách video trong 1 playlist, hoặc danh sách
// playlist thuộc 1 kênh — dùng khi phụ huynh nhập link Playlist/Kênh vào whitelist.
//
// Cần VITE_YOUTUBE_API_KEY trong .env (xem .env.example). Nếu thiếu key, các hàm ở
// đây sẽ trả về mảng rỗng và ghi cảnh báo — UI sẽ tự hiển thị thông báo phù hợp
// thay vì crash.

const API_BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string | null {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}

export interface YtPlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string | null;
  position: number;
}

export interface YtPlaylistInfo {
  playlistId: string;
  title: string;
  thumbnail: string | null;
  itemCount: number;
}

// =====================================================================================
// LỌC BỎ VIDEO NGẮN (YouTube Shorts)
// -------------------------------------------------------------------------------------
// YouTube Data API KHÔNG có ô nào đánh dấu "đây là Short" — nên không thể hỏi thẳng.
// Cách nhận biết đáng tin cậy nhất mà app tự làm được: xem ĐỘ DÀI video. Short kinh điển
// dài tối đa 60 giây, nên mọi video từ 60 giây trở xuống đều bị loại.
//
// Vì sao KHÔNG đặt ngưỡng cao hơn (dù YouTube nay cho Short dài tới 3 phút): rất nhiều
// bài hát/truyện thiếu nhi bình thường chỉ dài 1-3 phút — đặt ngưỡng 3 phút sẽ xoá oan
// gần hết nội dung tử tế của bé. Nếu sau này vẫn thấy lọt Short, sửa đúng con số dưới
// đây (ví dụ lên 90) rồi deploy lại.
const SHORT_MAX_SECONDS = 60;

/** Đổi chuỗi độ dài kiểu YouTube ("PT1M30S", "PT45S", "PT1H2M3S") thành số giây. */
function parseIsoDurationToSeconds(iso: string): number {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/**
 * Hỏi YouTube độ dài của 1 loạt video, trả về danh sách id của những video KHÔNG phải
 * Short (dài hơn SHORT_MAX_SECONDS). Mỗi lần hỏi được tối đa 50 video nên phải chia lô.
 * Nếu gọi lỗi thì cố ý GIỮ NGUYÊN cả danh sách (thà lọt vài Short còn hơn tự dưng mất
 * sạch nội dung của bé vì mạng chập chờn).
 */
async function filterOutShorts(videoIds: string[], key: string): Promise<Set<string>> {
  const keep = new Set<string>(videoIds);
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    try {
      const url = `${API_BASE}/videos?part=contentDetails&id=${batch.join(',')}&key=${key}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error('[Ytube] Lỗi gọi YouTube API (videos.contentDetails):', await res.text());
        continue;
      }
      const data = await res.json();
      for (const item of data.items ?? []) {
        const seconds = parseIsoDurationToSeconds(item.contentDetails?.duration);
        if (seconds > 0 && seconds <= SHORT_MAX_SECONDS) keep.delete(item.id);
      }
    } catch (err) {
      console.error('[Ytube] Không kiểm tra được độ dài video (bỏ qua bước lọc Short):', err);
    }
  }
  return keep;
}

/**
 * Lấy danh sách video trong 1 playlist YouTube (tối đa 50 video / trang, lấy 1 trang đầu).
 * ĐÃ TỰ LỌC BỎ Shorts — xem giải thích ở SHORT_MAX_SECONDS phía trên.
 */
export async function fetchPlaylistItems(playlistId: string): Promise<YtPlaylistItem[]> {
  const key = getApiKey();
  if (!key) {
    console.warn('[Ytube] Thiếu VITE_YOUTUBE_API_KEY — không thể tải danh sách video thật.');
    return [];
  }
  const url = `${API_BASE}/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(
    playlistId
  )}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[Ytube] Lỗi gọi YouTube API (playlistItems):', await res.text());
    return [];
  }
  const data = await res.json();
  const items: YtPlaylistItem[] = (data.items ?? [])
    .map((item: any) => ({
      videoId: item.snippet?.resourceId?.videoId ?? '',
      title: item.snippet?.title ?? 'Không có tiêu đề',
      thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
      position: item.snippet?.position ?? 0,
    }))
    // Video ĐÃ BỊ XOÁ hẳn thì YouTube trả về mà KHÔNG kèm id — bỏ luôn (dòng cũ).
    // Video bị chuyển sang RIÊNG TƯ (hoặc đã xoá nhưng vẫn còn id) thì YouTube VẪN trả về
    // đúng videoId, chỉ đổi tiêu đề thành đúng 2 chuỗi cố định "Private video"/"Deleted
    // video" (không kèm ảnh) — đây chính là lỗ hổng khiến các video/playlist riêng tư vẫn
    // lọt vào danh sách của bé (hiện ra thành thẻ trống, không xem được). Lọc luôn theo
    // đúng 2 chuỗi này (YouTube trả về tiếng Anh, không đổi theo ngôn ngữ trình duyệt).
    .filter(
      (it: YtPlaylistItem) => it.videoId.length > 0 && it.title !== 'Private video' && it.title !== 'Deleted video'
    );

  if (items.length === 0) return items;
  const keep = await filterOutShorts(
    items.map((it) => it.videoId),
    key
  );
  const kept = items.filter((it) => keep.has(it.videoId));
  const removed = items.length - kept.length;
  if (removed > 0) console.info(`[Ytube] Đã lọc bỏ ${removed} video ngắn (Shorts) khỏi playlist.`);
  return kept;
}

/** Lấy thông tin cơ bản 1 playlist (tiêu đề, ảnh, số video). */
export async function fetchPlaylistInfo(playlistId: string): Promise<YtPlaylistInfo | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `${API_BASE}/playlists?part=snippet,contentDetails&id=${encodeURIComponent(
    playlistId
  )}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    playlistId,
    title: item.snippet?.title ?? 'Playlist',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
    itemCount: item.contentDetails?.itemCount ?? 0,
  };
}

/** Lấy tên + ảnh đại diện của 1 kênh YouTube từ channelId thật (UC...). */
export async function fetchChannelInfo(
  channelId: string
): Promise<{ title: string; thumbnail: string | null } | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `${API_BASE}/channels?part=snippet&id=${encodeURIComponent(channelId)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    title: item.snippet?.title ?? 'Kênh YouTube',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
  };
}

/**
 * Đổi @handle của 1 kênh (VD: @tenkenh) sang channelId thật (UC...), dùng tham số
 * "forHandle" của YouTube Data API v3 — không cần đổi thủ công qua trang ngoài nữa.
 */
export async function resolveChannelHandle(
  handle: string
): Promise<{ channelId: string; title: string; thumbnail: string | null } | null> {
  const key = getApiKey();
  if (!key) return null;
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const url = `${API_BASE}/channels?part=snippet&forHandle=${encodeURIComponent(cleanHandle)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[Ytube] Lỗi gọi YouTube API (forHandle):', await res.text());
    return null;
  }
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    channelId: item.id,
    title: item.snippet?.title ?? 'Kênh YouTube',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
  };
}

/**
 * Từ 1 kênh YouTube, lấy danh sách các playlist công khai của kênh đó.
 * Bỏ qua luôn các playlist do chính chủ kênh đặt tên là "Shorts" (rất nhiều kênh gom
 * video ngắn vào 1 playlist riêng như vậy) — chặn ngay từ vòng ngoài, khỏi phải vào
 * trong mới lọc từng video.
 */
export async function fetchChannelPlaylists(channelId: string): Promise<YtPlaylistInfo[]> {
  const key = getApiKey();
  if (!key) return [];
  const url = `${API_BASE}/playlists?part=snippet,contentDetails&maxResults=50&channelId=${encodeURIComponent(
    channelId
  )}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? [])
    .map((item: any) => ({
      playlistId: item.id,
      title: item.snippet?.title ?? 'Playlist',
      thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
      itemCount: item.contentDetails?.itemCount ?? 0,
    }))
    .filter((pl: YtPlaylistInfo) => !/\bshorts?\b/i.test(pl.title));
}

/** Lấy tiêu đề + ảnh của 1 video đơn lẻ (dùng cho loại nguồn "youtube_video"). */
export async function fetchVideoInfo(
  videoId: string
): Promise<{ title: string; thumbnail: string | null } | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `${API_BASE}/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    title: item.snippet?.title ?? 'Video',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
  };
}

/** Ghép URL nhúng an toàn: không rel, không modestbranding không cookie theo dõi. */
export function buildSafeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
