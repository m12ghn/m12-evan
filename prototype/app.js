/**
 * FLEETOPS - HỆ THỐNG KIỂM SOÁT VẬN HÀNH, ODO & NHIÊN LIỆU ĐỘI XE
 * Tối ưu quản lý trên 20 phương tiện
 */

// =========================================================
// STORAGE KEYS & CONSTANTS
// =========================================================
const STORAGE_KEYS = {
  VEHICLES: 'fleetops_vehicles_v1',
  DRIVERS:  'fleetops_drivers_v1',
  TRIPS:    'fleetops_trips_v1',
  REFUELS:  'fleetops_refuels_v1'
};

// =========================================================
// DEFAULT SEED DATA (22 VEHICLES & 12 DRIVERS)
// =========================================================
const INITIAL_VEHICLES = [
  { id: 'v1',  plate: '29H-102.34', type: 'Tải 1.5 Tấn - Kia K250',        tank: 60,  stdRate: 10.5, fuelType: 'Dầu Diesel (DO)', odo: 45200, fuelLevel: 75, status: 'on_duty',     driverId: 'd1' },
  { id: 'v2',  plate: '29C-543.21', type: 'Tải 2.4 Tấn - Isuzu QKR',       tank: 75,  stdRate: 11.8, fuelType: 'Dầu Diesel (DO)', odo: 68150, fuelLevel: 60, status: 'ready',       driverId: null },
  { id: 'v3',  plate: '51D-891.22', type: 'Tải 1.9 Tấn - Hyundai Mighty',  tank: 70,  stdRate: 11.2, fuelType: 'Dầu Diesel (DO)', odo: 52400, fuelLevel: 85, status: 'on_duty',     driverId: 'd2' },
  { id: 'v4',  plate: '60C-321.45', type: 'Tải 3.5 Tấn - Hino 300',        tank: 100, stdRate: 13.5, fuelType: 'Dầu Diesel (DO)', odo: 91200, fuelLevel: 45, status: 'ready',       driverId: null },
  { id: 'v5',  plate: '50H-778.99', type: 'Tải 5.0 Tấn - Hino 500',        tank: 140, stdRate: 16.5, fuelType: 'Dầu Diesel (DO)', odo: 114500, fuelLevel: 50, status: 'ready',      driverId: null },
  { id: 'v6',  plate: '29H-445.67', type: 'Van 950kg - Ford Transit Cargo', tank: 80,  stdRate: 9.2,  fuelType: 'Dầu Diesel (DO)', odo: 38200, fuelLevel: 90, status: 'on_duty',     driverId: 'd3' },
  { id: 'v7',  plate: '30F-992.10', type: 'Bán Tải - Ford Ranger XLS',      tank: 80,  stdRate: 8.5,  fuelType: 'Dầu Diesel (DO)', odo: 29800, fuelLevel: 70, status: 'ready',       driverId: null },
  { id: 'v8',  plate: '15C-341.22', type: 'Tải 2.5 Tấn - Đô Thành IZ65',   tank: 75,  stdRate: 11.5, fuelType: 'Dầu Diesel (DO)', odo: 73400, fuelLevel: 30, status: 'maintenance', driverId: null },
  { id: 'v9',  plate: '43C-112.33', type: 'Tải 1.9 Tấn - Jac N200',        tank: 65,  stdRate: 10.8, fuelType: 'Dầu Diesel (DO)', odo: 48900, fuelLevel: 80, status: 'ready',       driverId: null },
  { id: 'v10', plate: '29H-882.14', type: 'Tải 2.5 Tấn - Hyundai 110S',    tank: 100, stdRate: 12.5, fuelType: 'Dầu Diesel (DO)', odo: 62100, fuelLevel: 65, status: 'on_duty',     driverId: 'd4' },
  { id: 'v11', plate: '51D-456.78', type: 'Van 950kg - Hyundai Solati',    tank: 75,  stdRate: 9.8,  fuelType: 'Dầu Diesel (DO)', odo: 34100, fuelLevel: 95, status: 'ready',       driverId: null },
  { id: 'v12', plate: '60C-987.65', type: 'Tải 5.0 Tấn - Isuzu NQR 550',   tank: 120, stdRate: 15.0, fuelType: 'Dầu Diesel (DO)', odo: 103200, fuelLevel: 55, status: 'ready',      driverId: null },
  { id: 'v13', plate: '50H-123.90', type: 'Tải 1.4 Tấn - Suzuki Pro',      tank: 45,  stdRate: 7.5,  fuelType: 'Xăng RON 95',    odo: 21300, fuelLevel: 80, status: 'ready',       driverId: null },
  { id: 'v14', plate: '29C-776.54', type: 'Tải 3.5 Tấn - Fuso Canter',     tank: 90,  stdRate: 13.0, fuelType: 'Dầu Diesel (DO)', odo: 84600, fuelLevel: 40, status: 'ready',       driverId: null },
  { id: 'v15', plate: '30E-665.43', type: 'Bán Tải - Toyota Hilux 2.4',    tank: 80,  stdRate: 8.8,  fuelType: 'Dầu Diesel (DO)', odo: 41200, fuelLevel: 75, status: 'ready',       driverId: null },
  { id: 'v16', plate: '14C-234.56', type: 'Tải 2.5 Tấn - Thaco Ollin',     tank: 80,  stdRate: 12.0, fuelType: 'Dầu Diesel (DO)', odo: 77900, fuelLevel: 50, status: 'ready',       driverId: null },
  { id: 'v17', plate: '47C-889.12', type: 'Tải 8.0 Tấn - Hino FG8J',       tank: 200, stdRate: 19.5, fuelType: 'Dầu Diesel (DO)', odo: 158300, fuelLevel: 35, status: 'maintenance', driverId: null },
  { id: 'v18', plate: '29H-332.11', type: 'Van 500kg - Suzuki Blind Van',  tank: 35,  stdRate: 6.8,  fuelType: 'Xăng RON 95',    odo: 18400, fuelLevel: 90, status: 'ready',       driverId: null },
  { id: 'v19', plate: '51C-776.88', type: 'Tải 1.9 Tấn - Isuzu NMR',       tank: 70,  stdRate: 11.0, fuelType: 'Dầu Diesel (DO)', odo: 56700, fuelLevel: 65, status: 'ready',       driverId: null },
  { id: 'v20', plate: '60B-554.32', type: 'Xe Đưa Đón 16 Chỗ Transit',    tank: 80,  stdRate: 9.5,  fuelType: 'Dầu Diesel (DO)', odo: 64200, fuelLevel: 70, status: 'ready',       driverId: null },
  { id: 'v21', plate: '29D-667.89', type: 'Van 950kg - Gaz Gazelle Next',  tank: 80,  stdRate: 10.2, fuelType: 'Dầu Diesel (DO)', odo: 27900, fuelLevel: 85, status: 'ready',       driverId: null },
  { id: 'v22', plate: '30H-119.45', type: 'Tải 2.5 Tấn - Hyundai HD65',    tank: 90,  stdRate: 12.2, fuelType: 'Dầu Diesel (DO)', odo: 69400, fuelLevel: 60, status: 'ready',       driverId: null }
];

const INITIAL_DRIVERS = [
  { id: 'd1',  name: 'Nguyễn Văn Hùng',  phone: '0912.345.678', license: 'Hạng C' },
  { id: 'd2',  name: 'Trần Đình Trọng',  phone: '0983.456.789', license: 'Hạng C' },
  { id: 'd3',  name: 'Lê Hoàng Nam',     phone: '0975.223.344', license: 'Hạng B2' },
  { id: 'd4',  name: 'Phạm Quốc Bảo',    phone: '0904.556.778', license: 'Hạng C' },
  { id: 'd5',  name: 'Vũ Đức Thắng',     phone: '0936.889.911', license: 'Hạng C' },
  { id: 'd6',  name: 'Hoàng Minh Tuấn',  phone: '0918.776.554', license: 'Hạng D' },
  { id: 'd7',  name: 'Đỗ Tuấn Anh',      phone: '0922.334.455', license: 'Hạng B2' },
  { id: 'd8',  name: 'Bùi Quang Khải',   phone: '0945.667.889', license: 'Hạng FC' },
  { id: 'd9',  name: 'Ngô Thành Long',   phone: '0968.112.233', license: 'Hạng C' },
  { id: 'd10', name: 'Đinh Công Minh',   phone: '0977.889.900', license: 'Hạng C' }
];

