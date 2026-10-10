// Project Sentinel — Dispatch Client Store & Reactive State Hook
// Connects to server functions with optimistic updates and BroadcastChannel sync

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  Assignment,
  DispatchMetrics,
  UserRole,
  CreateAssignmentInput,
  TransitionStatusInput,
  AssignResourceInput,
  FilterAssignmentsInput,
  EligibleResource,
} from './types';
import {
  getAssignmentsServerFn,
  getDispatchMetricsServerFn,
  createAssignmentServerFn,
  transitionStatusServerFn,
  assignResourceServerFn,
  addCommentServerFn,
  resetSimulationAssignmentsServerFn,
  getCandidateResourcesServerFn,
} from './server';
import { dispatchRealtime } from './realtime';
import { toast } from 'sonner';

interface DispatchStoreContextType {
  assignments: Assignment[];
  selectedAssignment: Assignment | null;
  metrics: DispatchMetrics | null;
  activeRole: UserRole;
  filters: FilterAssignmentsInput;
  isLoading: boolean;
  isSubmitting: boolean;
  candidateResources: EligibleResource[];
  setRole: (role: UserRole) => void;
  setFilters: (update: Partial<FilterAssignmentsInput>) => void;
  selectAssignment: (id: string | null) => void;
  refresh: () => Promise<void>;
  createAssignment: (input: CreateAssignmentInput) => Promise<Assignment | null>;
  transitionStatus: (targetStatus: any, reason?: string | null, completionSummary?: string | null) => Promise<boolean>;
  assignResource: (resource: EligibleResource, reason?: string | null) => Promise<boolean>;
  addComment: (comment: string) => Promise<boolean>;
  runScenario: (scenarioKey: string) => Promise<void>;
  resetSimulation: () => Promise<void>;
  fetchCandidates: (assignment: Assignment) => Promise<void>;
}

const DispatchContext = createContext<DispatchStoreContextType | undefined>(undefined);

