// AI đọc ảnh hóa đơn / lịch sử sạc điện (Claude vision). File bắt đầu bằng "_" nên Vercel không coi là endpoint.
export const DEFAULT_STATION = 'Sạc tại kho M12';

const PROMPT = `Bạn đọc ảnh hóa đơn / màn hình lịch sử sạc xe điện của tài xế (tiếng Việt). Ảnh 1 là "Hóa đơn / lịch sử sạc"; nếu có ảnh 2 là ảnh chụp màn hình sau khi sạc.
Chỉ trả về MỘT đối tượng JSON, không giải thích, đúng dạng:
{"readable": true|false, "station": string|null, "amount_vnd": number|null, "kwh": number|null, "datetime": string|null, "invoice_no": string|null}
Quy tắc:
- readable = true chỉ khi ảnh thật sự là hóa đơn / biên lai / màn hình lịch sử sạc đọc rõ được (có tên trạm, số tiền hoặc điện năng). Ảnh mờ, tối, không phải hóa đơn (ảnh xe, taplo, ảnh trống…) thì readable = false và các trường còn lại = null.
- station: tên trạm / đơn vị cung cấp dịch vụ sạc (vd. "VinFast V-GREEN", "EVN", "Trạm sạc Petrolimex …") kèm địa chỉ ngắn nếu có. Không đoán; không thấy thì null.
- amount_vnd: tổng thanh toán, số nguyên đồng (không dấu chấm/phẩy). kwh: điện năng đã sạc (số thập phân dùng dấu chấm).
- datetime: ngày giờ ghi trên hóa đơn, nguyên văn. invoice_no: số hóa đơn / mã giao dịch nếu có.`;

/** Lấy JSON từ câu trả lời của mô hình (có thể bọc trong ```). */
export function parseAiJson(text) {
  const m = String(text ?? '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI không trả về JSON');
  return JSON.parse(m[0]);
}

// Tiền đồng là số nguyên: bỏ mọi dấu chấm/phẩy ngăn cách ('214.000' → 214000)
const money = v => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v) : null) : (String(v ?? '').replace(/\D/g, '') ? Number(String(v).replace(/\D/g, '')) : null));
const num = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return v == null || v === '' || !Number.isFinite(n) ? null : n; };

/** Chuyển kết quả AI thành dòng lưu DB. Không đọc được hóa đơn → mặc định "Sạc tại kho M12". */
export function toRecord(ai, model) {
  const readable = ai?.readable === true;
  const station = readable && typeof ai.station === 'string' && ai.station.trim() ? ai.station.trim() : null;
  return {
    status: readable ? 'ok' : 'unreadable',
    station: readable ? (station ?? '(hóa đơn không ghi tên trạm)') : DEFAULT_STATION,
    amount: readable ? money(ai.amount_vnd) : null,
    kwh: readable ? num(ai.kwh) : null,
    charged_at: readable ? (ai.datetime ? String(ai.datetime).slice(0, 80) : null) : null,
    invoice_no: readable ? (ai.invoice_no ? String(ai.invoice_no).slice(0, 80) : null) : null,
    raw: ai, model, error: null,
  };
}

/** Gọi Claude đọc 1–2 ảnh (Buffer, jpeg). doFetch để test. */
export async function readReceipt({ apiKey, model, images, base = 'https://api.anthropic.com', doFetch = fetch }) {
  const content = [];
  images.forEach((buf, i) => {
    content.push({ type: 'text', text: `Ảnh ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } });
  });
  content.push({ type: 'text', text: PROMPT });
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await doFetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 500, messages: [{ role: 'user', content }] }),
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 2) { await new Promise(s => setTimeout(s, 1500 * (attempt + 1))); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`AI lỗi ${r.status}: ${j?.error?.message ?? 'không rõ'}`.slice(0, 250));
    return parseAiJson((j.content ?? []).filter(c => c.type === 'text').map(c => c.text).join(''));
  }
  throw new Error('AI không phản hồi');
}