// Helper to generate visual SVG placeholder photos (Vehicle sides & taplo)
function makeSampleSvgImg(label, color = '#1E293B') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="${color}"/>
    <rect x="20" y="20" width="560" height="360" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="6,6" opacity="0.3"/>
    <circle cx="300" cy="180" r="60" fill="#334155" opacity="0.8"/>
    <text x="300" y="190" font-family="Arial" font-size="40" fill="#94A3B8" text-anchor="middle">📷</text>
    <text x="300" y="270" font-family="Arial" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${label}</text>
    <text x="300" y="300" font-family="Arial" font-size="13" fill="#38BDF8" text-anchor="middle">FLEETOPS INSPECTION VERIFIED</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const INITIAL_TRIPS = [
  {
    id: 't-sample-1',
    vehicleId: 'v1',
    vehiclePlate: '29H-102.34',
    driverId: 'd1',
    driverName: 'Nguyễn Văn Hùng',
    status: 'on_duty',
    startTime: '2026-09-23T07:15:00',
    endTime: null,
    startOdo: 45050,
    endOdo: null,
    startFuel: 80,
    endFuel: null,
    kmDriven: 0,
    fuelConsumed: 0,
    fuelRate: null,
    preNotes: 'Xe sạch, cản trước hơi trầy nhẹ có sẵn',
    postNotes: '',
    hasDamage: false,
    damageNotes: '',
    photosStart: {
      taplo: makeSampleSvgImg('TAPLO ĐẦU CA - ODO 45.050 KM', '#0F172A'),
      front: makeSampleSvgImg('ĐẦU XE ĐẦU CA - 29H-102.34', '#1E293B'),
      back:  makeSampleSvgImg('ĐUÔI XE ĐẦU CA - 29H-102.34', '#1E293B'),
      left:  makeSampleSvgImg('SƯỜN TRÁI ĐẦU CA', '#1E293B'),
      right: makeSampleSvgImg('SƯỜN PHẢI ĐẦU CA', '#1E293B')
    },
    photosEnd: null
  },
  {
    id: 't-sample-2',
    vehicleId: 'v3',
    vehiclePlate: '51D-891.22',
    driverId: 'd2',
    driverName: 'Trần Đình Trọng',
    status: 'on_duty',
    startTime: '2026-09-23T06:30:00',
    endTime: null,
    startOdo: 52180,
    endOdo: null,
    startFuel: 85,
    endFuel: null,
    kmDriven: 0,
    fuelConsumed: 0,
    fuelRate: null,
    preNotes: 'Xe kiểm tra an toàn bình thường',
    postNotes: '',
    hasDamage: false,
    damageNotes: '',
    photosStart: {
      taplo: makeSampleSvgImg('TAPLO ĐẦU CA - ODO 52.180 KM', '#0F172A'),
      front: makeSampleSvgImg('ĐẦU XE - 51D-891.22', '#1E293B'),
      back:  makeSampleSvgImg('ĐUÔI XE - 51D-891.22', '#1E293B'),
      left:  makeSampleSvgImg('SƯỜN TRÁI XE', '#1E293B'),
      right: makeSampleSvgImg('SƯỜN PHẢI XE', '#1E293B')
    },
    photosEnd: null
  },
  {
    id: 't-sample-3',
    vehicleId: 'v2',
    vehiclePlate: '29C-543.21',
    driverId: 'd5',
    driverName: 'Vũ Đức Thắng',
    status: 'completed',
    startTime: '2026-09-22T07:00:00',
    endTime: '2026-09-22T17:30:00',
    startOdo: 67900,
    endOdo: 68150,
    startFuel: 90,
    endFuel: 55,
    kmDriven: 250,
    fuelConsumed: 26.25,
    fuelRate: 10.5,
    preNotes: 'Xe sẵn sàng',
    postNotes: 'Đã rửa xe trước khi về bãi',
    hasDamage: false,
    damageNotes: '',
    photosStart: {
      taplo: makeSampleSvgImg('TAPLO NHẬN XE - ODO 67.900 KM', '#0F172A'),
      front: makeSampleSvgImg('ĐẦU XE LÚC NHẬN - 29C-543.21', '#1E293B'),
      back:  makeSampleSvgImg('ĐUÔI XE LÚC NHẬN - 29C-543.21', '#1E293B'),
      left:  makeSampleSvgImg('SƯỜN TRÁI LÚC NHẬN', '#1E293B'),
      right: makeSampleSvgImg('SƯỜN PHẢI LÚC NHẬN', '#1E293B')
    },
    photosEnd: {
      taplo: makeSampleSvgImg('TAPLO TRẢ XE - ODO 68.150 KM', '#0B132B'),
      front: makeSampleSvgImg('ĐẦU XE LÚC TRẢ - NGUYÊN VẸN', '#164E63'),
      back:  makeSampleSvgImg('ĐUÔI XE LÚC TRẢ - NGUYÊN VẸN', '#164E63'),
      left:  makeSampleSvgImg('SƯỜN TRÁI LÚC TRẢ - NGUYÊN VẸN', '#164E63'),
      right: makeSampleSvgImg('SƯỜN PHẢI LÚC TRẢ - NGUYÊN VẸN', '#164E63')
    }
  },
  {
    id: 't-sample-4',
    vehicleId: 'v8',
    vehiclePlate: '15C-341.22',
    driverId: 'd6',
    driverName: 'Hoàng Minh Tuấn',
    status: 'completed',
    startTime: '2026-09-21T08:00:00',
    endTime: '2026-09-21T18:45:00',
    startOdo: 73120,
    endOdo: 73400,
    startFuel: 70,
    endFuel: 30,
    kmDriven: 280,
    fuelConsumed: 30.0,
    fuelRate: 10.7,
    preNotes: 'Xe ổn định',
    postNotes: 'Lốp sau phụ bị dính đinh, đã vá tạm',
    hasDamage: true,
    damageNotes: 'Gương chiếu hậu bên phụ va quẹt nhẹ vào cành cây gây trầy ốp nhựa, lốp sau phụ dính đinh cần thay.',
    photosStart: {
      taplo: makeSampleSvgImg('TAPLO NHẬN XE - ODO 73.120 KM', '#0F172A'),
      front: makeSampleSvgImg('ĐẦU XE LÚC NHẬN - 15C-341.22', '#1E293B'),
      back:  makeSampleSvgImg('ĐUÔI XE LÚC NHẬN - 15C-341.22', '#1E293B'),
      left:  makeSampleSvgImg('SƯỜN TRÁI LÚC NHẬN', '#1E293B'),
      right: makeSampleSvgImg('SƯỜN PHẢI LÚC NHẬN', '#1E293B')
    },
    photosEnd: {
      taplo: makeSampleSvgImg('TAPLO TRẢ XE - ODO 73.400 KM', '#0B132B'),
      front: makeSampleSvgImg('ĐẦU XE LÚC TRẢ - 15C-341.22', '#7F1D1D'),
      back:  makeSampleSvgImg('ĐUÔI XE LÚC TRẢ - 15C-341.22', '#7F1D1D'),
      left:  makeSampleSvgImg('SƯỜN TRÁI LÚC TRẢ', '#7F1D1D'),
      right: makeSampleSvgImg('SƯỜN PHẢI - TRẦY ỐP GƯƠNG', '#991B1B')
    }
  }
];

const INITIAL_REFUELS = [
  {
    id: 'rf-1',
    tripId: 't-sample-1',
    ticketCode: 'FL-2026-001',
    createdAt: '2026-09-23T10:45:00',
    vehiclePlate: '29H-102.34',
    driverName: 'Nguyễn Văn Hùng',
    fuelType: 'Dầu Diesel (DO 0.05S)',
    odoAtRefuel: 45140,
    liters: 35.0,
    unitPrice: 21500,
    totalAmount: 752500,
    gasStation: 'Petrolimex Cửa Hàng 34, Quốc Lộ 1A',
    photoPump: makeSampleSvgImg('ĐỒNG HỒ CỘT BƠM: 35.0 LÍT - 752.500 Đ', '#0F172A'),
    photoReceipt: makeSampleSvgImg('HÓA ĐƠN VAT XĂNG DẦU SỐ 0098412', '#1E293B'),
    status: 'pending', // pending | approved | rejected
    managerNote: ''
  },
  {
    id: 'rf-2',
    tripId: 't-sample-2',
    ticketCode: 'FL-2026-002',
    createdAt: '2026-09-23T11:20:00',
    vehiclePlate: '51D-891.22',
    driverName: 'Trần Đình Trọng',
    fuelType: 'Dầu Diesel (DO 0.05S)',
    odoAtRefuel: 52310,
    liters: 40.0,
    unitPrice: 21500,
    totalAmount: 860000,
    gasStation: 'PVOIL Trạm Thu Phí Long Phước',
    photoPump: makeSampleSvgImg('ĐỒNG HỒ BƠM: 40.0 LÍT - 860.000 Đ', '#0F172A'),
    photoReceipt: makeSampleSvgImg('PHIẾU THU XĂNG DẦU SỐ 011452', '#1E293B'),
    status: 'pending',
    managerNote: ''
  },
  {
    id: 'rf-3',
    tripId: 't-sample-3',
    ticketCode: 'FL-2026-003',
    createdAt: '2026-09-22T13:10:00',
    vehiclePlate: '29C-543.21',
    driverName: 'Vũ Đức Thắng',
    fuelType: 'Dầu Diesel (DO 0.05S)',
    odoAtRefuel: 68020,
    liters: 30.0,
    unitPrice: 21200,
    totalAmount: 636000,
    gasStation: 'Petrolimex Km 15 Pháp Vân',
    photoPump: makeSampleSvgImg('ĐỒNG HỒ CỘT BƠM: 30.0 LÍT', '#0F172A'),
    photoReceipt: makeSampleSvgImg('HÓA ĐƠN ĐIỆN TỬ PETROLIMEX', '#1E293B'),
    status: 'approved',
    managerNote: 'Đã đối soát khớp chỉ số ODO và hóa đơn'
  }
];

// =========================================================
// APPLICATION STATE
// =========================================================
let vehicles = [];
let drivers  = [];
let trips    = [];
let refuels  = [];

