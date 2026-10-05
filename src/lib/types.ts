export type Role = 'manager' | 'driver';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  license: string | null;
  email: string | null;
  role: Role;
  active?: boolean; // Còn làm / Đã nghỉ (thiếu cột = coi như còn làm)
}

export type VehicleStatus = 'ready' | 'on_duty' | 'maintenance' | 'inactive' | 'repair';
export const VEHICLE_STATUS: Record<VehicleStatus, string> = {
  ready: 'Sẵn sàng', on_duty: 'Đang vận hành', maintenance: 'Bảo dưỡng',
  inactive: 'Ngưng hoạt động', repair: 'Đang sửa chữa tai nạn',
};

export interface Vehicle {
  id: string;
  plate: string;
  type: string | null;
  energy_type: 'fuel' | 'electric';
  capacity: number;
  std_rate: number;
  fuel_type: string;
  odo: number;
  energy_level: number;
  status: VehicleStatus;
  driver_id: string | null;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string;
  status: 'on_duty' | 'completed';
  start_time: string;
  start_odo: number;
  start_level: number;
}

export interface Refuel {
  id: string;
  created_at: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  energy_type: 'fuel' | 'electric';
  odo_at_refuel: number;
  battery_before: number | null;
  battery_after: number | null;
  charge_minutes: number | null;
  status: 'pending' | 'approved' | 'rejected';
}

// Nhãn hiển thị dùng chung cho xe dầu/xăng và xe điện
export const energyLabels = (t: Vehicle['energy_type']) =>
  t === 'electric'
    ? { name: 'Điện', level: 'Mức pin', unit: 'kWh', rate: 'kWh/100km', fill: 'Cấp điện', station: 'Trạm sạc', pump: 'Ảnh màn hình trạm sạc' }
    : { name: 'Nhiên liệu', level: 'Mức nhiên liệu', unit: 'Lít', rate: 'L/100km', fill: 'Cấp nhiên liệu', station: 'Trạm xăng', pump: 'Ảnh đồng hồ cột bơm' };

// Ảnh bắt buộc khi cấp nhiên liệu / cấp điện (khóa lưu trong refuels.photos)
export const refuelSlots = (t: Vehicle['energy_type']): [string, string][] =>
  t === 'electric'
    ? [['before', 'Trước khi sạc'], ['after', 'Sau khi sạc'], ['receipt', 'Hóa đơn / lịch sử sạc']]
    : [['before', 'Trước khi đổ'], ['after', 'Sau khi đổ'], ['pump', 'Đồng hồ trạm xăng'], ['receipt', 'Hình ảnh hóa đơn']];
