// Bộ lọc nhập số cho điện thoại (bàn phím Việt Nam hay gõ dấu phẩy thập phân)
export const onlyDigits = (s: string) => s.replace(/\D/g, '');

/** Số thập phân: cho phép gõ , hoặc . (chuẩn hóa thành .), tối đa 1 dấu thập phân */
export const cleanDecimal = (s: string) => {
  const t = s.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const i = t.indexOf('.');
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
};

/** 214000 -> "214,000" (hiển thị trong ô nhập tiền) */
export const fmtThousands = (digits: string) => (digits ? Number(digits).toLocaleString('en-US') : '');

export const clampPercent = (digits: string) => (digits === '' ? '' : String(Math.min(100, Number(digits))));