let activeDriverId = null;
let currentActiveTrip = null; // trip object if active driver has ongoing trip
let checkinDraft = {
  vehicleId: null,
  photos: { taplo: null, front: null, back: null, left: null, right: null }
};
let checkoutDraft = {
  photos: { taplo: null, front: null, back: null, left: null, right: null }
};

let currentCompareTrip = null;
let currentCompareAngle = 'front';
let currentApproveFuelTicket = null;
let currentFleetFilter = 'all';

// =========================================================
// INITIALIZATION
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initDriverSelectOptions();
  initVehicleSelectOptions();
  updatePendingBadges();
  renderFleetGrid();
  renderTripsTable();
  renderFuelTable();
  renderSettingsTables();
  updateAdminKpiBar();
});

function loadData() {
  vehicles = getStorage(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
  drivers  = getStorage(STORAGE_KEYS.DRIVERS,  INITIAL_DRIVERS);
  trips    = getStorage(STORAGE_KEYS.TRIPS,    INITIAL_TRIPS);
  refuels  = getStorage(STORAGE_KEYS.REFUELS,  INITIAL_REFUELS);
}

function saveData(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    showToast('⚠️ Bộ nhớ cục bộ bị đầy, hãy giải phóng ảnh cũ!', 'warning');
  }
}

function getStorage(key, defaultVal) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

// =========================================================
// MODE SWITCHER (DRIVER vs FLEET MANAGER)
// =========================================================
function switchMode(mode) {
  const btnDriver = document.getElementById('btnModeDriver');
  const btnAdmin  = document.getElementById('btnModeAdmin');
  const viewDriver = document.getElementById('portal-driver');
  const viewAdmin  = document.getElementById('portal-admin');

  if (mode === 'driver') {
    btnDriver.classList.add('active');
    btnAdmin.classList.remove('active');
    viewDriver.classList.add('active');
    viewAdmin.classList.remove('active');
  } else {
    btnAdmin.classList.add('active');
    btnDriver.classList.remove('active');
    viewAdmin.classList.add('active');
    viewDriver.classList.remove('active');
    // Refresh admin dashboard tables & counts
    updateAdminKpiBar();
    renderFleetGrid();
    renderTripsTable();
    renderFuelTable();
    updatePendingBadges();
  }
}

// =========================================================
// DRIVER PORTAL LOGIC
// =========================================================

function initDriverSelectOptions() {
  const select = document.getElementById('driverSelectInput');
  select.innerHTML = '<option value="">-- Chọn tên tài xế của bạn --</option>';
  drivers.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.license} - ${d.phone})`;
    select.appendChild(opt);
  });
}

function initVehicleSelectOptions() {
  const select = document.getElementById('vehicleSelectInput');
  select.innerHTML = '<option value="">-- Chọn xe bàn giao (Biển số) --</option>';
  
  // Available vehicles in yard or ready
  const availableVehicles = vehicles.filter(v => v.status === 'ready');
  availableVehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.plate} • ${v.type} (ODO: ${v.odo.toLocaleString()} km - Xăng: ${v.fuelLevel}%)`;
    select.appendChild(opt);
  });

  if (availableVehicles.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '⚠️ Hiện không có xe nào tại bãi đang sẵn sàng';
    opt.disabled = true;
    select.appendChild(opt);
  }
}

function onDriverSelected() {
  const driverId = document.getElementById('driverSelectInput').value;
  activeDriverId = driverId;

  const alertBox = document.getElementById('driverActiveTripAlert');
  const startBlock = document.getElementById('driverStartBlock');

  if (!driverId) {
    alertBox.style.display = 'none';
    startBlock.style.display = 'block';
    return;
  }

  // Check if this driver has an ongoing trip
  const ongoing = trips.find(t => t.driverId === driverId && t.status === 'on_duty');
  if (ongoing) {
    currentActiveTrip = ongoing;
    alertBox.style.display = 'flex';
    document.getElementById('driverActiveTripDesc').textContent = 
      `Xe: ${ongoing.vehiclePlate} | Bắt đầu: ${formatTime(ongoing.startTime)} | ODO Đầu: ${ongoing.startOdo.toLocaleString()} km`;
    startBlock.style.display = 'none';
  } else {
    currentActiveTrip = null;
    alertBox.style.display = 'none';
    startBlock.style.display = 'block';
    initVehicleSelectOptions();
  }
}

function continueDriverActiveTrip() {
  if (!currentActiveTrip) return;
  showDriverActiveTripDashboard(currentActiveTrip);
}

function onVehicleSelectedForTrip() {
  const vehId = document.getElementById('vehicleSelectInput').value;
  const btn = document.getElementById('btnProceedToCheckin');
  const info = document.getElementById('selectedVehicleInfo');

  if (!vehId) {
    btn.disabled = true;
    info.style.display = 'none';
    return;
  }

  const v = vehicles.find(x => x.id === vehId);
  if (v) {
    btn.disabled = false;
    info.style.display = 'block';
    info.innerHTML = `
      <b>${v.plate}</b> - ${v.type}<br>
      Dung tích bình: <b>${v.tank} Lít</b> • Định mức: <b>${v.stdRate} L/100km</b> • ODO hiện tại: <b>${v.odo.toLocaleString()} km</b>
    `;
  }
}

// CHECK-IN WIZARD STEP NAVIGATION
function startCheckinWizard() {
  const driverId = document.getElementById('driverSelectInput').value;
  const vehId    = document.getElementById('vehicleSelectInput').value;

  if (!driverId || !vehId) {
    showToast('Vui lòng chọn tài xế và phương tiện!', 'error');
    return;
  }

  const driver = drivers.find(d => d.id === driverId);
  const veh    = vehicles.find(v => v.id === vehId);

  checkinDraft = {
    driverId: driver.id,
    driverName: driver.name,
    vehicleId: veh.id,
    vehiclePlate: veh.plate,
    vehicleType: veh.type,
    tank: veh.tank,
    stdRate: veh.stdRate,
    photos: { taplo: null, front: null, back: null, left: null, right: null }
  };

  // Populate wizard fields
  document.getElementById('checkinVehiclePlateBadge').textContent = veh.plate;
  document.getElementById('checkinOdo').value = veh.odo;
  document.getElementById('hintPrevOdoVal').textContent = veh.odo.toLocaleString();
  document.getElementById('checkinFuel').value = veh.fuelLevel;
  updateFuelRangeText('checkinFuel', 'checkinFuelVal');
  updateCheckinFuelLitersEst();

  // Reset photos in UI
  resetPhotoSlot('boxPhotoTaploStart', 'placeholderTaploStart', 'previewPhotoTaploStart');
  resetSlotPreview('slotPhotoFrontStart', 'previewPhotoFrontStart');
  resetSlotPreview('slotPhotoBackStart', 'previewPhotoBackStart');
  resetSlotPreview('slotPhotoLeftStart', 'previewPhotoLeftStart');
  resetSlotPreview('slotPhotoRightStart', 'previewPhotoRightStart');

  document.getElementById('checkinPreExistingDamage').value = '';
  document.getElementById('ciAgreeCheckbox').checked = false;
  document.getElementById('btnSubmitCheckin').disabled = true;

  // Switch screens
  showDriverScreen('driver-screen-checkin');
  goToCiSubstep(1);
  validateCheckinSubstep1();
}

function updateCheckinFuelLitersEst() {
  const fuelPercent = parseInt(document.getElementById('checkinFuel').value, 10);
  const veh = vehicles.find(v => v.id === checkinDraft.vehicleId);
  const tank = veh ? veh.tank : 70;
  const liters = Math.round((fuelPercent / 100) * tank);
  document.getElementById('checkinFuelLitersEst').textContent = liters;
}

function backToDriverLogin() {
  showDriverScreen('driver-screen-login');
  onDriverSelected();
}

