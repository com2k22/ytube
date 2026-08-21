import type { ButtonHTMLAttributes } from 'react';

type Variant = 'submit' | 'back' | 'addWindow' | 'stop' | 'tab';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  submit: 'submit-btn',
  back: 'back-btn',
  addWindow: 'add-window-btn',
  stop: 'stop-btn',
  tab: 'tab-btn',
};

/** Nút dùng chung — style theo theme tự động qua theme.css, chỉ cần chọn variant. */
export function Button({ variant = 'submit', active, className = '', ...rest }: Props) {
  const base = VARIANT_CLASS[variant];
  const activeClass = variant === 'tab' && active ? 'active' : '';
  return <button className={`${base} ${activeClass} ${className}`.trim()} {...rest} />;
}
