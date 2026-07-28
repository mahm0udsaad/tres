export const STAFF_ROLES = [
  "owner",
  "manager",
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
  "shift_manager",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffProfile = {
  user_id: string;
  full_name: string;
  role: StaffRole;
  branch_id: string | null;
  scheduled_start: string | null;
  is_active: boolean;
};

export type Branch = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  timezone: string;
};

export type AttendanceRecord = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string | null;
  break_started_at: string | null;
  break_ended_at: string | null;
  break_duration_minutes: number;
  break_entitlement_minutes: number;
  status: "active" | "completed";
  on_time: boolean;
  points_earned: number;
  tasks_completed: number;
};

export type StaffTask = {
  id: string;
  title: string;
  task_type: string;
  completed: boolean;
  completed_at: string | null;
  is_required: boolean;
};

export type Gamification = {
  points: number;
  badges: string[];
  streak_count: number;
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "المالك",
  manager: "المدير",
  supervisor: "المشرف",
  employee: "موظف",
  cleaning_staff: "فريق النظافة",
  barista: "باريستا",
  kitchen_manager: "مدير المطبخ",
  shift_manager: "مدير الوردية",
};