function showDriverScreen(screenId) {
  document.querySelectorAll('.driver-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToCiSubstep(stepNumber) {
  document.querySelectorAll('#driver-screen-checkin .wizard-substep').forEach(s => s.classList.remove('active'));
  document.getElementById(`ci-substep-${stepNumber}`).classList.add('active');

  // Update step progress bar
  document.querySelectorAll('#driver-screen-checkin .step-item').forEach((item, index) => {
    item.classList.remove('active', 'done');
    if (index + 1 === stepNumber) item.classList.add('active');
    else if (index + 1 < stepNumber) item.classList.add('done');
  });

  if (stepNumber === 3) {
    // Populate summary
    document.getElementById('ciSumDriverName').textContent = checkinDraft.driverName;
    document.getElementById('ciSumPlate').textContent = checkinDraft.vehiclePlate;
    document.getElementById('ciSumOdo').textContent = parseInt(document.getElementById('checkinOdo').value, 10).toLocaleString() + ' km';
    document.getElementById('ciSumFuel').textContent = document.getElementById('checkinFuel').value + ' %';
    
    const notes = document.getElementById('checkinPreExistingDamage').value.trim();
    const noteRow = document.getElementById('ciSumNoteRow');
    if (notes) {
      noteRow.style.display = 'flex';
      document.getElementById('ciSumNote').textContent = notes;
    } else {
      noteRow.style.display = 'none';
    }
  }
}

function validateCheckinSubstep1() {
  const odo = document.getElementById('checkinOdo').value;
  const hasTaploPhoto = !!checkinDraft.photos.taplo;
  const isValid = odo && parseInt(odo, 10) > 0 && hasTaploPhoto;
  document.getElementById('btnCiToStep2').disabled = !isValid;
  updateCheckinFuelLitersEst();
}

function validateCheckinSubstep2() {
  const p = checkinDraft.photos;
  const hasAll4 = p.front && p.back && p.left && p.right;
  document.getElementById('btnCiToStep3').disabled = !hasAll4;
}

function toggleBtnSubmitCheckin() {
  const agreed = document.getElementById('ciAgreeCheckbox').checked;
  document.getElementById('btnSubmitCheckin').disabled = !agreed;
}

function submitCheckinTrip() {
  const startOdo = parseInt(document.getElementById('checkinOdo').value, 10);
  const startFuel = parseInt(document.getElementById('checkinFuel').value, 10);
  const preNotes = document.getElementById('checkinPreExistingDamage').value.trim();

  const newTrip = {
    id: 'trip-' + Date.now(),
    vehicleId: checkinDraft.vehicleId,
    vehiclePlate: checkinDraft.vehiclePlate,
    driverId: checkinDraft.driverId,
    driverName: checkinDraft.driverName,
    status: 'on_duty',
    startTime: new Date().toISOString(),
    endTime: null,
    startOdo: startOdo,
    endOdo: null,
    startFuel: startFuel,
    endFuel: null,
    kmDriven: 0,
    fuelConsumed: 0,
    fuelRate: null,
    preNotes: preNotes,
    postNotes: '',
    hasDamage: false,
    damageNotes: '',
    photosStart: { ...checkinDraft.photos },
    photosEnd: null
  };

  // Add to trips
  trips.unshift(newTrip);
  saveData(STORAGE_KEYS.TRIPS, trips);

  // Update vehicle status in fleet
  const veh = vehicles.find(v => v.id === checkinDraft.vehicleId);
  if (veh) {
    veh.status = 'on_duty';
    veh.driverId = checkinDraft.driverId;
    veh.odo = startOdo;
    veh.fuelLevel = startFuel;
    saveData(STORAGE_KEYS.VEHICLES, vehicles);
  }

  currentActiveTrip = newTrip;
  showToast('✓ Đã tạo ca vận hành & bàn giao xe thành công!', 'success');
  showDriverActiveTripDashboard(newTrip);
}

// ACTIVE TRIP IN-FLIGHT DASHBOARD
function showDriverActiveTripDashboard(trip) {
  showDriverScreen('driver-screen-active-trip');

  document.getElementById('activeTripPlate').textContent = trip.vehiclePlate;
  const veh = vehicles.find(v => v.id === trip.vehicleId);
  document.getElementById('activeTripVehicleDesc').textContent = veh ? veh.type : 'Xe vận tải';

  document.getElementById('activeTripStartOdo').textContent = trip.startOdo.toLocaleString() + ' km';
  document.getElementById('activeTripStartFuel').textContent = trip.startFuel + '%';
  document.getElementById('activeTripStartTime').textContent = formatTime(trip.startTime);

  renderActiveTripFuelList(trip.id);
}

function renderActiveTripFuelList(tripId) {
  const tripRefuels = refuels.filter(r => r.tripId === tripId);
  const container = document.getElementById('activeTripFuelList');
  const countBadge = document.getElementById('activeTripFuelCount');

  countBadge.textContent = `${tripRefuels.length} lần`;

  if (tripRefuels.length === 0) {
    container.innerHTML = '<div class="empty-mini">Chưa có lần đổ nhiên liệu nào trong ca này</div>';
    return;
  }

  container.innerHTML = tripRefuels.map(r => `
    <div class="fuel-item-pill">
      <div>
        <span class="f-liters">⛽ ${r.liters} Lít (${r.fuelType})</span>
        <div style="font-size:11px; color:#64748B;">ODO: ${r.odoAtRefuel.toLocaleString()} km • ${formatMoney(r.totalAmount)}</div>
      </div>
      <span class="f-status ${r.status}">
        ${r.status === 'pending' ? '⏳ Chờ duyệt' : r.status === 'approved' ? '✓ Đã duyệt' : '❌ Từ chối'}
      </span>
    </div>
  `).join('');
}

// CHECK-OUT (RETURN VEHICLE) WIZARD
function startCheckoutWizard() {
  if (!currentActiveTrip) return;

  const trip = currentActiveTrip;
  const veh = vehicles.find(v => v.id === trip.vehicleId);

  checkoutDraft = {
    tripId: trip.id,
    vehicleId: trip.vehicleId,
    tank: veh ? veh.tank : 70,
    stdRate: veh ? veh.stdRate : 11.5,
    photos: { taplo: null, front: null, back: null, left: null, right: null }
  };

  document.getElementById('coVehiclePlateBadge').textContent = trip.vehiclePlate;
  document.getElementById('coMinOdoVal').textContent = trip.startOdo.toLocaleString();

  // Reset values
  document.getElementById('checkoutOdo').value = '';
  document.getElementById('coOdoError').style.display = 'none';
  document.getElementById('checkoutFuel').value = Math.max(10, trip.startFuel - 20);
  updateFuelRangeText('checkoutFuel', 'checkoutFuelVal');
  updateCheckoutFuelLitersEst();

  // Reset photos
  resetPhotoSlot('boxPhotoTaploEnd', 'placeholderTaploEnd', 'previewPhotoTaploEnd');
  resetSlotPreview('slotPhotoFrontEnd', 'previewPhotoFrontEnd');
  resetSlotPreview('slotPhotoBackEnd', 'previewPhotoBackEnd');
  resetSlotPreview('slotPhotoLeftEnd', 'previewPhotoLeftEnd');
  resetSlotPreview('slotPhotoRightEnd', 'previewPhotoRightEnd');

  document.querySelector('input[name="vehicleConditionAfter"][value="good"]').checked = true;
  toggleDamageDetailsBox();
  document.getElementById('checkoutDamageNote').value = '';

  showDriverScreen('driver-screen-checkout');
  goToCoSubstep(1);
  validateCheckoutSubstep1();
}

function backToActiveTripDashboard() {
  showDriverActiveTripDashboard(currentActiveTrip);
}

function updateCheckoutFuelLitersEst() {
  const fuelPercent = parseInt(document.getElementById('checkoutFuel').value, 10);
  const tank = checkoutDraft.tank || 70;
  const liters = Math.round((fuelPercent / 100) * tank);
  document.getElementById('checkoutFuelLitersEst').textContent = liters;
}

function calculateTripCheckoutStats() {
  if (!currentActiveTrip) return;
  const startOdo = currentActiveTrip.startOdo;
  const endOdoVal = document.getElementById('checkoutOdo').value;
  const startFuel = currentActiveTrip.startFuel;
  const endFuel = parseInt(document.getElementById('checkoutFuel').value, 10);

  const tank = checkoutDraft.tank || 70;

  // Total refueled liters during trip
  const tripRefuels = refuels.filter(r => r.tripId === currentActiveTrip.id && r.status !== 'rejected');
  const totalRefueledLiters = tripRefuels.reduce((sum, r) => sum + (parseFloat(r.liters) || 0), 0);

  const errorDiv = document.getElementById('coOdoError');

  if (!endOdoVal) {
    document.getElementById('calcKmDriven').textContent = '0 km';
    document.getElementById('calcFuelConsumed').textContent = '0 Lít';
    document.getElementById('calcFuelRate').textContent = '-- L/100km';
    errorDiv.style.display = 'none';
    return;
  }

  const endOdo = parseInt(endOdoVal, 10);
  if (endOdo < startOdo) {
    errorDiv.style.display = 'block';
    document.getElementById('calcKmDriven').textContent = '⚠️ ODO Không hợp lệ';
    return;
  }

  errorDiv.style.display = 'none';
  const kmDriven = endOdo - startOdo;
  document.getElementById('calcKmDriven').textContent = kmDriven.toLocaleString() + ' km';

  // Fuel consumed = ((Start % - End %) * Tank) + Refueled Liters
  const fuelDeltaPercent = (startFuel - endFuel) / 100;
  const fuelConsumed = Math.max(0, (fuelDeltaPercent * tank) + totalRefueledLiters);
  document.getElementById('calcFuelConsumed').textContent = fuelConsumed.toFixed(1) + ' Lít';

  if (kmDriven > 0) {
    const rate = (fuelConsumed / kmDriven) * 100;
    document.getElementById('calcFuelRate').textContent = rate.toFixed(1) + ' L/100km';
  } else {
    document.getElementById('calcFuelRate').textContent = '-- L/100km';
  }
}

function validateCheckoutSubstep1() {
  if (!currentActiveTrip) return;
  const startOdo = currentActiveTrip.startOdo;
  const endOdoVal = document.getElementById('checkoutOdo').value;
  const hasPhoto = !!checkoutDraft.photos.taplo;

  const isValid = endOdoVal && parseInt(endOdoVal, 10) >= startOdo && hasPhoto;
  document.getElementById('btnCoToStep2').disabled = !isValid;
  updateCheckoutFuelLitersEst();
}

function validateCheckoutSubstep2() {
  const p = checkoutDraft.photos;
  const hasAll4 = p.front && p.back && p.left && p.right;
  document.getElementById('btnCoToStep3').disabled = !hasAll4;
}

function goToCoSubstep(stepNumber) {
  document.querySelectorAll('#driver-screen-checkout .wizard-substep').forEach(s => s.classList.remove('active'));
  document.getElementById(`co-substep-${stepNumber}`).classList.add('active');

  // Update step progress bar
  document.querySelectorAll('#driver-screen-checkout .step-item').forEach((item, index) => {
    item.classList.remove('active', 'done');
    if (index + 1 === stepNumber) item.classList.add('active');
    else if (index + 1 < stepNumber) item.classList.add('done');
  });

  if (stepNumber === 3) {
    const trip = currentActiveTrip;
    const endOdo = parseInt(document.getElementById('checkoutOdo').value, 10);
    const endFuel = parseInt(document.getElementById('checkoutFuel').value, 10);
    const km = endOdo - trip.startOdo;

    const tripRefuels = refuels.filter(r => r.tripId === trip.id && r.status !== 'rejected');
    const totalRefueledLiters = tripRefuels.reduce((sum, r) => sum + (parseFloat(r.liters) || 0), 0);
    const tank = checkoutDraft.tank || 70;
    const consumed = Math.max(0, (((trip.startFuel - endFuel) / 100) * tank) + totalRefueledLiters);
    const rate = km > 0 ? ((consumed / km) * 100).toFixed(1) : '--';

    document.getElementById('coSumStartOdo').textContent = trip.startOdo.toLocaleString() + ' km';
    document.getElementById('coSumStartFuel').textContent = trip.startFuel + ' %';
    document.getElementById('coSumEndOdo').textContent = endOdo.toLocaleString() + ' km';
    document.getElementById('coSumEndFuel').textContent = endFuel + ' %';
    document.getElementById('coSumTotalKm').textContent = km.toLocaleString() + ' km';
    document.getElementById('coSumRefueledLiters').textContent = totalRefueledLiters.toFixed(1) + ' L';
    document.getElementById('coSumFuelRate').textContent = rate + ' L/100km';

    const cond = document.querySelector('input[name="vehicleConditionAfter"]:checked').value;
    const badge = document.getElementById('coSumConditionBadge');
    const damageRow = document.getElementById('coSumDamageDetailRow');
    if (cond === 'good') {
      badge.textContent = '✅ Xe nguyên vẹn, không hư hao';
      badge.className = 'text-success font-bold';
      damageRow.style.display = 'none';
    } else {
      badge.textContent = '⚠️ Có sự cố / hư hao ghi nhận';
      badge.className = 'text-danger font-bold';
      damageRow.style.display = 'flex';
      document.getElementById('coSumDamageDetailText').textContent = document.getElementById('checkoutDamageNote').value || 'Chưa ghi chú';
    }
  }
}

function toggleDamageDetailsBox() {
  const cond = document.querySelector('input[name="vehicleConditionAfter"]:checked').value;
  const box = document.getElementById('damageDetailsBox');
  box.style.display = cond === 'damaged' ? 'block' : 'none';
}

function submitCheckoutTrip() {
  if (!currentActiveTrip) return;

  const endOdo = parseInt(document.getElementById('checkoutOdo').value, 10);
  const endFuel = parseInt(document.getElementById('checkoutFuel').value, 10);
  const hasDamage = document.querySelector('input[name="vehicleConditionAfter"]:checked').value === 'damaged';
  const damageNote = document.getElementById('checkoutDamageNote').value.trim();

  const trip = currentActiveTrip;
  const km = endOdo - trip.startOdo;

  const tripRefuels = refuels.filter(r => r.tripId === trip.id && r.status !== 'rejected');
  const totalRefueledLiters = tripRefuels.reduce((sum, r) => sum + (parseFloat(r.liters) || 0), 0);
  const tank = checkoutDraft.tank || 70;
  const consumed = Math.max(0, (((trip.startFuel - endFuel) / 100) * tank) + totalRefueledLiters);
  const rate = km > 0 ? parseFloat(((consumed / km) * 100).toFixed(1)) : 0;

  // Update trip record
  trip.status = 'completed';
  trip.endTime = new Date().toISOString();
  trip.endOdo = endOdo;
  trip.endFuel = endFuel;
  trip.kmDriven = km;
  trip.fuelConsumed = parseFloat(consumed.toFixed(1));
  trip.fuelRate = rate;
  trip.hasDamage = hasDamage;
  trip.damageNotes = damageNote;
  trip.photosEnd = { ...checkoutDraft.photos };

  saveData(STORAGE_KEYS.TRIPS, trips);

  // Update vehicle in fleet: status becomes 'ready' or 'maintenance' if damaged
  const veh = vehicles.find(v => v.id === trip.vehicleId);
  if (veh) {
    veh.status = hasDamage ? 'maintenance' : 'ready';
    veh.driverId = null;
    veh.odo = endOdo;
    veh.fuelLevel = endFuel;
    saveData(STORAGE_KEYS.VEHICLES, vehicles);
  }

  showToast('✓ Bàn giao & trả xe hoàn tất! Cảm ơn bạn đã hoàn thành ca an toàn.', 'success');
  currentActiveTrip = null;

  // Return to driver login screen
  backToDriverLogin();
}

// =========================================================
// MID-SHIFT FUEL REQUEST LOGIC
// =========================================================
let refuelDraftPhotos = { pump: null, receipt: null };

function openFuelRefillModal() {
  if (!currentActiveTrip) return;
  const trip = currentActiveTrip;

  document.getElementById('refuelModalSubtitle').textContent = 
    `Xe: ${trip.vehiclePlate} | Tài xế: ${trip.driverName}`;

  document.getElementById('refuelCurrentOdo').value = trip.startOdo;
  document.getElementById('refuelLiters').value = '';
  document.getElementById('refuelUnitPrice').value = '21500';
  document.getElementById('refuelTotalAmount').value = '';
  document.getElementById('refuelGasStationName').value = '';
  document.getElementById('refuelNote').value = '';

  refuelDraftPhotos = { pump: null, receipt: null };
  resetSlotPreview('slotPhotoPump', 'previewPhotoPump');
  resetSlotPreview('slotPhotoReceipt', 'previewPhotoReceipt');

  openModal('modalRefuel');
}

function calculateRefuelTotal() {
  const liters = parseFloat(document.getElementById('refuelLiters').value) || 0;
  const unitPrice = parseFloat(document.getElementById('refuelUnitPrice').value) || 0;
  const total = liters * unitPrice;
  document.getElementById('refuelTotalAmount').value = total > 0 ? total.toLocaleString('vi-VN') + ' đ' : '';
}

function submitRefuelRequest() {
  if (!currentActiveTrip) return;

  const liters = parseFloat(document.getElementById('refuelLiters').value);
  const odo = parseInt(document.getElementById('refuelCurrentOdo').value, 10);
  const fuelType = document.getElementById('refuelFuelType').value;
  const unitPrice = parseFloat(document.getElementById('refuelUnitPrice').value) || 0;
  const totalAmount = liters * unitPrice;
  const station = document.getElementById('refuelGasStationName').value.trim();
  const note = document.getElementById('refuelNote').value.trim();

  if (!liters || liters <= 0) {
    showToast('Vui lòng nhập số lít nhiên liệu hợp lệ!', 'error');
    return;
  }
  if (!odo || odo < currentActiveTrip.startOdo) {
    showToast('ODO lúc đổ không thể nhỏ hơn ODO đầu ca!', 'error');
    return;
  }
  if (!refuelDraftPhotos.pump || !refuelDraftPhotos.receipt) {
    showToast('Vui lòng chụp đủ 2 ảnh: Cột bơm và Hóa đơn xăng!', 'error');
    return;
  }

  const newTicket = {
    id: 'rf-' + Date.now(),
    tripId: currentActiveTrip.id,
    ticketCode: 'FL-2026-' + (refuels.length + 1).toString().padStart(3, '0'),
    createdAt: new Date().toISOString(),
    vehiclePlate: currentActiveTrip.vehiclePlate,
    driverName: currentActiveTrip.driverName,
    fuelType: fuelType,
    odoAtRefuel: odo,
    liters: liters,
    unitPrice: unitPrice,
    totalAmount: totalAmount,
    gasStation: station || 'Cửa hàng xăng dầu',
    photoPump: refuelDraftPhotos.pump,
    photoReceipt: refuelDraftPhotos.receipt,
    status: 'pending',
    managerNote: note
  };

  refuels.unshift(newTicket);
  saveData(STORAGE_KEYS.REFUELS, refuels);

  closeModal('modalRefuel');
  showToast('✓ Đã gửi phiếu cấp nhiên liệu! Đang chờ Quản lý duyệt.', 'success');
  renderActiveTripFuelList(currentActiveTrip.id);
  updatePendingBadges();
}

// =========================================================
// FLEET MANAGER (ADMIN DASHBOARD) LOGIC
// =========================================================

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

  if (tabName === 'fleet') {
    document.getElementById('tabBtnFleet').classList.add('active');
    document.getElementById('admin-tab-fleet').classList.add('active');
    renderFleetGrid();
  } else if (tabName === 'trips') {
    document.getElementById('tabBtnTrips').classList.add('active');
    document.getElementById('admin-tab-trips').classList.add('active');
    renderTripsTable();
  } else if (tabName === 'fuel') {
    document.getElementById('tabBtnFuel').classList.add('active');
    document.getElementById('admin-tab-fuel').classList.add('active');
    renderFuelTable();
  } else if (tabName === 'settings') {
    document.getElementById('tabBtnSettings').classList.add('active');
    document.getElementById('admin-tab-settings').classList.add('active');
    renderSettingsTables();
  }
}

