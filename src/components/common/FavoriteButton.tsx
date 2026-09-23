import { Heart } from 'lucide-react';

interface Props {
  active: boolean;
  onToggle: () => void;
  /** Tên hiển thị của mục đang bấm tim — CHỈ để đọc rõ trong aria-label (VD "Bỏ thích Cô bé
      lọ lem"), không hiện ra chữ trên màn hình. */
  label: string;
}

/**
 * FavoriteButton — nút hình trái tim để BÉ tự đánh dấu "yêu thích" 1 playlist/video/kênh,
 * dùng CHUNG cho mọi nơi có thẻ nội dung trên điện thoại (Trang chủ, Khám phá) — xem
 * useFavorites.ts. LUÔN đặt bên trong 1 thẻ card khác vốn ĐÃ có onClick riêng (bấm vào card
 * = mở nội dung), nên bắt buộc `e.stopPropagation()` ở đây — thiếu dòng đó thì bấm tim sẽ vô
 * tình mở luôn cả video/playlist, không đúng ý "chỉ bấm tim thôi".
 *
 * Cố tình dựng bằng <button> RIÊNG (không lồng vào <button> cha) — nơi gọi phải dùng
 * <div role="button"> (không phải <button>) cho card cha để tránh lỗi HTML "button trong
 * button" (trình duyệt tự tách 1 trong 2 ra ngoài, bấm sẽ sai hẳn hành vi).
 */
export function FavoriteButton({ active, onToggle, label }: Props) {
  return (
    <button
      type="button"
      className={`favorite-heart-btn ${active ? 'favorite-heart-btn--active' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={active ? `Bỏ thích ${label}` : `Thích ${label}`}
    >
      <Heart size={15} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
