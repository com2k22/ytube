import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * useParentalPin — kiểm tra / đổi mã PIN phụ huynh thông qua 2 hàm RPC bảo mật trong
 * Supabase (verify_parent_pin, set_parent_pin). PIN thật KHÔNG bao giờ được gửi về
 * client hay lưu ở localStorage — chỉ có kết quả đúng/sai.
 */
export function useParentalPin() {
  const [verifying, setVerifying] = useState(false);

  const verifyPin = async (pin: string): Promise<boolean> => {
    setVerifying(true);
    const { data, error } = await supabase.rpc('verify_parent_pin', { input_pin: pin });
    setVerifying(false);
    if (error) {
      console.error('[Ytube] Lỗi kiểm tra PIN:', error.message);
      return false;
    }
    return Boolean(data);
  };

  const changePin = async (oldPin: string, newPin: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('set_parent_pin', { old_pin: oldPin, new_pin: newPin });
    if (error) {
      console.error('[Ytube] Lỗi đổi PIN:', error.message);
      return false;
    }
    return Boolean(data);
  };

  return { verifyPin, changePin, verifying };
}