function updateAdminKpiBar() {
  const totalVehicles = vehicles.length;
  const onDutyCount = vehicles.filter(v => v.status === 'on_duty').length;
  const readyCount = vehicles.filter(v => v.status === 'ready').length;
  const pendingFuelCount = refuels.filter(r => r.status === 'pending').length;

  // Total km run today across trips
  const totalKm = trips.reduce((sum, t) => sum + (t.kmDriven || 0), 0);

  document.getElementById('kpiTotalVehicles').textContent = totalVehicles;
  document.getElementById('kpiOnDutyVehicles').textContent = onDutyCount;
  document.getElementById('kpiAvailableVehicles').textContent = readyCount;
  document.getElementById('kpiPendingFuelApprovals').textContent = pendingFuelCount;
  document.getElementById('kpiTotalKmToday').textContent = totalKm.toLocaleString();

  // Filter pill counts
  document.getElementById('countFilterAll').textContent = totalVehicles;
  document.getElementById('countFilterOnDuty').textContent = onDutyCount;
  document.getElementById('countFilterReady').textContent = readyCount;
  document.getElementById('countFilterMaint').textContent = vehicles.filter(v => v.status === 'maintenance').length;
}

function updatePendingBadges() {
  const pendingCount = refuels.filter(r => r.status === 'pending').length;
  const badgeTop = document.getElementById('badgePendingFuel');
  const badgeTab = document.getElementById('tabFuelBadge');

  if (pendingCount > 0) {
    badgeTop.style.display = 'inline-block';
    badgeTop.textContent = pendingCount;
    badgeTab.style.display = 'inline-block';
    badgeTab.textContent = pendingCount;
  } else {
    badgeTop.style.display = 'none';
    badgeTab.style.display = 'none';
  }
}

