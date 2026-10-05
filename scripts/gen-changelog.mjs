// Tạo CHANGELOG.md từ src/changelog.json  →  chạy: npm run changelog
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../src/changelog.json', import.meta.url), 'utf8'));
const TYPE = { new: '✨ Tính năng mới', change: '🔧 Chỉnh sửa', fix: '🐞 Sửa lỗi', system: '⚙️ Hệ thống' };
const SCOPE = { driver: 'Tài xế', manager: 'Quản lý', all: 'Cả hai' };
const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

let out = '# Nhật ký cập nhật FleetOps\n\n_File này được tạo tự động từ `src/changelog.json` (chạy `npm run changelog`). Cùng nội dung hiển thị trong app: trang Quản lý → tab 📝 Cập nhật._\n';
for (const day of data) {
  const d = new Date(`${day.date}T00:00:00`);
  out += `\n## ${day.date.split('-').reverse().join('/')} (${WEEKDAY[d.getDay()]})\n`;
  for (const type of Object.keys(TYPE)) {
    const items = day.items.filter(i => i.type === type);
    if (!items.length) continue;
    out += `\n### ${TYPE[type]}\n\n`;
    for (const i of items) {
      out += `- **${i.title}** _(${SCOPE[i.scope]})_${i.detail ? ` — ${i.detail}` : ''}${i.commit ? ` \`${i.commit}\`` : ''}\n`;
    }
  }
}
fs.writeFileSync(new URL('../CHANGELOG.md', import.meta.url), out);
console.log('Đã tạo CHANGELOG.md');
