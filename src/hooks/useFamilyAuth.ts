import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

/**
 * useFamilyAuth — thay cho mã PIN cũ: khu Bố mẹ giờ yêu cầu đăng nhập đúng tài khoản
 * Google của gia đình (xem supabase/011_family_auth.sql — phần GHI dữ liệu whitelist/
 * nhãn/giờ giấc giờ bắt buộc phải đăng nhập, phần ĐỌC thì bé vẫn xem bình thường không
 * cần đăng nhập gì cả).
 *
 * Đăng nhập 1 lần trên thiết bị nào thì thiết bị đó NHỚ LUÔN (Supabase tự lưu phiên đăng
 * nhập vào localStorage, kèm token tự làm mới) — không phải đăng nhập lại mỗi lần vào khu
 * Bố mẹ, đúng ý muốn "bỏ PIN, chỉ cần đăng nhập Google 1 lần cho mỗi TV/thiết bị".
 */
export function useFamilyAuth() {
  const [session, setSession] = useState<Session | null>(null);
  /** true = còn đang tra phiên đăng nhập đã lưu trước đó (mới mở app) — tránh nhấp nháy
      "chưa đăng nhập" trong lúc thật ra đã đăng nhập rồi, chỉ là chưa tra kịp. */
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * Mở màn hình đăng nhập Google của chính Google (chuyển hẳn khỏi app rồi quay lại sau
   * khi đăng nhập xong — không phải popup, để chắc ăn trên trình duyệt TV vốn hay chặn
   * popup). Nếu trình duyệt TV không cho đăng nhập trực tiếp kiểu này (Google chặn được
   * 1 số trình duyệt lạ), sẽ cần chuyển sang cách "hiện mã, đăng nhập bằng điện thoại" ở
   * bản sau — nhưng cứ thử cách đơn giản này trước.
   */
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/parent` },
    });

  /**
   * Cách dự phòng khi trình duyệt của TV chặn đăng nhập Google trực tiếp (lỗi thường gặp:
   * "disallowed_useragent" — Google cố tình chặn 1 số trình duyệt "lạ" như trình duyệt
   * webOS, không liên quan gì tới app này). Không cần cài đặt/thiết lập gì thêm bên
   * Supabase — 2 hàm dưới đây dùng thẳng tính năng "đăng nhập bằng mã gửi qua email" có
   * sẵn trong Supabase Auth:
   *   1) sendEmailCode(email) → Supabase gửi 1 email chứa mã 6 số tới địa chỉ đó.
   *   2) confirmEmailCode(email, code) → nhập đúng mã 6 số là đăng nhập xong, y hệt cách
   *      Google, thiết bị này cũng nhớ luôn cho lần sau.
   * An toàn kể cả khi để mở công khai: ai đó nhập thử 1 email lạ thì Supabase vẫn gửi mã
   * và đăng nhập được, nhưng RLS (xem 011_family_auth.sql, current_family_id()) chỉ nhận
   * đúng email trong bảng "families" — đăng nhập bằng email khác thì vào được app nhưng
   * KHÔNG sửa được whitelist/giờ giấc gì cả, nên không có gì phải lo.
   */
  const sendEmailCode = (email: string) =>
    supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });

  const confirmEmailCode = (email: string, code: string) =>
    supabase.auth.verifyOtp({ email, token: code, type: 'email' });

  const signOut = () => supabase.auth.signOut();

  return { session, loading, signInWithGoogle, sendEmailCode, confirmEmailCode, signOut };
}