// TAB 1: FLEET GRID (>20 VEHICLES)
function setFleetFilter(filter, el) {
  currentFleetFilter = filter;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  renderFleetGrid();
}

function renderFleetGrid() {
  const container = document.getElementById('fleetCardsContainer');
  const search = document.getElementById('fleetSearchInput').value.toLowerCase().trim();

  let list = vehicles.filter(v => {
    if (currentFleetFilter !== 'all' && v.status !== currentFleetFilter) return false;
    if (search) {
      const matchPlate = v.plate.toLowerCase().includes(search);
      const matchType = v.type.toLowerCase().includes(search);
      const driver = drivers.find(d => d.id === v.driverId);
      const matchDriver = driver ? driver.name.toLowerCase().includes(search) : false;
      return matchPlate || matchType || matchDriver;
    }
    return true;
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #fff; border-radius: 16px;">
        <span style="font-size: 36px;">🔍</span>
        <p style="font-weight: 700; margin-top: 10px;">Không tìm thấy phương tiện nào phù hợp</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(v => {
    const driver = drivers.find(d => d.id === v.driverId);
    const driverName = driver ? driver.name : 'Chưa gán tài xế';
    
    // Status text & class
    let statusText = 'Tại bãi (Sẵn sàng)';
    let statusClass = 'ready';
    if (v.status === 'on_duty') {
      statusText = '🟢 Đang vận hành';
      statusClass = 'on_duty';
    } else if (v.status === 'maintenance') {
      statusText = '🔧 Cần bảo dưỡng';
      statusClass = 'maintenance';
    }

    // Fuel level color
    let fillClass = 'fill-high';
    if (v.fuelLevel < 25) fillClass = 'fill-low';
    else if (v.fuelLevel < 50) fillClass = 'fill-med';

    return `
      <div class="v-card">
        <div>
          <div class="v-card-top">
            <div class="v-plate-block">
              <div class="v-icon">${v.type.includes('Van') ? '🚐' : v.type.includes('Bán Tải') ? '🛻' : '🚚'}</div>
              <div>
                <div class="v-plate">${v.plate}</div>
                <div class="v-type">${v.type}</div>
              </div>
            </div>
            <span class="v-status-badge ${statusClass}">${statusText}</span>
          </div>

          <div class="v-card-metrics">
            <div class="v-m-row">
              <span>Chỉ số ODO:</span>
              <strong class="font-mono">${v.odo.toLocaleString()} km</strong>
            </div>
            <div class="v-m-row">
              <span>Định mức chuẩn:</span>
              <strong>${v.stdRate} L/100km</strong>
            </div>
            <div class="v-fuel-bar-wrap">
              <div class="v-fuel-bar-label">
                <span>Nhiên liệu còn:</span>
                <b>${v.fuelLevel}% (~${Math.round((v.fuelLevel / 100) * v.tank)} L)</b>
              </div>
              <div class="v-fuel-bar-track">
                <div class="v-fuel-bar-fill ${fillClass}" style="width: ${v.fuelLevel}%;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="v-card-footer">
          <span class="v-driver-tag">Tài xế: <b>${driverName}</b></span>
          <button class="btn btn-outline btn-sm" onclick="filterTripsByPlate('${v.plate}')">Lịch sử ca →</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterTripsByPlate(plate) {
  switchAdminTab('trips');
  document.getElementById('tripSearchInput').value = plate;
  renderTripsTable();
}

// TAB 2: TRIPS LOG TABLE & PHOTO INSPECTOR
function renderTripsTable() {
  const tbody = document.getElementById('tripsTableBody');
  const search = document.getElementById('tripSearchInput').value.toLowerCase().trim();
  const statusFilter = document.getElementById('tripStatusFilter').value;

  let list = trips.filter(t => {
    if (statusFilter === 'active' && t.status !== 'on_duty') return false;
    if (statusFilter === 'completed' && t.status !== 'completed') return false;
    if (statusFilter === 'issue' && !t.hasDamage) return false;

    if (search) {
      const matchPlate = t.vehiclePlate.toLowerCase().includes(search);
      const matchDriver = t.driverName.toLowerCase().includes(search);
      return matchPlate || matchDriver;
    }
    return true;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px; color:#94A3B8;">Không có ca vận hành nào khớp điều kiện tìm kiếm</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => {
    const isOngoing = t.status === 'on_duty';
    const timeDisplay = `${formatDate(t.startTime)} • ${formatTime(t.startTime)}${t.endTime ? ' → ' + formatTime(t.endTime) : ' (Đang chạy)'}`;
    const odoDisplay = `${t.startOdo.toLocaleString()} → ${t.endOdo ? t.endOdo.toLocaleString() : '...'}`;
    const kmDisplay = isOngoing ? '<span class="badge-pending">Đang chạy</span>' : `<b>${t.kmDriven.toLocaleString()} km</b>`;
    
    // Check overconsumption
    const veh = vehicles.find(v => v.plate === t.vehiclePlate);
    const stdRate = veh ? veh.stdRate : 11.5;
    const isHighRate = t.fuelRate && t.fuelRate > (stdRate * 1.15);

    const fuelRateDisplay = isOngoing 
      ? '--' 
      : `<span class="font-mono ${isHighRate ? 'text-danger font-bold' : ''}">${t.fuelRate} L/100km</span>${isHighRate ? ' ⚠️' : ''}`;

    const conditionBadge = t.hasDamage
      ? `<span class="badge-tag" style="background:#FEE2E2; color:#B91C1C;">⚠️ Có va quẹt / hư hại</span>`
      : `<span class="badge-success">✅ Xe nguyên vẹn</span>`;

    return `
      <tr>
        <td><strong class="font-mono">${t.vehiclePlate}</strong></td>
        <td>${t.driverName}</td>
        <td style="font-size:12px; color:#64748B;">${timeDisplay}</td>
        <td class="font-mono">${odoDisplay}</td>
        <td>${kmDisplay}</td>
        <td>${t.startFuel}% → ${t.endFuel !== null ? t.endFuel + '%' : '...'} (${t.fuelConsumed} L)</td>
        <td>${fuelRateDisplay}</td>
        <td>${conditionBadge}</td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" onclick="openPhotoCompareModal('${t.id}')">
            🔍 Soi Ảnh Đối Soát
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// SIDE-BY-SIDE PHOTO INSPECTION MODAL
function openPhotoCompareModal(tripId) {
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return;

  currentCompareTrip = trip;
  currentCompareAngle = 'front';

  document.getElementById('compareModalTripInfo').textContent = 
    `Xe: ${trip.vehiclePlate} | Tài xế: ${trip.driverName} | Thời gian: ${formatDate(trip.startTime)} (${formatTime(trip.startTime)} → ${trip.endTime ? formatTime(trip.endTime) : 'Đang chạy'})`;

  // Trip stats summary
  document.getElementById('compStatKm').textContent = trip.kmDriven ? trip.kmDriven.toLocaleString() + ' km' : 'Đang chạy';
  document.getElementById('compStatStartOdo').textContent = trip.startOdo.toLocaleString() + ' km';
  document.getElementById('compStatEndOdo').textContent = trip.endOdo ? trip.endOdo.toLocaleString() + ' km' : 'Chưa chốt';
  document.getElementById('compStatFuel').textContent = trip.fuelConsumed ? trip.fuelConsumed + ' Lít' : '--';
  document.getElementById('compStatRate').textContent = trip.fuelRate ? trip.fuelRate + ' L/100km' : '--';

  // Damage declaration alert banner
  const damageBanner = document.getElementById('compareDamageBanner');
  if (trip.hasDamage && trip.damageNotes) {
    damageBanner.style.display = 'flex';
    document.getElementById('compareDamageDetailText').textContent = trip.damageNotes;
  } else {
    damageBanner.style.display = 'none';
  }

  updateCompareAngleView();
  openModal('modalComparePhotos');
}

function switchCompareAngle(angle) {
  currentCompareAngle = angle;
  document.querySelectorAll('.c-pill').forEach(btn => btn.classList.remove('active'));
  const btnId = 'pill' + angle.charAt(0).toUpperCase() + angle.slice(1);
  const activeBtn = document.getElementById(btnId);
  if (activeBtn) activeBtn.classList.add('active');
  updateCompareAngleView();
}

function updateCompareAngleView() {
  if (!currentCompareTrip) return;
  const trip = currentCompareTrip;
  const angle = currentCompareAngle;

  const imgBefore = document.getElementById('compareImgBefore');
  const imgAfter  = document.getElementById('compareImgAfter');
  const capBefore = document.getElementById('compareCaptionBefore');
  const capAfter  = document.getElementById('compareCaptionAfter');

  // Photo start
  const photoStart = trip.photosStart ? trip.photosStart[angle] : null;
  imgBefore.src = photoStart || makeSampleSvgImg('CHƯA CÓ ẢNH LÚC NHẬN', '#334155');
  capBefore.textContent = trip.preNotes ? `Ghi chú đầu ca: ${trip.preNotes}` : 'Tình trạng lúc nhận: Xe bình thường';

  // Photo end
  const photoEnd = trip.photosEnd ? trip.photosEnd[angle] : null;
  imgAfter.src = photoEnd || makeSampleSvgImg('CHƯA TRẢ XE HOẶC THIẾU ẢNH', '#334155');
  capAfter.textContent = trip.hasDamage 
    ? `⚠️ Có ghi nhận sự cố: ${trip.damageNotes || 'Xem chi tiết'}` 
    : 'Tình trạng lúc trả: Xe nguyên vẹn không trầy xước';
}

function printTripHandoverReport() {
  window.print();
}

// TAB 3: FUEL APPROVALS TABLE
function renderFuelTable() {
  const tbody = document.getElementById('fuelTableBody');
  const search = document.getElementById('fuelSearchInput').value.toLowerCase().trim();
  const filter = document.getElementById('fuelStatusFilter').value;

  let list = refuels.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const matchPlate = r.vehiclePlate.toLowerCase().includes(search);
      const matchDriver = r.driverName.toLowerCase().includes(search);
      const matchCode = r.ticketCode.toLowerCase().includes(search);
      return matchPlate || matchDriver || matchCode;
    }
    return true;
  });

  // Calculate total money approved
  const totalApproved = refuels
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  document.getElementById('fuelTotalMoneyApproved').textContent = formatMoney(totalApproved);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 30px; color:#94A3B8;">Không có phiếu đổ nhiên liệu nào khớp</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => {
    const isPending = r.status === 'pending';
    const statusTag = isPending
      ? `<span class="badge-pending" style="animation:none;">Chờ duyệt</span>`
      : r.status === 'approved'
      ? `<span class="badge-success">✓ Đã duyệt</span>`
      : `<span class="badge-tag" style="background:#FEE2E2; color:#B91C1C;">Từ chối</span>`;

    return `
      <tr>
        <td><strong class="font-mono">${r.ticketCode}</strong></td>
        <td style="font-size:12px; color:#64748B;">${formatDate(r.createdAt)} ${formatTime(r.createdAt)}</td>
        <td><b class="font-mono">${r.vehiclePlate}</b></td>
        <td>${r.driverName}</td>
        <td>${r.fuelType}</td>
        <td>
          <b class="text-accent">${r.liters} Lít</b><br>
          <span class="font-mono" style="font-size:12px; color:#059669;">${formatMoney(r.totalAmount)}</span>
        </td>
        <td class="font-mono">${r.odoAtRefuel ? r.odoAtRefuel.toLocaleString() + ' km' : '--'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openApproveFuelModal('${r.id}')">
            🧾 Xem Hóa Đơn & Bơm
          </button>
        </td>
        <td>${statusTag}</td>
        <td class="text-right">
          ${isPending ? `
            <button class="btn btn-success btn-sm" onclick="quickApproveFuel('${r.id}', true)">Duyệt</button>
            <button class="btn btn-danger btn-sm" onclick="quickApproveFuel('${r.id}', false)">Từ Chối</button>
          ` : `<small class="text-muted">Đã xử lý</small>`}
        </td>
      </tr>
    `;
  }).join('');
}

