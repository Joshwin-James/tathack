// Project Sentinel — Unified Dispatch and Work Assignment Engine
// Data models, types, and schema specifications

export type AssignmentPriority = 'critical' | 'high' | 'normal' | 'low' | 'p1' | 'p2' | 'p3' | 'p4';

export type AssignmentStatus =
  | 'draft'
  | 'pending_validation'
  | 'pending_approval'
  | 'approved'
  | 'assigned'
  | 'acknowledged'
  | 'in_progress'
  | 'blocked'
  | 'escalated'
  | 'completed'
  | 'pending_verification'
  | 'closed'
  | 'rejected'
  | 'cancelled'
  | 'failed';

export type AssignmentCategory =
  | 'medical'
  | 'police'
  | 'fire'
  | 'municipal'
  | 'traffic'
  | 'cctv'
  | 'hospital'
  | 'infrastructure'
  | 'disaster'
  | 'supervisory';

export type AssignmentType =
  // Emergency Medical
  | 'ambulance_dispatch'
  | 'backup_ambulance_request'
  | 'medical_coordination'
  | 'hospital_prealert'
  | 'inter_facility_transfer'
  | 'ambulance_location_verification'
  // Police & Traffic
  | 'traffic_police_deployment'
  | 'accident_scene_security'
  | 'junction_congestion_intervention'
  | 'traffic_diversion'
  | 'road_closure_assessment'
  | 'crowd_control_request'
  | 'route_obstruction_investigation'
  // Fire & Rescue
  | 'fire_engine_dispatch'
  | 'rescue_team_dispatch'
  | 'flood_rescue_coordination'
  | 'hazmat_response'
  | 'scene_safety_inspection'
  // Municipal & PWD
  | 'pothole_repair'
  | 'road_repair_work_order'
  | 'drainage_inspection'
  | 'waterlogging_investigation'
  | 'fallen_tree_clearance'
  | 'debris_clearance'
  | 'damaged_sign_repair'
  | 'streetlight_repair'
  | 'flood_damage_assessment'
  // Traffic Operations
  | 'emergency_corridor_request'
  | 'signal_optimization'
  | 'junction_queue_investigation'
  | 'signal_fault_repair'
  // CCTV & Verification
  | 'cctv_verification'
  | 'stalled_vehicle_review'
  | 'pedestrian_hazard_review'
  | 'cctv_maintenance'
  // Infrastructure & IT
  | 'telemetry_failure_check'
  | 'sensor_fault_repair'
  | 'api_connectivity_issue'
  // Disaster Management
  | 'flood_prone_inspection'
  | 'evacuation_support'
  | 'emergency_shelter_coordination'
  // Supervisory
  | 'incident_supervisory_review'
  | 'post_incident_investigation';

export type AssignmentSource =
  | 'human'
  | 'automated_rule'
  | 'ai_recommendation'
  | 'simulation'
  | 'citizen_triage';

export type UserRole =
  | 'city_operator'
  | 'traffic_supervisor'
  | 'dispatch_coordinator'
  | 'department_supervisor'
  | 'field_lead'
  | 'technical_admin'
  | 'read_only_observer';

export interface AssignmentEvidence {
  id: string;
  assignment_id: string;
  evidence_type: 'photo' | 'cctv_frame' | 'sensor_log' | 'completion_signoff' | 'telemetry';
  storage_ref: string;
  uploaded_by: string;
  upload_timestamp: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  notes?: string | null;
}

export interface AssignmentComment {
  id: string;
  assignment_id: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  comment: string;
  timestamp: string;
  visibility: 'internal' | 'department' | 'public';
}

export interface AssignmentEvent {
  id: string;
  assignment_id: string;
  event_type:
    | 'created'
    | 'status_change'
    | 'assigned'
    | 'reassigned'
    | 'approved'
    | 'rejected'
    | 'acknowledged'
    | 'started'
    | 'blocked'
    | 'escalated'
    | 'completed'
    | 'verified'
    | 'closed'
    | 'reopened'
    | 'cancelled'
    | 'comment_added'
    | 'evidence_uploaded'
    | 'telemetry_flagged';
  from_status: AssignmentStatus | null;
  to_status: AssignmentStatus | null;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  timestamp: string;
  reason: string | null;
  metadata?: Record<string, any>;
}

export interface Assignment {
  id: string;
  reference_code: string;
  title: string;
  description: string;
  assignment_type: AssignmentType;
  category: AssignmentCategory;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  incident_id: string | null;
  parent_assignment_id: string | null;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  road_segment_id: string | null;
  department_id: string;
  assigned_team_id: string | null;
  assigned_team_name: string | null;
  assigned_unit_id: string | null;
  assigned_unit_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  required_capability: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  acknowledged_at: string | null;
  due_at: string | null;
  target_response_sec: number | null;
  completed_at: string | null;
  closed_at: string | null;
  completion_summary: string | null;
  completion_evidence: AssignmentEvidence[];
  requires_approval: boolean;
  metadata: Record<string, any>;
  version: number;
  source: AssignmentSource;
  is_simulated: boolean;
  stale_location: boolean;
  comments: AssignmentComment[];
  events: AssignmentEvent[];
}

export interface EligibleResource {
  id: string;
  name: string;
  code: string;
  type: 'ambulance' | 'police_patrol' | 'fire_tender' | 'municipal_crew' | 'cctv_station' | 'engineer';
  department: string;
  status: 'available' | 'busy' | 'en_route' | 'off_duty' | 'unknown';
  capabilities: string[];
  base_station: string;
  current_location: { lat: number; lng: number; name: string } | null;
  location_updated_at: string;
  is_stale_location: boolean;
  current_active_tasks: number;
  match_score: number;
  match_reason: string;
  contact_channel: string;
}

export interface DispatchMetrics {
  total: number;
  total_open: number;
  open: number;
  critical: number;
  critical_count: number;
  awaiting_approval: number;
  unassigned_count: number;
  assigned_count: number;
  in_progress: number;
  in_progress_count: number;
  blocked_count: number;
  escalated_count: number;
  completed_today: number;
  overdue_count: number;
  sla_compliance_rate: number;
  avg_acknowledgement_sec: number;
  avg_completion_min: number;
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  assignment_type: AssignmentType;
  category: AssignmentCategory;
  priority: AssignmentPriority;
  incident_id?: string | null;
  parent_assignment_id?: string | null;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  road_segment_id?: string | null;
  department_id: string;
  assigned_unit_id?: string | null;
  assigned_unit_name?: string | null;
  assigned_team_name?: string | null;
  required_capability?: string | null;
  requires_approval?: boolean;
  target_response_sec?: number | null;
  due_at?: string | null;
  source?: AssignmentSource;
  is_simulated?: boolean;
  metadata?: Record<string, any>;
}

export interface TransitionStatusInput {
  assignment_id: string;
  target_status: AssignmentStatus;
  actor_name: string;
  actor_role: UserRole;
  reason?: string | null;
  completion_summary?: string | null;
  expected_version: number;
}

export interface AssignResourceInput {
  assignment_id: string;
  resource_id: string;
  resource_name: string;
  team_name?: string | null;
  actor_name: string;
  actor_role: UserRole;
  reason?: string | null;
  expected_version: number;
}

export interface FilterAssignmentsInput {
  department?: string;
  category?: string;
  priority?: string;
  status?: string;
  source?: string;
  incident_id?: string;
  search?: string;
  include_simulated?: boolean;
  limit?: number;
  offset?: number;
}
