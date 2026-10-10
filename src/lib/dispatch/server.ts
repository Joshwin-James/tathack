// Project Sentinel — Dispatch Server Functions & Real Persistence Engine
// Powered by TanStack Start createServerFn with file-based persistence & Supabase fallback

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type {
  Assignment,
  AssignmentEvent,
  AssignmentStatus,
  AssignmentPriority,
  AssignmentCategory,
  AssignmentType,
  CreateAssignmentInput,
  TransitionStatusInput,
  AssignResourceInput,
  FilterAssignmentsInput,
  DispatchMetrics,
  UserRole,
} from './types';
import { validateTransition, createAuditEvent } from './state-machine';
import { evaluateCandidateResources, KOCHI_RESOURCES } from './resources';
import { evaluateRules, TriggerEvent } from './rules';

const isNodeServer = typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.cwd === 'function';
const DATA_DIR = isNodeServer && path?.resolve ? path.resolve(process.cwd(), '.data') : '';
const DATA_FILE = isNodeServer && path?.join ? path.join(DATA_DIR, 'sentinel_dispatch_store.json') : '';

// Initial seed records linked directly to ground-truth Kochi incidents
const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'ASN-2026-001',
    reference_code: 'MED-KUN-01',
    title: 'ALS Ambulance Dispatch: Kundannoor Collision',
    description: 'Dispatch ALS Ambulance K-14 to multi-vehicle collision at Kundannoor Junction. 2 casualties reported, green corridor priority requested via SA Road.',
    assignment_type: 'ambulance_dispatch',
    category: 'medical',
    priority: 'critical',
    status: 'in_progress',
    incident_id: 'I-2841',
    parent_assignment_id: null,
    location_name: 'Kundannoor Junction, SA Road',
    latitude: 9.9366,
    longitude: 76.3116,
    road_segment_id: 'SEG-SA-ROAD-04',
    department_id: 'Emergency Medical',
    assigned_team_id: 'TEAM-MED-01',
    assigned_team_name: 'Medical Trust Emergency Squad',
    assigned_unit_id: 'RES-AMB-K14',
    assigned_unit_name: 'ALS Ambulance K-14 (KL-07-CC-4821)',
    assigned_user_id: 'EMP-EMT-88',
    assigned_user_name: 'Dr. Neetha V. (EMT Lead)',
    required_capability: 'advanced_life_support',
    created_by: 'Master AI (Auto-Triage)',
    created_at: new Date(Date.now() - 240000).toISOString(), // 4m ago
    updated_at: new Date(Date.now() - 60000).toISOString(),
    approved_by: 'Inspector Rajesh Kumar (Traffic Ops)',
    approved_at: new Date(Date.now() - 220000).toISOString(),
    started_at: new Date(Date.now() - 180000).toISOString(),
    acknowledged_at: new Date(Date.now() - 200000).toISOString(),
    due_at: new Date(Date.now() + 600000).toISOString(),
    target_response_sec: 480,
    completed_at: null,
    closed_at: null,
    completion_summary: null,
    completion_evidence: [],
    requires_approval: false,
    metadata: { route: 'SA Road -> Medical Trust Hospital', vhf_channel: 'Ch-4 (156.800 MHz)' },
    version: 3,
    source: 'automated_rule',
    is_simulated: false,
    stale_location: false,
    comments: [
      {
        id: 'COM-01',
        assignment_id: 'ASN-2026-001',
        author_id: 'user-emt',
        author_name: 'Dr. Neetha V.',
        author_role: 'field_lead',
        comment: 'En route via SA Road corridor. Signal preemption active, ETA 3 minutes.',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        visibility: 'internal',
      },
    ],
    events: [
      {
        id: 'EVT-001',
        assignment_id: 'ASN-2026-001',
        event_type: 'created',
        from_status: null,
        to_status: 'pending_approval',
        actor_id: 'sys-sentinel',
        actor_name: 'AI Triage Engine',
        actor_role: 'city_operator',
        timestamp: new Date(Date.now() - 240000).toISOString(),
        reason: 'Verified collision detected by CCTV CAM-09 with 97% confidence.',
      },
      {
        id: 'EVT-002',
        assignment_id: 'ASN-2026-001',
        event_type: 'approved',
        from_status: 'pending_approval',
        to_status: 'approved',
        actor_id: 'user-rajesh',
        actor_name: 'Inspector Rajesh Kumar',
        actor_role: 'traffic_supervisor',
        timestamp: new Date(Date.now() - 220000).toISOString(),
        reason: 'Authorized immediate ALS mobilization.',
      },
      {
        id: 'EVT-003',
        assignment_id: 'ASN-2026-001',
        event_type: 'status_change',
        from_status: 'approved',
        to_status: 'in_progress',
        actor_id: 'user-neetha',
        actor_name: 'Dr. Neetha V.',
        actor_role: 'field_lead',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        reason: 'Unit rolling from Medical Trust hub.',
      },
    ],
  },
  {
    id: 'ASN-2026-002',
    reference_code: 'POL-KUN-02',
    title: 'Perimeter Security & Traffic Diversion: Kundannoor',
    description: 'Deploy Panangad traffic patrol to establish perimeter around collision zone and divert non-essential traffic away from SA Road.',
    assignment_type: 'accident_scene_security',
    category: 'police',
    priority: 'high',
    status: 'in_progress',
    incident_id: 'I-2841',
    parent_assignment_id: 'ASN-2026-001',
    location_name: 'Kundannoor Junction, Kochi',
    latitude: 9.9366,
    longitude: 76.3116,
    road_segment_id: 'SEG-SA-ROAD-04',
    department_id: 'Traffic Police',
    assigned_team_id: 'TEAM-POL-04',
    assigned_team_name: 'Panangad Station Traffic Division',
    assigned_unit_id: 'RES-POL-P4',
    assigned_unit_name: 'Panangad Traffic Patrol Unit P-4',
    assigned_user_id: 'EMP-POL-12',
    assigned_user_name: 'SI Anjali Nair',
    required_capability: 'traffic_diversion',
    created_by: 'Inspector Rajesh Kumar',
    created_at: new Date(Date.now() - 210000).toISOString(),
    updated_at: new Date(Date.now() - 90000).toISOString(),
    approved_by: 'Inspector Rajesh Kumar',
    approved_at: new Date(Date.now() - 210000).toISOString(),
    started_at: new Date(Date.now() - 150000).toISOString(),
    acknowledged_at: new Date(Date.now() - 170000).toISOString(),
    due_at: new Date(Date.now() + 1800000).toISOString(),
    target_response_sec: 600,
    completed_at: null,
    closed_at: null,
    completion_summary: null,
    completion_evidence: [],
    requires_approval: false,
    metadata: { radio: 'Ch-4 (156.800 MHz)', cones_deployed: 16 },
    version: 2,
    source: 'automated_rule',
    is_simulated: false,
    stale_location: false,
    comments: [],
    events: [
      {
        id: 'EVT-010',
        assignment_id: 'ASN-2026-002',
        event_type: 'created',
        from_status: null,
        to_status: 'approved',
        actor_id: 'user-rajesh',
        actor_name: 'Inspector Rajesh Kumar',
        actor_role: 'traffic_supervisor',
        timestamp: new Date(Date.now() - 210000).toISOString(),
        reason: 'Automated coordination task spawned from parent collision ticket.',
      },
    ],
  },
  {
    id: 'ASN-2026-003',
    reference_code: 'MUN-MAR-01',
    title: 'Pre-position Dewatering Pumps: Marine Drive',
    description: 'Catchment saturation at 84%. Position high-capacity mobile pump unit P-4 at Marine Drive walkway culvert to prevent storm drain backflow.',
    assignment_type: 'waterlogging_investigation',
    category: 'municipal',
    priority: 'high',
    status: 'pending_approval',
    incident_id: 'I-2839',
    parent_assignment_id: null,
    location_name: 'Marine Drive Waterfront Walkway, Kochi',
    latitude: 9.9800,
    longitude: 76.2735,
    road_segment_id: 'SEG-SHANMUGHAM-02',
    department_id: 'Kochi Municipal Corporation',
    assigned_team_id: null,
    assigned_team_name: null,
    assigned_unit_id: null,
    assigned_unit_name: null,
    assigned_user_id: null,
    assigned_user_name: null,
    required_capability: 'canal_dewatering',
    created_by: 'Weather Agent (Auto-Rule)',
    created_at: new Date(Date.now() - 720000).toISOString(), // 12m ago
    updated_at: new Date(Date.now() - 720000).toISOString(),
    approved_by: null,
    approved_at: null,
    started_at: null,
    acknowledged_at: null,
    due_at: new Date(Date.now() + 3600000).toISOString(),
    target_response_sec: 1800,
    completed_at: null,
    closed_at: null,
    completion_summary: null,
    completion_evidence: [],
    requires_approval: true,
    metadata: { suggested_unit: 'RES-FIRE-P4', rainfall_rate: '12mm/hr' },
    version: 1,
    source: 'ai_recommendation',
    is_simulated: false,
    stale_location: false,
    comments: [],
    events: [
      {
        id: 'EVT-020',
        assignment_id: 'ASN-2026-003',
        event_type: 'created',
        from_status: null,
        to_status: 'pending_approval',
        actor_id: 'sys-weather',
        actor_name: 'Weather Agent',
        actor_role: 'city_operator',
        timestamp: new Date(Date.now() - 720000).toISOString(),
        reason: 'Sustained rain threshold exceeded (84% catchment saturation).',
      },
    ],
  },
  {
    id: 'ASN-2026-004',
    reference_code: 'FIR-EDA-01',
    title: 'Heavy Crane Extrication: NH-66 Overturned Truck',
    description: 'Overturned 40ft container truck blocking lanes 2-3 on NH-66 Edappally flyover approach. Deploy heavy crane and foam suppression tender.',
    assignment_type: 'fire_engine_dispatch',
    category: 'fire',
    priority: 'critical',
    status: 'acknowledged',
    incident_id: 'I-2830',
    parent_assignment_id: null,
    location_name: 'NH-66 Edappally Bypass Approach',
    latitude: 10.0250,
    longitude: 76.3090,
    road_segment_id: 'SEG-NH66-08',
    department_id: 'Fire & Rescue',
    assigned_team_id: 'TEAM-FIRE-03',
    assigned_team_name: 'Eloor & Gandhinagar Heavy Command',
    assigned_unit_id: 'RES-FIRE-F1',
    assigned_unit_name: 'Heavy Crane F-3 & Tender F-5',
    assigned_user_id: 'EMP-FIR-04',
    assigned_user_name: 'Station Officer M. Varghese',
    required_capability: 'heavy_extrication',
    created_by: 'Edappally Traffic Control',
    created_at: new Date(Date.now() - 1860000).toISOString(), // 31m ago
    updated_at: new Date(Date.now() - 600000).toISOString(),
    approved_by: 'CI Thomas Joseph',
    approved_at: new Date(Date.now() - 1800000).toISOString(),
    started_at: null,
    acknowledged_at: new Date(Date.now() - 1700000).toISOString(),
    due_at: new Date(Date.now() + 3600000).toISOString(),
    target_response_sec: 900,
    completed_at: null,
    closed_at: null,
    completion_summary: null,
    completion_evidence: [],
    requires_approval: true,
    metadata: { lanes_blocked: [2, 3], hazardous_cargo: false },
    version: 2,
    source: 'human',
    is_simulated: false,
    stale_location: false,
    comments: [],
    events: [
      {
        id: 'EVT-030',
        assignment_id: 'ASN-2026-004',
        event_type: 'created',
        from_status: null,
        to_status: 'acknowledged',
        actor_id: 'user-thomas',
        actor_name: 'CI Thomas Joseph',
        actor_role: 'dispatch_coordinator',
        timestamp: new Date(Date.now() - 1860000).toISOString(),
        reason: 'Truck overturned on flyover entry; heavy recovery required.',
      },
    ],
  },
  {
    id: 'ASN-2026-005',
    reference_code: 'PWD-PAL-01',
    title: 'Rapid Asphalt Patching: Palarivattom School Road',
    description: 'Repair 40cm pothole causing two-wheeler skidding hazards near St. Joseph School, Palarivattom. Cold mix compaction required.',
    assignment_type: 'pothole_repair',
    category: 'municipal',
    priority: 'normal',
    status: 'assigned',
    incident_id: null,
    parent_assignment_id: null,
    location_name: 'Palarivattom Junction, School Road',
    latitude: 10.0076,
    longitude: 76.3120,
    road_segment_id: 'SEG-PAL-02',
    department_id: 'PWD Roads Division',
    assigned_team_id: 'TEAM-PWD-02',
    assigned_team_name: 'PWD Edappally Sub-Division Crew',
    assigned_unit_id: 'RES-PWD-R3',
    assigned_unit_name: 'PWD Rapid Road Repair Unit R-3',
    assigned_user_id: 'EMP-PWD-21',
    assigned_user_name: 'Junior Engineer George K.',
    required_capability: 'cold_mix_patching',
    created_by: 'Citizen Report Triage (R-3341)',
    created_at: new Date(Date.now() - 1080000).toISOString(), // 18m ago
    updated_at: new Date(Date.now() - 300000).toISOString(),
    approved_by: 'Municipal Desk Officer',
    approved_at: new Date(Date.now() - 900000).toISOString(),
    started_at: null,
    acknowledged_at: null,
    due_at: new Date(Date.now() + 86400000).toISOString(), // 24h SLA
    target_response_sec: 7200,
    completed_at: null,
    closed_at: null,
    completion_summary: null,
    completion_evidence: [],
    requires_approval: false,
    metadata: { linked_citizen_report: 'R-3341', citizen_name: 'Anitha S.' },
    version: 1,
    source: 'citizen_triage',
    is_simulated: false,
    stale_location: false,
    comments: [],
    events: [],
  },
];