export function DispatchProvider({ children }: { children: React.ReactNode }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DispatchMetrics | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('city_operator');
  const [filters, setFiltersState] = useState<FilterAssignmentsInput>({
    include_simulated: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [candidateResources, setCandidateResources] = useState<EligibleResource[]>([]);

  const selectedAssignment = assignments.find((a) => a.id === selectedId) || null;

  const setFilters = useCallback((update: Partial<FilterAssignmentsInput>) => {
    setFiltersState((prev) => ({ ...prev, ...update }));
  }, []);

  const selectAssignment = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listRes, metricsRes]: [any, any] = await Promise.all([
        getAssignmentsServerFn({ data: filters }),
        getDispatchMetricsServerFn(),
      ]);
      setAssignments(listRes?.assignments || []);
      setMetrics(metricsRes);
    } catch (err: any) {
      console.error('Failed to load dispatch records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Initial load & filter change reload
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time synchronization subscription
  useEffect(() => {
    const unsub = dispatchRealtime.subscribe((msg) => {
      // Re-fetch state on mutation from other tabs
      refresh();
    });
    return unsub;
  }, [refresh]);

  // Fetch candidates for selected assignment
  const fetchCandidates = useCallback(async (assignment: Assignment) => {
    try {
      const res: any = await getCandidateResourcesServerFn({
        data: {
          category: assignment.category,
          assignmentType: assignment.assignment_type,
          lat: assignment.latitude,
          lng: assignment.longitude,
          capability: assignment.required_capability,
        },
      });
      setCandidateResources(Array.isArray(res) ? res : []);
    } catch (e) {
      console.warn('Candidate resource fetch failed:', e);
    }
  }, []);

  useEffect(() => {
    if (selectedAssignment) {
      fetchCandidates(selectedAssignment);
    } else {
      setCandidateResources([]);
    }
  }, [selectedAssignment?.id, fetchCandidates]);

  // Create Assignment
  const createAssignment = useCallback(
    async (input: CreateAssignmentInput): Promise<Assignment | null> => {
      setIsSubmitting(true);
      try {
        const created: any = await createAssignmentServerFn({ data: input });
        toast.success(`Assignment ${created.id} created successfully!`);
        dispatchRealtime.broadcast('assignment.created', created.id);
        await refresh();
        setSelectedId(created.id);
        return created as Assignment;
      } catch (err: any) {
        toast.error(err.message || 'Failed to create assignment.');
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh]
  );

  // Transition Status
  const transitionStatus = useCallback(
    async (targetStatus: any, reason?: string | null, completionSummary?: string | null): Promise<boolean> => {
      if (!selectedAssignment) return false;
      setIsSubmitting(true);

      const actorName =
        activeRole === 'city_operator'
          ? 'Kochi Central Operator'
          : activeRole === 'traffic_supervisor'
            ? 'Inspector Rajesh Kumar'
            : activeRole === 'dispatch_coordinator'
              ? 'CI Thomas Joseph'
              : activeRole === 'field_lead'
                ? 'Field Team Lead'
                : 'Observer';

      const payload: TransitionStatusInput = {
        assignment_id: selectedAssignment.id,
        target_status: targetStatus,
        actor_name: actorName,
        actor_role: activeRole,
        reason: reason || null,
        completion_summary: completionSummary || null,
        expected_version: selectedAssignment.version,
      };

      try {
        const updated: any = await transitionStatusServerFn({ data: payload });
        toast.success(`Assignment status updated to '${targetStatus}'.`);
        dispatchRealtime.broadcast('assignment.status_changed', updated.id);
        await refresh();
        return true;
      } catch (err: any) {
        toast.error(err.message || 'Transition rejected.');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedAssignment, activeRole, refresh]
  );

  // Assign Resource
  const assignResource = useCallback(
    async (resource: EligibleResource, reason?: string | null): Promise<boolean> => {
      if (!selectedAssignment) return false;
      setIsSubmitting(true);

      const payload: AssignResourceInput = {
        assignment_id: selectedAssignment.id,
        resource_id: resource.id,
        resource_name: resource.name,
        team_name: resource.base_station,
        actor_name: 'Dispatch Coordinator',
        actor_role: activeRole,
        reason: reason || `Allocated ${resource.name} via candidate scoring (${resource.match_score}%)`,
        expected_version: selectedAssignment.version,
      };

      try {
        const updated: any = await assignResourceServerFn({ data: payload });
        toast.success(`Allocated ${resource.name} to ${updated.id}.`);
        dispatchRealtime.broadcast('assignment.assigned', updated.id);
        await refresh();
        return true;
      } catch (err: any) {
        toast.error(err.message || 'Resource assignment failed.');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedAssignment, activeRole, refresh]
  );

  // Add Comment
  const addComment = useCallback(
    async (commentText: string): Promise<boolean> => {
      if (!selectedAssignment || !commentText.trim()) return false;

      const actorName =
        activeRole === 'city_operator'
          ? 'Kochi Central Operator'
          : activeRole === 'traffic_supervisor'
            ? 'Inspector Rajesh Kumar'
            : 'Operational Coordinator';

      try {
        await addCommentServerFn({
          data: {
            assignment_id: selectedAssignment.id,
            author_name: actorName,
            author_role: activeRole,
            comment: commentText.trim(),
          },
        });
        toast.success('Internal note added.');
        dispatchRealtime.broadcast('assignment.comment_added', selectedAssignment.id);
        await refresh();
        return true;
      } catch (err: any) {
        toast.error('Failed to post note.');
        return false;
      }
    },
    [selectedAssignment, activeRole, refresh]
  );

  // Demonstration Scenarios
  const runScenario = useCallback(
    async (scenarioKey: string) => {
      setIsSubmitting(true);
      try {
        if (scenarioKey === 'accident') {
          await createAssignmentServerFn({
            data: {
              title: '[DEMO SCENARIO A] Emergency ALS Dispatch: MG Road Bus Collision',
              description: 'Multi-passenger KSRTC bus collided with divider on MG Road. 4 severe injuries reported. Priority triage requested.',
              assignment_type: 'ambulance_dispatch',
              category: 'medical',
              priority: 'critical',
              location_name: 'MG Road North Junction, Kochi',
              latitude: 9.9722,
              longitude: 76.2828,
              department_id: 'Emergency Medical',
              required_capability: 'advanced_life_support',
              requires_approval: false,
              target_response_sec: 480,
              source: 'simulation',
              is_simulated: true,
            },
          });
          await createAssignmentServerFn({
            data: {
              title: '[DEMO SCENARIO A] Traffic Police Diversion: MG Road',
              description: 'Deploy central traffic flying squad to divert traffic via Banerji Road and secure lane clearance.',
              assignment_type: 'traffic_diversion',
              category: 'police',
              priority: 'high',
              location_name: 'MG Road North Junction, Kochi',
              latitude: 9.9722,
              longitude: 76.2828,
              department_id: 'Traffic Police',
              required_capability: 'traffic_diversion',
              requires_approval: false,
              target_response_sec: 600,
              source: 'simulation',
              is_simulated: true,
            },
          });
          toast.success('Scenario A triggered: Dual Emergency Medical & Police tasks generated!');
        } else if (scenarioKey === 'corridor') {
          await createAssignmentServerFn({
            data: {
              title: '[DEMO SCENARIO B] Green Wave Corridor: Kaloor -> Aster Medcity',
              description: 'Preempt 5 sequential traffic signal intersections along SA Road and NH-66 for critical ambulance transport.',
              assignment_type: 'emergency_corridor_request',
              category: 'traffic',
              priority: 'critical',
              location_name: 'Kaloor to Aster Medcity Corridor',
              latitude: 10.026,
              longitude: 76.3125,
              department_id: 'Traffic Operations',
              required_capability: 'traffic_diversion',
              requires_approval: true, // Needs supervisor approval
              target_response_sec: 300,
              source: 'simulation',
              is_simulated: true,
            },
          });
          toast.success('Scenario B triggered: Green Corridor Approval Task generated!');
        } else if (scenarioKey === 'stale_gps') {
          await createAssignmentServerFn({
            data: {
              title: '[DEMO SCENARIO C] Telemetry Verification: Ambulance M-02 Stale GPS',
              description: 'Ambulance M-02 has failed to send GPS heartbeat for > 180 seconds near Marine Drive. Initiate VHF voice verification.',
              assignment_type: 'ambulance_location_verification',
              category: 'medical',
              priority: 'high',
              location_name: 'Marine Drive Sector 3',
              latitude: 9.9800,
              longitude: 76.2735,
              department_id: 'Emergency Medical',
              required_capability: 'telemetry_uplink',
              requires_approval: false,
              target_response_sec: 180,
              source: 'simulation',
              is_simulated: true,
            },
          });
          toast.success('Scenario C triggered: Stale Telemetry Task created!');
        } else if (scenarioKey === 'civic_pothole') {
          await createAssignmentServerFn({
            data: {
              title: '[DEMO SCENARIO E] Citizen Civic Work Order: Edappally Culvert Blockage',
              description: 'Verified citizen report of collapsed storm drainage culvert causing 20cm road water accumulation.',
              assignment_type: 'drainage_inspection',
              category: 'municipal',
              priority: 'high',
              location_name: 'Edappally Toll Canal Road',
              latitude: 10.025,
              longitude: 76.309,
              department_id: 'Kochi Municipal Corporation',
              required_capability: 'culvert_clearing',
              requires_approval: true,
              target_response_sec: 3600,
              source: 'simulation',
              is_simulated: true,
            },
          });
          toast.success('Scenario E triggered: Civic Work Order generated!');
        } else if (scenarioKey === 'cctv_fault') {
          await createAssignmentServerFn({
            data: {
              title: '[DEMO SCENARIO F] Sensor Maintenance: Camera CAM-18 Feed Outage',
              description: 'RTSP video stream lost on Edappally NH-66 PTZ node. Technical maintenance crew required.',
              assignment_type: 'cctv_maintenance',
              category: 'infrastructure',
              priority: 'normal',
              location_name: 'NH-66 Edappally Flyover',
              latitude: 10.024,
              longitude: 76.308,
              department_id: 'Traffic Operations',
              required_capability: 'cctv_maintenance',
              requires_approval: false,
              target_response_sec: 7200,
              source: 'simulation',
              is_simulated: true,
            },
          });
          toast.success('Scenario F triggered: Deduplicated CCTV Maintenance Ticket created!');
        }

        dispatchRealtime.broadcast('assignment.created');
        await refresh();
      } catch (err: any) {
        toast.error('Failed to trigger scenario: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh]
  );

  // Reset Simulation Assignments
  const resetSimulation = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await resetSimulationAssignmentsServerFn();
      toast.success('Simulation assignments cleared! Ground-truth operational data preserved.');
      dispatchRealtime.broadcast('simulation.reset');
      await refresh();
      setSelectedId(null);
    } catch (err: any) {
      toast.error('Failed to reset simulation state.');
    } finally {
      setIsSubmitting(false);
    }
  }, [refresh]);

  return React.createElement(
    DispatchContext.Provider,
    {
      value: {
        assignments,
        selectedAssignment,
        metrics,
        activeRole,
        filters,
        isLoading,
        isSubmitting,
        candidateResources,
        setRole: setActiveRole,
        setFilters,
        selectAssignment,
        refresh,
        createAssignment,
        transitionStatus,
        assignResource,
        addComment,
        runScenario,
        resetSimulation,
        fetchCandidates,
      },
    },
    children
  );
}

export function useDispatchStore() {
  const context = useContext(DispatchContext);
  if (!context) {
    throw new Error('useDispatchStore must be used within a DispatchProvider');
  }
  return context;
}
