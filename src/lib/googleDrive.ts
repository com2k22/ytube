// Phát nội dung (video/audio) lưu trên Google Drive — quy ước: MỖI nội dung nằm trong 1
// THƯ MỤC Drive RIÊNG, gồm đúng 1 file media (video hoặc audio) + có thể thêm 1 file ảnh
// làm ảnh bìa (không bắt buộc). Phụ huynh dán link chia sẻ CỦA THƯ MỤC ĐÓ vào form Thêm nội
// dung (AddSourceForm.tsx, loại "Thư mục Google Drive") — hàm resolveDriveFolder() bên dưới
// tự tìm file media + ảnh bìa bên trong, dựng sẵn link phát được để lưu vào whitelist.
//
// ĐIỀU KIỆN BẮT BUỘC: thư mục đó (và file bên trong) phải để chế độ chia sẻ "Bất kỳ ai có
// đường liên kết" (Anyone with the link) — dùng API key (không đăng nhập) thì CHỈ đọc được
// nội dung công khai kiểu này. Muốn giữ riêng tư thật sự thì phải làm thêm luồng đăng nhập
// Google xin quyền Drive riêng, phức tạp hơn nhiều nên chưa làm ở đây.
//
// VÌ SAO dùng endpoint "alt=media" của Drive API v3 (KHÔNG dùng link xem trước /preview):
// link /preview là 1 khung <iframe> riêng của Google (giống hệt khung nhúng YouTube) — khác
// nguồn nên không gắn được Media Session API vào, mất luôn khả năng có nút điều khiển ở màn
// hình khoá / khả năng chạy nền khi khoá máy. Endpoint "alt=media" trả về ĐÚNG BYTE của file,
// dùng thẳng làm `src` cho thẻ <video> y hệt 1 link mp4 bình thường (xem DirectVideoPlayer.tsx)
// — nhờ vậy được thừa hưởng TOÀN BỘ hạ tầng Media Session/nghe-nền đã có sẵn cho "Link trực
// tiếp", không cần sửa gì trong chính trình phát.
//
// Cần biến môi trường VITE_GOOGLE_DRIVE_API_KEY (xem .env.example) — có thể dùng CHUNG giá
// trị với VITE_YOUTUBE_API_KEY nếu bật thêm "Google Drive API" cho đúng project Google Cloud
// đang dùng cho YouTube, không bắt buộc phải tạo project/key mới.

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

function getApiKey(): string | null {
  const key = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}

/**
 * Tách folderId từ các dạng link chia sẻ thư mục Drive hay gặp:
 *   https://drive.google.com/drive/folders/FOLDER_ID
 *   https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 *   https://drive.google.com/drive/u/0/folders/FOLDER_ID   (đăng nhập nhiều tài khoản)
 *   https://drive.google.com/open?id=FOLDER_ID             (link cũ)
 */
export function extractDriveFolderId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.includes('drive.google.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('folders');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    const idParam = u.searchParams.get('id');
    if (idParam) return idParam;
  } catch {
    return null;
  }
  return null;
}

/** true = link này TRÔNG GIỐNG 1 link chia sẻ thư mục Drive (chưa chắc thư mục có tồn tại/
    chia sẻ đúng hay không — chỉ kiểm tra được thật khi gọi resolveDriveFolder). Dùng để tự
    hiện đúng nút/gợi ý trong AddSourceForm.tsx. */
export function looksLikeDriveFolderUrl(rawUrl: string): boolean {
  return extractDriveFolderId(rawUrl) !== null;
}

export interface DriveFolderResolveResult {
  /** Tên thư mục trên Drive — dùng làm tiêu đề hiển thị (theo đúng quy ước "đặt tên thư mục
      theo tên nội dung" mà gia đình đang áp dụng). */
  title: string;
  /** Link phát trực tiếp file media tìm thấy trong thư mục (đã gồm sẵn API key) — gán thẳng
      vào cột "url" của allowed_sources, dùng y hệt 1 "Link trực tiếp" bình thường. */
  url: string;
  /** Link ảnh bìa (đã gồm sẵn API key) nếu thư mục có file ảnh — null nếu không có, nơi gọi
      tự dùng ảnh mặc định. */
  thumbnail: string | null;
}

/**
 * resolveFolderContents — phần lõi dùng chung: lấy tên 1 THƯ MỤC (đã biết sẵn folderId) làm
 * tiêu đề, tìm file media (video/audio) đầu tiên để phát, và file ảnh đầu tiên (nếu có) để làm
 * ảnh bìa. Cả resolveDriveFolder (dò 1 thư mục lẻ) lẫn resolveDriveParentFolder (quét hàng loạt
 * các thư mục con bên trong 1 thư mục tổng) đều gọi lại đúng hàm này cho từng thư mục — tránh
 * viết trùng 2 lần cùng 1 logic tìm file.
 */
