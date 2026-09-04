import { useState } from 'react';
import { KeyRound, Save, X } from 'lucide-react';
import { useParentalPin } from '@/hooks/useParentalPin';
import { useToast } from '@/components/common/Toast';

const isFourDigits = (v: string) => /^\d{4}$/.test(v);

/** ChangePinCard — đổi mã PIN phụ huynh (yêu cầu nhập đúng PIN cũ trước). */
export function ChangePinCard() {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { changePin } = useParentalPin();
  const { showToast } = useToast();

  const submit = async () => {
    setError('');
    if (!isFourDigits(oldPin) || !isFourDigits(newPin) || !isFourDigits(confirmPin)) {
      setError('Mã PIN gồm đúng 4 chữ số.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('Mã PIN mới nhập lại không khớp.');
      return;
    }
    if (newPin === oldPin) {
      setError('Mã PIN mới cần khác mã PIN cũ.');
      return;
    }
    setSaving(true);
    const ok = await changePin(oldPin, newPin);
    setSaving(false);
    if (ok) {
      showToast('Đã đổi mã PIN thành công');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      setError('Mã PIN cũ không đúng — thử lại nhé.');
    }
  };

  return (
    <div className="settings-card" style={{ maxWidth: 420 }}>
      <h4><KeyRound className="icon icon-lead" aria-hidden="true" /> Đổi mã PIN phụ huynh</h4>
      <p style={{ fontSize: 12.5, opacity: 0.65, margin: '-6px 0 16px' }}>
        Cần nhập đúng mã PIN hiện tại trước khi đổi.
      </p>

      <div className="form-row">
        <label>Mã PIN hiện tại</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          data-region="ppin"
          tabIndex={0}
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
        />
      </div>
      <div className="form-row">
        <label>Mã PIN mới</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          data-region="ppin"
          tabIndex={0}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
        />
      </div>
      <div className="form-row">
        <label>Nhập lại mã PIN mới</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          data-region="ppin"
          tabIndex={0}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
        />
      </div>

      {error && (
        <div className="hint bad-text" style={{ height: 'auto', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
          <X className="icon icon-lead" aria-hidden="true" /> {error}
        </div>
      )}

      <button
        className="submit-btn"
        style={{ width: 'auto', padding: '12px 26px' }}
        data-region="ppin"
        tabIndex={0}
        disabled={saving}
        onClick={submit}
      >
        {saving ? (
          'Đang lưu...'
        ) : (
          <>
            <Save className="icon icon-lead" aria-hidden="true" /> Đổi mã PIN
          </>
        )}
      </button>
    </div>
  );
}
