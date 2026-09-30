export type Role = 'manager' | 'driver';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  license: string | null;
  role: Role;
}

export interface Vehicle {
  id: string;
  plate: string;
  type: string | null;
  tank_liters: number;
  std_rate: number;
  fuel_type: string;
  odo: number;
  fuel_level: number;
  status: 'ready' | 'on_duty' | 'maintenance';
  driver_id: string | null;
}
