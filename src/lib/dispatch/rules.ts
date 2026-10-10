// Project Sentinel — Dispatch Automation & Rule Engine
// Idempotent triggers, deduplication keys, and policy thresholds

import type {
  Assignment,
  AssignmentCategory,
  AssignmentPriority,
  AssignmentType,
  CreateAssignmentInput,
} from './types';

export interface TriggerEvent {
  eventType:
    | 'accident_detected'
    | 'route_obstructed'
    | 'waterlogging_confirmed'
    | 'cctv_feed_failure'
    | 'stale_telemetry_detected'
    | 'task_sla_breach'
    | 'repair_completed';
  entityId: string;
  locationName: string;
  latitude?: number | null;
  longitude?: number | null;
  severity?: 'critical' | 'high' | 'normal' | 'low';
  confidence?: number;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  cooldownSeconds: number;
  confidenceThreshold?: number;
  handler: (event: TriggerEvent) => CreateAssignmentInput[];
}

// In-memory deduplication registry: dedupKey -> lastTriggerTimestamp
const dedupRegistry = new Map<string, number>();

export const AUTOMATION_RULES: RuleDefinition[] = [
  // Rule 1: Verified serious accident triggers Medical ALS & Police Scene Security
  {
    id: 'RULE_ACCIDENT_EMERGENCY_DISPATCH',
    name: 'Serious Accident Response Protocol',
    description: 'Proposes dual Emergency Medical and Traffic Police assignments when an accident is detected.',
    enabled: true,
    cooldownSeconds: 300, // 5 min cooldown per incident
    confidenceThreshold: 85,
    handler: (event) => {
      const isCritical = event.severity === 'critical';
      return [
        {
          title: `Emergency Medical Dispatch: ${event.locationName}`,
          description: `Dispatched ALS Ambulance to collision scene at ${event.locationName}. Rapid trauma triage requested.`,
          assignment_type: 'ambulance_dispatch',
          category: 'medical',
          priority: isCritical ? 'critical' : 'high',
          incident_id: event.entityId,
          location_name: event.locationName,
          latitude: event.latitude,
          longitude: event.longitude,
          department_id: 'Emergency Medical',
          required_capability: 'advanced_life_support',
          requires_approval: false, // Immediate priority
          target_response_sec: 480, // 8 mins SLA
          source: 'automated_rule',
          metadata: { rule_id: 'RULE_ACCIDENT_EMERGENCY_DISPATCH', confidence: event.confidence },
        },
        {
          title: `Accident Scene Security & Traffic Diversion: ${event.locationName}`,
          description: `Deploy traffic police patrol to secure perimeter, divert oncoming vehicles, and keep emergency lanes clear.`,
          assignment_type: 'accident_scene_security',
          category: 'police',
          priority: isCritical ? 'critical' : 'high',
          incident_id: event.entityId,
          location_name: event.locationName,
          latitude: event.latitude,
          longitude: event.longitude,
          department_id: 'Traffic Police',
          required_capability: 'traffic_diversion',
          requires_approval: false,
          target_response_sec: 600,
          source: 'automated_rule',
          metadata: { rule_id: 'RULE_ACCIDENT_EMERGENCY_DISPATCH' },
        },
      ];
    },
  },

  // Rule 2: Confirmed road waterlogging creates municipal dewatering task
  {
    id: 'RULE_WATERLOGGING_CIVIC_WORK_ORDER',
    name: 'Monsoon Waterlogging Work Order',
    description: 'Generates Municipal Corporation drainage and suction pump work order upon verified waterlogging.',
    enabled: true,
    cooldownSeconds: 600,
    confidenceThreshold: 80,
    handler: (event) => [
      {
        title: `Dewatering & Drainage Clearing: ${event.locationName}`,
        description: `Mobilize high-capacity drainage jetting squad or pump unit to relieve street water accumulation at ${event.locationName}.`,
        assignment_type: 'waterlogging_investigation',
        category: 'municipal',
        priority: 'high',
        incident_id: event.entityId,
        location_name: event.locationName,
        latitude: event.latitude,
        longitude: event.longitude,
        department_id: 'Kochi Municipal Corporation',
        required_capability: 'culvert_clearing',
        requires_approval: true, // Municipal work requires supervisor acknowledgement
        target_response_sec: 1800, // 30 min SLA
        source: 'automated_rule',
        metadata: { rule_id: 'RULE_WATERLOGGING_CIVIC_WORK_ORDER' },
      },
    ],
  },

  // Rule 3: CCTV Camera stream outage triggers IT maintenance ticket
  {
    id: 'RULE_CCTV_OUTAGE_TICKET',
    name: 'Camera Sensor Fault Ticket',
    description: 'Generates Technical Maintenance Ticket if an optical sensor goes offline or fails health checks.',
    enabled: true,
    cooldownSeconds: 1800, // 30 mins cooldown per camera
    handler: (event) => [
      {
        title: `Optical Sensor Maintenance: Camera ${event.entityId}`,
        description: `CCTV stream or RTSP packet feed at ${event.locationName} has stopped reporting. Inspect IP link and power feed.`,
        assignment_type: 'cctv_maintenance',
        category: 'infrastructure',
        priority: 'normal',
        incident_id: null,
        location_name: event.locationName,
        latitude: event.latitude,
        longitude: event.longitude,
        department_id: 'Traffic Operations',
        required_capability: 'cctv_maintenance',
        requires_approval: false,
        target_response_sec: 7200, // 2 hours SLA
        source: 'automated_rule',
        metadata: { rule_id: 'RULE_CCTV_OUTAGE_TICKET', camera_id: event.entityId },
      },
    ],
  },

  // Rule 4: Stale ambulance GPS telemetry flags position and requests verbal check
  {
    id: 'RULE_STALE_AMBULANCE_TELEMETRY',
    name: 'Stale Emergency Telemetry Verification',
    description: 'Creates a VHF radio location verification task when an active unit fails to report GPS for > 120s.',
    enabled: true,
    cooldownSeconds: 300,
    handler: (event) => [
      {
        title: `VHF Telemetry Verification: Unit ${event.entityId}`,
        description: `GPS transponder on ${event.entityId} has not transmitted for over 2 minutes. Dispatch coordinator must initiate VHF voice check.`,
        assignment_type: 'ambulance_location_verification',
        category: 'medical',
        priority: 'high',
        incident_id: event.metadata?.linked_incident_id as string || null,
        location_name: event.locationName,
        department_id: 'Emergency Medical',
        required_capability: 'telemetry_uplink',
        requires_approval: false,
        target_response_sec: 180, // 3 mins SLA
        source: 'automated_rule',
        metadata: { rule_id: 'RULE_STALE_AMBULANCE_TELEMETRY', unit_id: event.entityId },
      },
    ],
  },
];