async function resolveFolderContents(folderId: string, key: string): Promise<DriveFolderResolveResult | null> {
  const folderRes = await fetch(`${DRIVE_API_BASE}/files/${folderId}?fields=name&key=${key}`);
  if (!folderRes.ok) return null;
  const folderData = (await folderRes.json()) as { name?: string };
  const title = folderData.name?.trim() || 'Nội dung Google Drive';

  const query = `'${folderId}' in parents and trashed = false`;
  const listRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name,mimeType)')}&pageSize=100&key=${key}`
  );
  if (!listRes.ok) return null;
  const listData = (await listRes.json()) as { files?: { id: string; name: string; mimeType: string }[] };
  const files = listData.files ?? [];

  // Ưu tiên file video trước audio nếu thư mục lỡ có cả 2 (hiếm gặp với đúng quy ước 1
  // thư mục = 1 nội dung, nhưng vẫn cần 1 quy tắc rõ ràng thay vì lấy tuỳ ý file đầu tiên).
  const mediaFile =
    files.find((f) => f.mimeType.startsWith('video/')) ?? files.find((f) => f.mimeType.startsWith('audio/'));
  if (!mediaFile) return null;
  const coverFile = files.find((f) => f.mimeType.startsWith('image/'));

  return {
    title,
    url: `${DRIVE_API_BASE}/files/${mediaFile.id}?alt=media&key=${key}`,
    thumbnail: coverFile ? `${DRIVE_API_BASE}/files/${coverFile.id}?alt=media&key=${key}` : null,
  };
}

/**
 * resolveDriveFolder — dò 1 thư mục Drive lẻ (xem resolveFolderContents ở trên để biết chi
 * tiết cách tìm file). Chỉ gọi lúc phụ huynh bấm "Dò thông tin" khi THÊM/SỬA nội dung
 * (AddSourceForm.tsx) — KHÔNG gọi lại mỗi lần bé mở app, nên nếu sau này đổi file bên trong
 * thư mục thì phải vào sửa lại nội dung đó (bấm dò lại) chứ không tự động cập nhật. Đánh đổi
 * này giúp lúc phát không cần gọi thêm API nào cả (y hệt "Link trực tiếp" bình thường), đơn
 * giản và ít điểm hỏng hơn hẳn so với dò lại mỗi lần phát.
 *
 * Trả về null khi: thiếu API key, link không nhận diện được, thư mục không tồn tại/không chia
 * sẻ công khai, hoặc thư mục không có file video/audio nào — nơi gọi tự hiện thông báo phù hợp
 * (giống hệt cách youtube.ts xử lý khi thiếu key/gọi lỗi, không throw để khỏi crash cả form).
 */
export async function resolveDriveFolder(folderUrl: string): Promise<DriveFolderResolveResult | null> {
  const key = getApiKey();
  const folderId = extractDriveFolderId(folderUrl);
  if (!key) {
    console.warn('[Ytube] Thiếu VITE_GOOGLE_DRIVE_API_KEY — không dò được thư mục Google Drive.');
    return null;
  }
  if (!folderId) return null;

  try {
    return await resolveFolderContents(folderId, key);
  } catch (err) {
    console.error('[Ytube] Lỗi khi dò thư mục Google Drive:', err);
    return null;
  }
}

/** 1 thư mục con quét được bên trong 1 "thư mục tổng" — dùng để xem trước danh sách trước khi
    lưu hàng loạt (xem resolveDriveParentFolder bên dưới). */
export interface DriveSubfolderScanItem {
  /** id thật của thư mục con trên Drive — chỉ dùng làm key hiển thị, KHÔNG lưu vào cơ sở dữ liệu. */
  folderId: string;
  /** Tên thư mục con — cũng chính là tiêu đề sẽ lưu nếu chọn thêm thư mục con này. */
  folderName: string;
  /** null = thư mục con này KHÔNG tìm thấy file video/audio nào bên trong — nơi gọi tự bỏ
      chọn sẵn mục này, phụ huynh vẫn thấy tên để biết mà vào sửa lại thư mục đó trên Drive. */
  result: DriveFolderResolveResult | null;
}

/** Kết quả quét 1 "thư mục tổng" — dùng khi phụ huynh chọn nhập cả loạt thư mục con cùng lúc,
    và (tuỳ chọn) gộp chúng lại thành 1 Danh sách phát duy nhất (xem AddSourceForm.tsx). */
