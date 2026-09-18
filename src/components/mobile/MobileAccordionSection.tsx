import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  /** Mở sẵn khi vào trang — chỉ nên dùng cho khối đầu tiên (theo UI_SPEC.md mục 3), các
      khối còn lại gập lại để trang không quá dài khi mới mở. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Khối gập/mở dùng riêng cho Khu vực Bố mẹ trên điện thoại (MobileParentDashboard.tsx) —
 * gộp 4 tab cũ (Thời gian/Nội dung/Hồ sơ bé/Tài khoản) thành 1 trang cuộn dọc mà không phải
 * cuộn qua 1 danh sách quá dài cùng lúc. Component thuần trình bày, không có logic riêng —
 * không đụng tới bất kỳ thẻ (card) nào đặt bên trong.
 */
export function MobileAccordionSection({ icon: Icon, title, defaultOpen, children }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div className={`mobile-accordion ${open ? 'mobile-accordion-open' : ''}`}>
      <button
        className="mobile-accordion-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="mobile-accordion-header-left">
          <Icon className="icon icon-lead" aria-hidden="true" />
          {title}
        </span>
        <ChevronDown className="mobile-accordion-chevron" aria-hidden="true" />
      </button>
      {open && <div className="mobile-accordion-body">{children}</div>}
    </div>
  );
}