function openApproveFuelModal(refuelId) {
  const r = refuels.find(x => x.id === refuelId);
  if (!r) return;

  currentApproveFuelTicket = r;
  document.getElementById('approveModalTicketCode').textContent = `Mã phiếu: ${r.ticketCode} • Ngày tạo: ${formatDate(r.createdAt)} ${formatTime(r.createdAt)}`;

  document.getElementById('approveModalDetails').innerHTML = `
    <div class="summary-grid-2">
      <div>
        <p>Biển số xe: <b class="font-mono">${r.vehiclePlate}</b></p>
        <p>Tài xế: <b>${r.driverName}</b></p>
        <p>Cây xăng: <b>${r.gasStation}</b></p>
      </div>
      <div>
        <p>Nhiên liệu: <b>${r.fuelType}</b></p>
        <p>Số lượng: <b class="text-accent">${r.liters} Lít</b> (Đơn giá: ${formatMoney(r.unitPrice)}/L)</p>
        <p>Tổng tiền: <b class="text-success font-mono font-bold" style="font-size:16px;">${formatMoney(r.totalAmount)}</b></p>
        <p>Số ODO tại trạm: <b class="font-mono">${r.odoAtRefuel ? r.odoAtRefuel.toLocaleString() : '--'} km</b></p>
      </div>
    </div>
  `;

  document.getElementById('approveModalPhotos').innerHTML = `
    <div class="receipt-img-box">
      <img src="${r.photoPump || makeSampleSvgImg('CHƯA CÓ ẢNH CỘT BƠM')}" alt="Ảnh đồng hồ bơm" />
      <span>ẢNH ĐỒNG HỒ CỘT BƠM</span>
    </div>
    <div class="receipt-img-box">
      <img src="${r.photoReceipt || makeSampleSvgImg('CHƯA CÓ ẢNH HÓA ĐƠN')}" alt="Ảnh hóa đơn" />
      <span>ẢNH HÓA ĐƠN / PHIẾU XĂNG</span>
    </div>
  `;

  document.getElementById('approveManagerNote').value = r.managerNote || '';
  openModal('modalApproveFuel');
}

function confirmFuelApproval(isApproved) {
  if (!currentApproveFuelTicket) return;
  const note = document.getElementById('approveManagerNote').value.trim();

  currentApproveFuelTicket.status = isApproved ? 'approved' : 'rejected';
  currentApproveFuelTicket.managerNote = note || (isApproved ? 'Đã duyệt hợp lệ' : 'Từ chối');

  saveData(STORAGE_KEYS.REFUELS, refuels);
  closeModal('modalApproveFuel');

  showToast(isApproved ? '✓ Đã phê duyệt cấp nhiên liệu thành công!' : 'Đã từ chối phiếu!', isApproved ? 'success' : 'warning');
  renderFuelTable();
  updateAdminKpiBar();
  updatePendingBadges();
}

function quickApproveFuel(refuelId, isApproved) {
  const r = refuels.find(x => x.id === refuelId);
  if (!r) return;
  r.status = isApproved ? 'approved' : 'rejected';
  r.managerNote = isApproved ? 'Đã duyệt qua bảng điều khiển' : 'Từ chối';
  saveData(STORAGE_KEYS.REFUELS, refuels);

  showToast(isApproved ? `✓ Đã duyệt phiếu ${r.ticketCode}` : `Đã từ chối phiếu ${r.ticketCode}`, isApproved ? 'success' : 'warning');
  renderFuelTable();
  updateAdminKpiBar();
  updatePendingBadges();
}

