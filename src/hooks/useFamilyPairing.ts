import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * useFamilyPairing — "Mã ghép TV" (xem supabase/014_pairing_codes.sql). Cho phép ghép 1 TV
 * mới vào gia đình mà KHÔNG cần đăng nhập Google/email ngay trên chính TV đó, và KHÔNG để
 * lại quyền vào Khu vực Bố mẹ trên TV đó (khác với cách đăng nhập trực tiếp trong
 * GoogleSignInGate — cách đó thì TV sẽ nhớ luôn phiên đăng nhập).
 *
 *   - createPairingCode(): gọi từ điện thoại/máy tính ĐÃ đăng nhập sẵn (khu Bố mẹ > Tài
 *     khoản) — tạo 1 mã số dùng 1 lần, hiệu lực 15 phút.
 *   - redeemPairingCode(mã): gọi từ TV mới (chưa đăng nhập gì) — đổi mã lấy family_id, để
 *     lưu thẳng vào thiết bị (xem src/lib/familyId.ts), không tạo phiên đăng nhập nào.
 */
export function useFamilyPairing() {
  const [creating, setCreating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const createPairingCode = async (): Promise<{ code: string | null; error: string | null }> => {
    setCreating(true);
    const { data, error } = await supabase.rpc('create_pairing_code');
    setCreating(false);
    if (error) return { code: null, error: error.message };
    return { code: data as string, error: null };
  };

  const redeemPairingCode = async (code: string): Promise<{ familyId: string | null; error: string | null }> => {
    setRedeeming(true);
    const { data, error } = await supabase.rpc('redeem_pairing_code', { p_code: code });
    setRedeeming(false);
    if (error) return { familyId: null, error: error.message };
    if (!data) return { familyId: null, error: 'Mã sai hoặc đã hết hạn.' };
    return { familyId: data as string, error: null };
  };

  return { creating, redeeming, createPairingCode, redeemPairingCode };
}