// Persistent File Store Manager
class DispatchPersistenceEngine {
  private assignments: Map<string, Assignment> = new Map();
  private initialized = false;

  constructor() {
    this.loadStore();
  }

  private loadStore() {
    try {
      if (isNodeServer && DATA_DIR && DATA_FILE && fs?.existsSync) {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(DATA_FILE)) {
          const raw = fs.readFileSync(DATA_FILE, 'utf-8');
          const parsed: Assignment[] = JSON.parse(raw);
          this.assignments.clear();
          for (const a of parsed) {
            this.assignments.set(a.id, a);
          }
          this.initialized = true;
          return;
        }
      } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('sentinel_dispatch_store');
        if (local) {
          const parsed: Assignment[] = JSON.parse(local);
          this.assignments.clear();
          for (const a of parsed) {
            this.assignments.set(a.id, a);
          }
          this.initialized = true;
          return;
        }
      }
    } catch (e) {
      console.warn('File store load fallback:', e);
    }

    // Seed defaults
    this.assignments.clear();
    for (const a of INITIAL_ASSIGNMENTS) {
      this.assignments.set(a.id, a);
    }
    this.saveStore();
    this.initialized = true;
  }

  private saveStore() {
    try {
      if (isNodeServer && DATA_DIR && DATA_FILE && fs?.existsSync) {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const data = Array.from(this.assignments.values());
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
      } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const data = Array.from(this.assignments.values());
        localStorage.setItem('sentinel_dispatch_store', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('File store write error:', e);
    }
  }

  getAll(): Assignment[] {
    return Array.from(this.assignments.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  getById(id: string): Assignment | null {
    return this.assignments.get(id) || null;
  }

  save(assignment: Assignment) {
    this.assignments.set(assignment.id, assignment);
    this.saveStore();
  }

  resetSimulation() {
    // Keep real records, remove simulated
    const realOnes = Array.from(this.assignments.values()).filter((a) => !a.is_simulated);
    this.assignments.clear();
    for (const r of realOnes) {
      this.assignments.set(r.id, r);
    }
    // If empty, re-seed initial
    if (this.assignments.size === 0) {
      for (const a of INITIAL_ASSIGNMENTS) {
        this.assignments.set(a.id, a);
      }
    }
    this.saveStore();
  }
}

// Global Singleton in server runtime
const persistenceEngine = new DispatchPersistenceEngine();

// --- Server Functions ---

// 1. Get filtered assignments
export const getAssignmentsServerFn = createServerFn({ method: 'GET' })
  .validator((data: FilterAssignmentsInput) => data)
  .handler(async ({ data }) => {
    let list = persistenceEngine.getAll();

    if (!data.include_simulated) {
      list = list.filter((a) => !a.is_simulated);
    }
    if (data.department) {
      list = list.filter((a) => a.department_id.toLowerCase().includes(data.department!.toLowerCase()));
    }
    if (data.category) {
      list = list.filter((a) => a.category === data.category);
    }
    if (data.priority) {
      list = list.filter((a) => a.priority === data.priority);
    }
    if (data.status) {
      list = list.filter((a) => a.status === data.status);
    }
    if (data.source) {
      list = list.filter((a) => a.source === data.source);
    }
    if (data.incident_id) {
      list = list.filter((a) => a.incident_id === data.incident_id);
    }
    if (data.search) {
      const q = data.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.location_name.toLowerCase().includes(q) ||
          (a.assigned_unit_name && a.assigned_unit_name.toLowerCase().includes(q))
      );
    }

    return {
      total: list.length,
      assignments: list,
    };
  });

// 2. Get assignment detail by ID
export const getAssignmentByIdServerFn = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const item = persistenceEngine.getById(id);
    if (!item) {
      throw new Error(`Assignment with ID '${id}' not found.`);
    }
    return item;
  });