// TAB 4: SETTINGS & VEHICLES / DRIVERS CRUD
function renderSettingsTables() {
  const vBody = document.getElementById('settingsVehiclesTableBody');
  vBody.innerHTML = vehicles.map(v => `
    <tr>
      <td><b class="font-mono">${v.plate}</b></td>
      <td>${v.type}</td>
      <td>${v.tank} L</td>
      <td>${v.stdRate} L/100km</td>
      <td class="font-mono">${v.odo.toLocaleString()} km</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="deleteVehicle('${v.id}')" title="Xóa xe">🗑️</button>
      </td>
    </tr>
  `).join('');

  const dBody = document.getElementById('settingsDriversTableBody');
  dBody.innerHTML = drivers.map(d => `
    <tr>
      <td><b class="font-mono">${d.id}</b></td>
      <td><strong>${d.name}</strong></td>
      <td>${d.phone}</td>
      <td><span class="badge-tag">${d.license}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="deleteDriver('${d.id}')" title="Xóa tài xế">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openAddVehicleModal() {
  document.getElementById('newVehPlate').value = '';
  document.getElementById('newVehType').value = '';
  document.getElementById('newVehTank').value = '70';
  document.getElementById('newVehRate').value = '11.5';
  document.getElementById('newVehOdo').value = '20000';
  openModal('modalAddVehicle');
}

function saveNewVehicle() {
  const plate = document.getElementById('newVehPlate').value.trim().toUpperCase();
  const type  = document.getElementById('newVehType').value.trim();
  const tank  = parseFloat(document.getElementById('newVehTank').value) || 70;
  const rate  = parseFloat(document.getElementById('newVehRate').value) || 11.5;
  const odo   = parseInt(document.getElementById('newVehOdo').value, 10) || 0;
  const fuelType = document.getElementById('newVehFuelType').value;

  if (!plate || !type) {
    showToast('Vui lòng nhập biển số và loại xe!', 'error');
    return;
  }

  // Check unique plate
  if (vehicles.some(v => v.plate === plate)) {
    showToast('Biển số xe này đã tồn tại trong hệ thống!', 'error');
    return;
  }

  const newV = {
    id: 'v-' + Date.now(),
    plate: plate,
    type: type,
    tank: tank,
    stdRate: rate,
    fuelType: fuelType,
    odo: odo,
    fuelLevel: 80,
    status: 'ready',
    driverId: null
  };

  vehicles.push(newV);
  saveData(STORAGE_KEYS.VEHICLES, vehicles);
  closeModal('modalAddVehicle');
  showToast(`✓ Đã thêm xe ${plate} vào đội xe!`, 'success');

  renderSettingsTables();
  renderFleetGrid();
  initVehicleSelectOptions();
  updateAdminKpiBar();
}

function deleteVehicle(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa phương tiện này khỏi danh mục?')) return;
  vehicles = vehicles.filter(v => v.id !== id);
  saveData(STORAGE_KEYS.VEHICLES, vehicles);
  renderSettingsTables();
  renderFleetGrid();
  initVehicleSelectOptions();
  updateAdminKpiBar();
  showToast('Đã xóa phương tiện!', 'success');
}

function openAddDriverModal() {
  document.getElementById('newDriverName').value = '';
  document.getElementById('newDriverPhone').value = '';
  document.getElementById('newDriverLicense').value = 'Hạng C';
  openModal('modalAddDriver');
}

function saveNewDriver() {
  const name = document.getElementById('newDriverName').value.trim();
  const phone = document.getElementById('newDriverPhone').value.trim();
  const license = document.getElementById('newDriverLicense').value.trim();

  if (!name) {
    showToast('Vui lòng nhập họ tên tài xế!', 'error');
    return;
  }

  const newD = {
    id: 'd-' + Date.now(),
    name: name,
    phone: phone || 'Chưa cập nhật',
    license: license || 'Hạng B2'
  };

  drivers.push(newD);
  saveData(STORAGE_KEYS.DRIVERS, drivers);
  closeModal('modalAddDriver');
  showToast(`✓ Đã thêm tài xế ${name}!`, 'success');

  renderSettingsTables();
  initDriverSelectOptions();
}

function deleteDriver(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa tài xế này?')) return;
  drivers = drivers.filter(d => d.id !== id);
  saveData(STORAGE_KEYS.DRIVERS, drivers);
  renderSettingsTables();
  initDriverSelectOptions();
  showToast('Đã xóa tài xế!', 'success');
}

// =========================================================
// EXCEL / CSV REPORT EXPORT
// =========================================================
function exportTripsToExcel() {
  if (trips.length === 0) {
    showToast('Không có dữ liệu ca chạy để xuất!', 'warning');
    return;
  }

  const headers = [
    'Mã Ca',
    'Biển Số Xe',
    'Tài Xế',
    'Trạng Thái',
    'Thời Gian Bắt Đầu',
    'Thời Gian Kết Thúc',
    'ODO Nhận Xe (km)',
    'ODO Trả Xe (km)',
    'Quãng Đường (km)',
    'Nhiên Liệu Nhận (%)',
    'Nhiên Liệu Trả (%)',
    'Nhiên Liệu Tiêu Thụ (Lít)',
    'Định Mức Thực Tế (L/100km)',
    'Tình Trạng Hư Hao',
    'Ghi Chú Hư Hỏng'
  ];

  const rows = trips.map(t => [
    t.id,
    t.vehiclePlate,
    `"${t.driverName}"`,
    t.status === 'on_duty' ? 'Đang chạy' : 'Đã hoàn thành',
    t.startTime,
    t.endTime || '',
    t.startOdo,
    t.endOdo || '',
    t.kmDriven || 0,
    t.startFuel,
    t.endFuel || '',
    t.fuelConsumed || 0,
    t.fuelRate || '',
    t.hasDamage ? 'Có hư hao' : 'Nguyên vẹn',
    `"${(t.damageNotes || '').replace(/"/g, '""')}"`
  ]);

  let csvContent = '\uFEFF'; // UTF-8 BOM so Excel opens Vietnamese fonts correctly
  csvContent += headers.join(',') + '\r\n';
  rows.forEach(row => {
    csvContent += row.join(',') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const now = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `Bao_Cao_Van_Hanh_ODO_Nhien_Lieu_${now}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('✓ Đã tải file báo cáo CSV/Excel thành công!', 'success');
}

// =========================================================
// PHOTO CAPTURE & CANVAS COMPRESSION ENGINE
// =========================================================

function triggerFileInput(inputId) {
  document.getElementById(inputId).click();
}

/**
 * Compresses image file to max 850px dimension and 0.65 quality JPEG
 * to ensure fast local storage and responsive rendering without lag.
 */
function handleSinglePhotoUpload(inputElement, previewImgId, containerId, validationCallback) {
  const file = inputElement.files && inputElement.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const tempImg = new Image();
    tempImg.onload = function() {
      const maxDim = 850;
      let width = tempImg.width;
      let height = tempImg.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tempImg, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);

      // Display in preview
      const previewImg = document.getElementById(previewImgId);
      previewImg.src = compressedBase64;
      previewImg.style.display = 'block';

      const container = document.getElementById(containerId);
      if (container) container.classList.add('has-image');

      // Hide placeholder if any
      if (containerId === 'boxPhotoTaploStart') {
        document.getElementById('placeholderTaploStart').style.display = 'none';
        checkinDraft.photos.taplo = compressedBase64;
      } else if (containerId === 'boxPhotoTaploEnd') {
        document.getElementById('placeholderTaploEnd').style.display = 'none';
        checkoutDraft.photos.taplo = compressedBase64;
      } else if (containerId === 'slotPhotoFrontStart') {
        checkinDraft.photos.front = compressedBase64;
      } else if (containerId === 'slotPhotoBackStart') {
        checkinDraft.photos.back = compressedBase64;
      } else if (containerId === 'slotPhotoLeftStart') {
        checkinDraft.photos.left = compressedBase64;
      } else if (containerId === 'slotPhotoRightStart') {
        checkinDraft.photos.right = compressedBase64;
      } else if (containerId === 'slotPhotoFrontEnd') {
        checkoutDraft.photos.front = compressedBase64;
      } else if (containerId === 'slotPhotoBackEnd') {
        checkoutDraft.photos.back = compressedBase64;
      } else if (containerId === 'slotPhotoLeftEnd') {
        checkoutDraft.photos.left = compressedBase64;
      } else if (containerId === 'slotPhotoRightEnd') {
        checkoutDraft.photos.right = compressedBase64;
      } else if (containerId === 'slotPhotoPump') {
        refuelDraftPhotos.pump = compressedBase64;
      } else if (containerId === 'slotPhotoReceipt') {
        refuelDraftPhotos.receipt = compressedBase64;
      }

      if (typeof validationCallback === 'function') {
        validationCallback();
      }
    };
    tempImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function resetPhotoSlot(boxId, placeholderId, imgId) {
  const box = document.getElementById(boxId);
  const placeholder = document.getElementById(placeholderId);
  const img = document.getElementById(imgId);
  if (box) box.classList.remove('has-image');
  if (placeholder) placeholder.style.display = 'block';
  if (img) {
    img.src = '';
    img.style.display = 'none';
  }
}

function resetSlotPreview(slotContainerId, imgId) {
  const slot = document.getElementById(slotContainerId);
  const img = document.getElementById(imgId);
  if (slot) slot.classList.remove('has-image');
  if (img) {
    img.src = '';
    img.style.display = 'none';
  }
}

// =========================================================
// UTILITY FUNCTIONS & HELPERS
// =========================================================

function updateFuelRangeText(inputId, spanId) {
  const val = document.getElementById(inputId).value;
  document.getElementById(spanId).textContent = val + '%';
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '⚠️';
  else if (type === 'warning') icon = '⚡';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatMoney(amount) {
  return (amount || 0).toLocaleString('vi-VN') + ' đ';
}

function formatDate(isoStr) {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function formatTime(isoStr) {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
