// Dựng nội dung tin + gửi qua Telegram Bot API. (File bắt đầu bằng "_" nên Vercel không coi là một endpoint.)

const apiBase = () => process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';

/** 29H-102.34 -> 29H10234 (mẫu BKS không có dấu) */
export const plateText = p => String(p ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();

/** ISO -> "12h35" theo giờ Việt Nam */
export function vnTime(iso) {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).formatToParts(new Date(iso));
  const get = t => parts.find(p => p.type === t).value;
  return `${get('hour')}h${get('minute')}`;
}

/** 21.5 -> "21,5" (dấu phẩy thập phân như mẫu) */
export const num = n => String(Number(n)).replace('.', ',');

export const PHOTO_ORDER = {
  checkin: ['taplo', 'front', 'back', 'left', 'right'],
  checkout: ['taplo', 'front', 'back', 'left', 'right'],
  refuel_electric: ['before', 'after', 'receipt'],
  refuel_fuel: ['before', 'after', 'pump', 'receipt'],
};

/**
 * Nội dung tin theo mẫu của GHN.
 * ctx: { name, plate, energyType, trip?, refuel? }
 */
export function buildMessage(event, ctx) {
  const { name, plate, energyType, trip, refuel } = ctx;
  const bks = plateText(plate);
  const level = energyType === 'electric' ? 'PHẦN TRĂM PIN' : 'MỨC NHIÊN LIỆU';

  if (event === 'checkin') {
    return [`HỌ TÊN: ${name}`, `- BKS: ${bks}`, `- ĐỒNG HỒ ODO: ${trip.start_odo}`, `- ${level}: ${trip.start_level}%`, `- VÀO CA: ${vnTime(trip.start_time)}`].join('\n');
  }
  if (event === 'checkout') {
    return [`HỌ TÊN: ${name}`, `- BKS: ${bks}`, `- ĐỒNG HỒ ODO: ${trip.end_odo}`, `- ${level}: ${trip.end_level}%`, `- KẾT THÚC CA: ${vnTime(trip.end_time)}`].join('\n');
  }
  if (event === 'refuel') {
    if (refuel.energy_type === 'electric') {
      return [
        `HỌ TÊN: ${name}`, `BKS: ${bks}`, `ĐỒNG HỒ ODO: ${refuel.odo_at_refuel}km`,
        `PIN TRƯỚC KHI SẠC: ${refuel.battery_before}%`, `PIN SAU KHI SẠC: ${refuel.battery_after}%`,
        `KWH: ${num(refuel.quantity)}`, `THỜI GIAN: ${refuel.charge_minutes}p`,
      ].join('\n');
    }
    return [
      `HỌ TÊN: ${name}`, `BKS: ${bks}`, `ĐỒNG HỒ ODO: ${refuel.odo_at_refuel}km`,
      `LOẠI NHIÊN LIỆU: ${refuel.fuel_type ?? ''}`, `SỐ LÍT: ${num(refuel.quantity)}`,
      ...(refuel.station ? [`TRẠM: ${refuel.station}`] : []),
    ].join('\n');
  }
  throw new Error(`Sự kiện không hỗ trợ: ${event}`);
}

const scrub = (msg, token) => String(msg ?? '').split(token).join('***');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(token, method, body, isForm) {
  const url = `${apiBase()}/bot${token}/${method}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res, json;
    try {
      res = await fetch(url, isForm ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      json = await res.json();
    } catch (e) { throw new Error(scrub(`Không kết nối được Telegram: ${e.message}`, token)); }
    if (json.ok) return json.result;
    const wait = json.parameters?.retry_after;
    if (json.error_code === 429 && wait && wait <= 5 && attempt === 0) { await sleep(wait * 1000 + 200); continue; }
    throw new Error(scrub(`Telegram: ${json.description ?? res.status}`, token));
  }
}

/** Gửi chữ (không ảnh) hoặc ảnh + chú thích (1 ảnh = sendPhoto, 2–10 ảnh = album). Trả về message_id đầu tiên. */
export async function sendToTelegram({ token, chatId, text, photos = [] }) {
  const pics = photos.slice(0, 10);
  if (!pics.length) return (await call(token, 'sendMessage', { chat_id: chatId, text })).message_id;

  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (pics.length === 1) {
    form.append('caption', text);
    form.append('photo', pics[0].blob, pics[0].name);
    return (await call(token, 'sendPhoto', form, true)).message_id;
  }
  form.append('media', JSON.stringify(pics.map((p, i) => ({ type: 'photo', media: `attach://${p.name}`, ...(i === 0 ? { caption: text } : {}) }))));
  pics.forEach(p => form.append(p.name, p.blob, p.name));
  const res = await call(token, 'sendMediaGroup', form, true);
  return res[0].message_id;
}

export const getBotInfo = token => call(token, 'getMe', {});
