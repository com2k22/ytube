import { Compass } from 'lucide-react';

/**
 * MobileDiscoverPage — tab "Khám phá" trong thanh menu điện thoại.
 *
 * Bản đầy đủ (tìm/lọc theo nhãn trong ĐÚNG whitelist đã duyệt — KHÔNG bao giờ cho tìm kiếm
 * YouTube ngoài whitelist, xem UI_SPEC.md mục 4/11) sẽ dùng lại đúng phần logic "danh sách
 * nội dung xem được + nhãn" hiện đang nằm trong HomePage.tsx — cần tách phần đó thành 1 hook
 * dùng chung TRƯỚC (giống usePlayerEngine đã tách cho trình phát), để trang này và Trang chủ
 * điện thoại (đang làm ở bước kế tiếp) không tính lọc/gán nhãn 2 lần theo 2 cách khác nhau.
 * Placeholder này CHỈ để tab không im lặng nhảy về Trang chủ — không có dữ liệu giả nào ở đây.
 */
export function MobileDiscoverPage() {
  return (
    <main className="main mobile-empty-page">
      <div className="mobile-empty-state">
        <Compass size={40} className="mobile-empty-icon" aria-hidden="true" />
        <div className="mobile-empty-title">Khám phá đang được hoàn thiện</div>
        <p className="mobile-empty-text">
          Sắp tới đây sẽ là nơi tìm và lọc lại đúng những nội dung bố mẹ đã cho phép — chưa có gì để hiện lúc này.
        </p>
      </div>
    </main>
  );
}
