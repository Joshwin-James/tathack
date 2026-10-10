// Project Sentinel — Dispatch Engine State Machine
// Validated backend-owned transitions, permission checks, and concurrency protection

import type { Assignment, AssignmentStatus, UserRole, AssignmentEvent } from './types';

// Legal transition graph
export const LEGAL_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  draft: ['pending_validation', 'pending_approval', 'approved', 'cancelled'],
  pending_validation: ['pending_approval', 'approved', 'rejected', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['acknowledged', 'in_progress', 'blocked', 'cancelled'],
  acknowledged: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'pending_verification', 'blocked', 'escalated', 'cancelled'],
  blocked: ['in_progress', 'escalated', 'cancelled'],
  escalated: ['in_progress', 'assigned', 'cancelled'],
  completed: ['pending_verification', 'closed', 'in_progress'],
  pending_verification: ['closed', 'in_progress'],
  closed: ['in_progress'], // Reopen only with supervisory authorization
  rejected: ['draft'],
  cancelled: ['draft'],
  failed: ['draft', 'escalated'],
};

// Role authorization checks
export function isActionAuthorized(
  currentStatus: AssignmentStatus,
  targetStatus: AssignmentStatus,
  role: UserRole,
  requiresApproval: boolean
): { authorized: boolean; reason?: string } {
  // Read-only observer cannot perform any mutations
  if (role === 'read_only_observer') {
    return { authorized: false, reason: 'Read-only observer role cannot execute status transitions.' };
  }

  // Approving consequential work
  if (targetStatus === 'approved') {
    const approverRoles: UserRole[] = [
      'city_operator',
      'traffic_supervisor',
      'dispatch_coordinator',
      'department_supervisor',
    ];
    if (!approverRoles.includes(role)) {
      return {
        authorized: false,
        reason: `Role '${role}' is not authorized to approve assignments. Supervisor or Dispatch Coordinator required.`,
      };
    }
  }

  // Closing / verifying completion
  if (targetStatus === 'closed') {
    const verifierRoles: UserRole[] = [
      'city_operator',
      'dispatch_coordinator',
      'department_supervisor',
      'traffic_supervisor',
    ];
    if (!verifierRoles.includes(role)) {
      return {
        authorized: false,
        reason: `Closing and verifying an assignment requires supervisory authorization. Role '${role}' lacks privilege.`,
      };
    }
  }

  // Reopening closed task
  if (currentStatus === 'closed' && targetStatus === 'in_progress') {
    const reopenRoles: UserRole[] = ['city_operator', 'traffic_supervisor', 'dispatch_coordinator'];
    if (!reopenRoles.includes(role)) {
      return {
        authorized: false,
        reason: `Reopening a closed assignment requires senior supervisory override. Role '${role}' lacks privilege.`,
      };
    }
  }

  // Field updates: field leads & coordinators
  if (['acknowledged', 'in_progress', 'completed', 'blocked'].includes(targetStatus)) {
    return { authorized: true };
  }

  return { authorized: true };
}

export function validateTransition(
  assignment: Assignment,
  targetStatus: AssignmentStatus,
  actorRole: UserRole,
  expectedVersion: number,
  reason?: string | null
): { valid: boolean; error?: string } {
  // 1. Concurrency Check
  if (assignment.version !== expectedVersion) {
    return {
      valid: false,
      error: `Conflict: Assignment has been modified by another operator (expected version ${expectedVersion}, current version ${assignment.version}). Please refresh.`,
    };
  }

  // 2. Self-transition check
  if (assignment.status === targetStatus) {
    return {
      valid: false,
      error: `Assignment is already in status '${targetStatus}'. Duplicate transition ignored.`,
    };
  }

  // 3. Legal transition check
  const allowed = LEGAL_TRANSITIONS[assignment.status] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      error: `Illegal state transition from '${assignment.status}' to '${targetStatus}'. Allowed transitions: ${allowed.join(', ')}.`,
    };
  }

  // 4. Role Authorization
  const auth = isActionAuthorized(assignment.status, targetStatus, actorRole, assignment.requires_approval);
  if (!auth.authorized) {
    return {
      valid: false,
      error: auth.reason || 'Unauthorized operation.',
    };
  }

  // 5. Mandatory Reason for Blocked, Escalated, Rejected, or Reopened
  if (['blocked', 'escalated', 'rejected'].includes(targetStatus) && (!reason || reason.trim() === '')) {
    return {
      valid: false,
      error: `Transition to '${targetStatus}' requires an explicit reason or explanation for audit tracking.`,
    };
  }

  if (assignment.status === 'closed' && targetStatus === 'in_progress' && (!reason || reason.trim() === '')) {
    return {
      valid: false,
      error: 'Reopening an audited closed assignment requires an explicit supervisor reason.',
    };
  }

  return { valid: true };
}

export function createAuditEvent(
  assignmentId: string,
  fromStatus: AssignmentStatus | null,
  toStatus: AssignmentStatus,
  actorName: string,
  actorRole: UserRole,
  reason: string | null = null,
  metadata: Record<string, unknown> = {}
): AssignmentEvent {
  return {
    id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    assignment_id: assignmentId,
    event_type: 'status_change',
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: `user-${actorRole}`,
    actor_name: actorName,
    actor_role: actorRole,
    timestamp: new Date().toISOString(),
    reason,
    metadata,
  };
}
