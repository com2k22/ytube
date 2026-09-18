import { Download } from 'lucide-react';

/**
 * MobileDownloadsPage — tab "Đã tải" trong thanh menu điện thoại.
 *
 * CỐ Ý là 1 trạng thái rỗng THẬT, không phải danh sách giả: app hiện chưa có hạ tầng tải
 * video YouTube về máy (mọi video đều phát trực tiếp qua YouTube IFrame API/link trực tiếp,
 * không lưu file nào cả). Làm giả 1 danh sách "đã tải" (hay các tab lọc Truyện/Nhạc/Học tập
 * cho 1 danh sách rỗng) ở đây sẽ đánh lừa bố mẹ/bé tưởng có thể xem offline thật — không được
 * phép theo yêu cầu gốc (không hard-code/giả dữ liệu) lẫn theo UI_SPEC.md mục 8 ("Show only
 * genuinely supported offline content. Do not fake YouTube downloads."). Có thêm dòng tiêu đề
 * ở đầu trang cho ĐỒNG BỘ bố cục với Trang chủ/Khám phá (đều có 1 dòng tiêu đề riêng), chỉ là
 * chỉnh trang trình bày — không thêm bất kỳ dữ liệu/chức năng giả nào. Giữ tab này trong menu
 * (đúng theo bản đặc tả) để dành chỗ cho sau này, nếu app có hỗ trợ tải nội dung trực tiếp
 * (mp4/HLS) thật sự.
 */
export function MobileDownloadsPage() {
  return (
    <main className="main mobile-downloads">
      <div className="mobile-page-title">Đã tải</div>
      <div className="mobile-empty-page">
        <div className="mobile-empty-state">
          <Download size={40} className="mobile-empty-icon" aria-hidden="true" />
          <div className="mobile-empty-title">Chưa có nội dung đã tải</div>
          <p className="mobile-empty-text">
            Ytube hiện phát trực tiếp từ YouTube, chưa hỗ trợ tải video về máy để xem khi không có mạng.
          </p>
        </div>
      </div>
    </main>
  );
}