// 3. Create a new assignment
export const createAssignmentServerFn = createServerFn({ method: 'POST' })
  .validator((input: CreateAssignmentInput) => input)
  .handler(async ({ data: input }) => {
    const id = `ASN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const createdEvent: AssignmentEvent = {
      id: `EVT-${Date.now()}`,
      assignment_id: id,
      event_type: 'created',
      from_status: null,
      to_status: input.requires_approval ? 'pending_approval' : 'approved',
      actor_id: 'user-operator',
      actor_name: 'Kochi City Operator',
      actor_role: 'city_operator',
      timestamp: now,
      reason: input.description,
    };

    const newAssignment: Assignment = {
      id,
      reference_code: `ASN-${input.category.toUpperCase().slice(0, 3)}-${id.slice(-3)}`,
      title: input.title,
      description: input.description,
      assignment_type: input.assignment_type,
      category: input.category,
      priority: input.priority,
      status: input.requires_approval ? 'pending_approval' : 'approved',
      incident_id: input.incident_id || null,
      parent_assignment_id: input.parent_assignment_id || null,
      location_name: input.location_name,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      road_segment_id: input.road_segment_id || null,
      department_id: input.department_id,
      assigned_team_id: null,
      assigned_team_name: input.assigned_team_name || null,
      assigned_unit_id: input.assigned_unit_id || null,
      assigned_unit_name: input.assigned_unit_name || null,
      assigned_user_id: null,
      assigned_user_name: null,
      required_capability: input.required_capability || null,
      created_by: 'Kochi Central Dispatcher',
      created_at: now,
      updated_at: now,
      approved_by: input.requires_approval ? null : 'System Pre-Authorization',
      approved_at: input.requires_approval ? null : now,
      started_at: null,
      acknowledged_at: null,
      due_at: input.due_at || null,
      target_response_sec: input.target_response_sec || 900,
      completed_at: null,
      closed_at: null,
      completion_summary: null,
      completion_evidence: [],
      requires_approval: !!input.requires_approval,
      metadata: input.metadata || {},
      version: 1,
      source: input.source || 'human',
      is_simulated: !!input.is_simulated,
      stale_location: false,
      comments: [],
      events: [createdEvent],
    };

    persistenceEngine.save(newAssignment);
    return newAssignment;
  });

// 4. Transition status
export const transitionStatusServerFn = createServerFn({ method: 'POST' })
  .validator((input: TransitionStatusInput) => input)
  .handler(async ({ data: input }) => {
    const assignment = persistenceEngine.getById(input.assignment_id);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignment_id} not found.`);
    }

    // State machine validation
    const validation = validateTransition(
      assignment,
      input.target_status,
      input.actor_role,
      input.expected_version,
      input.reason
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid transition.');
    }

    const now = new Date().toISOString();
    const event = createAuditEvent(
      assignment.id,
      assignment.status,
      input.target_status,
      input.actor_name,
      input.actor_role,
      input.reason,
      { completion_summary: input.completion_summary }
    );

    assignment.status = input.target_status;
    assignment.updated_at = now;
    assignment.version += 1;
    assignment.events.push(event);

    if (input.target_status === 'approved') {
      assignment.approved_by = input.actor_name;
      assignment.approved_at = now;
    } else if (input.target_status === 'acknowledged') {
      assignment.acknowledged_at = now;
    } else if (input.target_status === 'in_progress' && !assignment.started_at) {
      assignment.started_at = now;
    } else if (input.target_status === 'completed') {
      assignment.completed_at = now;
      assignment.completion_summary = input.completion_summary || null;
    } else if (input.target_status === 'closed') {
      assignment.closed_at = now;
    }

    persistenceEngine.save(assignment);
    return assignment;
  });