export interface DriveParentFolderScan {
  /** Tên thư mục tổng — dùng làm tiêu đề mặc định nếu gộp thành 1 Danh sách phát. */
  parentFolderName: string;
  /** Ảnh bìa nằm TRỰC TIẾP trong thư mục tổng (không phải trong thư mục con nào) — null nếu
      thư mục tổng không có sẵn ảnh nào; nơi gọi tự rơi về ảnh của thư mục con đầu tiên. */
  parentCoverThumbnail: string | null;
  items: DriveSubfolderScanItem[];
}

/**
 * resolveDriveParentFolder — quét 1 "THƯ MỤC TỔNG" (chứa nhiều thư mục con, MỖI thư mục con
 * là 1 nội dung riêng theo đúng quy ước ở resolveDriveFolder) để dò ra hàng loạt nội dung cùng
 * lúc, đỡ phải dán link từng thư mục con 1. CHỈ liệt kê các thư mục con NẰM TRỰC TIẾP trong
 * thư mục tổng (không đệ quy sâu hơn nữa) — đúng 1 cấp là đủ cho quy ước đang dùng. Nhân tiện
 * cùng 1 lượt gọi liệt kê này, cũng tìm luôn xem thư mục tổng có sẵn 1 ảnh nào KHÔNG NẰM TRONG
 * thư mục con nào không — dùng làm ảnh bìa chung nếu phụ huynh chọn gộp thành 1 Danh sách phát.
 *
 * Trả về:
 *  - null: thiếu API key, link không nhận diện được, hoặc lỗi gọi API (thư mục tổng không tồn
 *    tại/không chia sẻ công khai).
 *  - { items: [] }: thư mục tổng hợp lệ nhưng KHÔNG có thư mục con nào bên trong.
 *  - { items: [...] }: mỗi phần tử ứng với 1 thư mục con tìm thấy (kể cả những thư mục con
 *    KHÔNG có file media — result = null — để phụ huynh biết mà tự sửa, không âm thầm bỏ qua).
 */
export async function resolveDriveParentFolder(parentFolderUrl: string): Promise<DriveParentFolderScan | null> {
  const key = getApiKey();
  const parentId = extractDriveFolderId(parentFolderUrl);
  if (!key) {
    console.warn('[Ytube] Thiếu VITE_GOOGLE_DRIVE_API_KEY — không quét được thư mục tổng Google Drive.');
    return null;
  }
  if (!parentId) return null;

  try {
    const folderRes = await fetch(`${DRIVE_API_BASE}/files/${parentId}?fields=name&key=${key}`);
    if (!folderRes.ok) return null;
    const folderData = (await folderRes.json()) as { name?: string };
    const parentFolderName = folderData.name?.trim() || 'Danh sách phát Google Drive';

    // Liệt kê TOÀN BỘ (không lọc mimeType) những gì nằm trực tiếp trong thư mục tổng — vừa để
    // tìm thư mục con, vừa để tìm 1 ảnh bìa chung (nếu có) đặt ngay trong thư mục tổng.
    const query = `'${parentId}' in parents and trashed = false`;
    const listRes = await fetch(
      `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name,mimeType)')}&pageSize=200&key=${key}`
    );
    if (!listRes.ok) return null;
    const listData = (await listRes.json()) as { files?: { id: string; name: string; mimeType: string }[] };
    const children = listData.files ?? [];

    const subfolders = children.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
    const parentCoverFile = children.find((f) => f.mimeType.startsWith('image/'));
    const parentCoverThumbnail = parentCoverFile
      ? `${DRIVE_API_BASE}/files/${parentCoverFile.id}?alt=media&key=${key}`
      : null;

    if (subfolders.length === 0) {
      return { parentFolderName, parentCoverThumbnail, items: [] };
    }

    const items = await Promise.all(
      subfolders.map(async (f): Promise<DriveSubfolderScanItem> => ({
        folderId: f.id,
        folderName: f.name,
        result: await resolveFolderContents(f.id, key),
      }))
    );
    // Drive API không đảm bảo trả đúng thứ tự — sắp lại theo tên cho dễ dò trong danh sách xem trước.
    items.sort((a, b) => a.folderName.localeCompare(b.folderName, 'vi'));

    return { parentFolderName, parentCoverThumbnail, items };
  } catch (err) {
    console.error('[Ytube] Lỗi khi quét thư mục tổng Google Drive:', err);
    return null;
  }
}