// Deduplicating evaluation engine
export function evaluateRules(event: TriggerEvent): CreateAssignmentInput[] {
  const now = event.timestamp || Date.now();
  const outputs: CreateAssignmentInput[] = [];

  for (const rule of AUTOMATION_RULES) {
    if (!rule.enabled) continue;

    // Check confidence threshold if defined
    if (rule.confidenceThreshold && (event.confidence || 0) < rule.confidenceThreshold) {
      continue;
    }

    // Match event type
    let matches = false;
    if (rule.id === 'RULE_ACCIDENT_EMERGENCY_DISPATCH' && event.eventType === 'accident_detected') matches = true;
    if (rule.id === 'RULE_WATERLOGGING_CIVIC_WORK_ORDER' && event.eventType === 'waterlogging_confirmed') matches = true;
    if (rule.id === 'RULE_CCTV_OUTAGE_TICKET' && event.eventType === 'cctv_feed_failure') matches = true;
    if (rule.id === 'RULE_STALE_AMBULANCE_TELEMETRY' && event.eventType === 'stale_telemetry_detected') matches = true;

    if (!matches) continue;

    // Deduplication check
    const dedupKey = `${rule.id}:${event.entityId}`;
    const lastTrigger = dedupRegistry.get(dedupKey);

    if (lastTrigger && now - lastTrigger < rule.cooldownSeconds * 1000) {
      // Cooldown active, suppress duplicate assignment
      continue;
    }

    // Record trigger timestamp
    dedupRegistry.set(dedupKey, now);

    // Generate output assignments
    const generated = rule.handler(event);
    outputs.push(...generated);
  }

  return outputs;
}