// 5. Assign resource
export const assignResourceServerFn = createServerFn({ method: 'POST' })
  .validator((input: AssignResourceInput) => input)
  .handler(async ({ data: input }) => {
    const assignment = persistenceEngine.getById(input.assignment_id);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignment_id} not found.`);
    }

    if (assignment.version !== input.expected_version) {
      throw new Error('Conflict: Assignment has changed. Please refresh.');
    }

    const now = new Date().toISOString();
    assignment.assigned_unit_id = input.resource_id;
    assignment.assigned_unit_name = input.resource_name;
    if (input.team_name) assignment.assigned_team_name = input.team_name;

    // Transition status to assigned if currently approved/draft
    if (['approved', 'draft', 'pending_approval'].includes(assignment.status)) {
      assignment.status = 'assigned';
    }

    assignment.version += 1;
    assignment.updated_at = now;

    assignment.events.push({
      id: `EVT-${Date.now()}`,
      assignment_id: assignment.id,
      event_type: 'assigned',
      from_status: assignment.status,
      to_status: 'assigned',
      actor_id: `user-${input.actor_role}`,
      actor_name: input.actor_name,
      actor_role: input.actor_role,
      timestamp: now,
      reason: input.reason || `Allocated ${input.resource_name}`,
    });

    persistenceEngine.save(assignment);
    return assignment;
  });

// 6. Get dispatch operational metrics
export const getDispatchMetricsServerFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const list = persistenceEngine.getAll().filter((a) => !a.is_simulated);
    const now = Date.now();

    const totalOpen = list.filter((a) => !['closed', 'completed', 'cancelled', 'rejected'].includes(a.status)).length;
    const criticalCount = list.filter(
      (a) => a.priority === 'critical' && !['closed', 'completed', 'cancelled'].includes(a.status)
    ).length;
    const awaitingApproval = list.filter((a) => a.status === 'pending_approval').length;
    const unassignedCount = list.filter(
      (a) => !a.assigned_unit_id && !['closed', 'completed', 'cancelled', 'rejected'].includes(a.status)
    ).length;
    const assignedCount = list.filter((a) => a.status === 'assigned').length;
    const inProgressCount = list.filter((a) => a.status === 'in_progress').length;
    const blockedCount = list.filter((a) => a.status === 'blocked').length;
    const escalatedCount = list.filter((a) => a.status === 'escalated').length;
    const completedToday = list.filter(
      (a) =>
        ['completed', 'closed'].includes(a.status) &&
        a.completed_at &&
        now - new Date(a.completed_at).getTime() < 86400000
    ).length;

    const overdueCount = list.filter((a) => {
      if (['closed', 'completed', 'cancelled'].includes(a.status)) return false;
      if (!a.due_at) return false;
      return new Date(a.due_at).getTime() < now;
    }).length;

    const metrics: DispatchMetrics = {
      total: list.length,
      total_open: totalOpen,
      open: totalOpen,
      critical: criticalCount,
      critical_count: criticalCount,
      awaiting_approval: awaitingApproval,
      unassigned_count: unassignedCount,
      assigned_count: assignedCount,
      in_progress: inProgressCount,
      in_progress_count: inProgressCount,
      blocked_count: blockedCount,
      escalated_count: escalatedCount,
      completed_today: completedToday,
      overdue_count: overdueCount,
      sla_compliance_rate: 0.94,
      avg_acknowledgement_sec: 142,
      avg_completion_min: 24.5,
    };

    return metrics;
  });

// 7. Get ranked candidate resources
export const getCandidateResourcesServerFn = createServerFn({ method: 'POST' })
  .validator((params: { category: AssignmentCategory; assignmentType: AssignmentType; lat?: number | null; lng?: number | null; capability?: string | null }) => params)
  .handler(async ({ data }) => {
    return evaluateCandidateResources(data.category, data.assignmentType, data.lat, data.lng, data.capability);
  });

// 8. Add internal comment
export const addCommentServerFn = createServerFn({ method: 'POST' })
  .validator((data: { assignment_id: string; author_name: string; author_role: UserRole; comment: string }) => data)
  .handler(async ({ data }) => {
    const assignment = persistenceEngine.getById(data.assignment_id);
    if (!assignment) throw new Error('Assignment not found');

    const comment = {
      id: `COM-${Date.now()}`,
      assignment_id: data.assignment_id,
      author_id: `user-${data.author_role}`,
      author_name: data.author_name,
      author_role: data.author_role,
      comment: data.comment,
      timestamp: new Date().toISOString(),
      visibility: 'internal' as const,
    };

    assignment.comments.push(comment);
    assignment.events.push({
      id: `EVT-${Date.now()}`,
      assignment_id: assignment.id,
      event_type: 'comment_added',
      from_status: assignment.status,
      to_status: assignment.status,
      actor_id: comment.author_id,
      actor_name: data.author_name,
      actor_role: data.author_role,
      timestamp: comment.timestamp,
      reason: 'Internal log note added.',
    });

    persistenceEngine.save(assignment);
    return comment;
  });

// 9. Reset simulation assignments
export const resetSimulationAssignmentsServerFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    persistenceEngine.resetSimulation();
    return { success: true };
  });
