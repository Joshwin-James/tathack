// Project Sentinel — Unified Dispatch and Work Assignment Engine Workspace
// Route: /dispatch

import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { AppShell } from '@/components/app-shell';
import { GlassCard, MetricTile, SectionHeader, SeverityChip, LiveBadge } from '@/components/ui-kit';
import {
  DispatchProvider,
  useDispatchStore,
  Assignment,
  AssignmentStatus,
  AssignmentPriority,
  UserRole,
  EligibleResource,
  CreateAssignmentInput,
} from '@/lib/dispatch';
import {
  Siren,
  Shield,
  Search,
  Filter,
  Plus,
  Play,
  RotateCcw,
  Clock,
  MapPin,
  Car,
  AlertTriangle,
  CheckCircle2,
  Check,
  X,
  ChevronRight,
  UserCheck,
  Building2,
  Activity,
  Radio,
  FileText,
  Sliders,
  Sparkles,
  ArrowRight,
  Flame,
  Droplets,
  Layers,
  Send,
  MessageSquare,
  Lock,
  Unlock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSentinelStore } from '@/lib/store';

export const Route = createFileRoute('/dispatch')({
  head: () => ({
    meta: [
      { title: 'Unified Dispatch & Work Assignments · Kochi | Project Sentinel' },
      {
        name: 'description',
        content:
          'Unified operational dispatch and assignment engine for emergency medical, traffic police, fire rescue, and municipal work orders across Kochi.',
      },
    ],
  }),
  component: DispatchPageWrapper,
});

function DispatchPageWrapper() {
  return (
    <DispatchProvider>
      <DispatchPage />
    </DispatchProvider>
  );
}

function getPriorityColor(priority: AssignmentPriority) {
  switch (priority) {
    case 'critical':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    case 'high':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'normal':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'low':
      return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function getStatusBadge(status: AssignmentStatus) {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: 'bg-slate-800 text-slate-400' };
    case 'pending_validation':
      return { label: 'Validating', color: 'bg-indigo-950 text-indigo-400 border border-indigo-800' };
    case 'pending_approval':
      return { label: 'Pending Approval', color: 'bg-amber-950/80 text-amber-300 border border-amber-600 animate-pulse' };
    case 'approved':
      return { label: 'Approved', color: 'bg-emerald-950 text-emerald-400 border border-emerald-700' };
    case 'assigned':
      return { label: 'Assigned', color: 'bg-blue-950 text-blue-400 border border-blue-700' };
    case 'acknowledged':
      return { label: 'Acknowledged', color: 'bg-cyan-950 text-cyan-400 border border-cyan-700' };
    case 'in_progress':
      return { label: 'In Progress', color: 'bg-teal-950 text-teal-300 border border-teal-500 animate-pulse' };
    case 'blocked':
      return { label: 'BLOCKED', color: 'bg-destructive text-white font-bold' };
    case 'escalated':
      return { label: 'ESCALATED', color: 'bg-rose-950 text-rose-300 border border-rose-600 font-bold' };
    case 'completed':
      return { label: 'Completed', color: 'bg-emerald-900/60 text-emerald-300 border border-emerald-500' };
    case 'pending_verification':
      return { label: 'Verification', color: 'bg-purple-950 text-purple-300 border border-purple-700' };
    case 'closed':
      return { label: 'Closed (Audited)', color: 'bg-slate-900 text-slate-400 border border-slate-700' };
    case 'rejected':
      return { label: 'Rejected', color: 'bg-red-950 text-red-400' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'bg-slate-900 text-slate-500' };
    default:
      return { label: status, color: 'bg-slate-800 text-slate-300' };
  }
}

function DispatchPage() {
  const {
    assignments,
    selectedAssignment,
    metrics,
    activeRole,
    filters,
    isLoading,
    isSubmitting,
    candidateResources,
    setRole,
    setFilters,
    selectAssignment,
    refresh,
    createAssignment,
    transitionStatus,
    assignResource,
    addComment,
    runScenario,
    resetSimulation,
  } = useDispatchStore();

  const { incidents } = useSentinelStore();

  const [activeTab, setActiveTab] = useState<'queue' | 'board' | 'resources' | 'scenarios'>('queue');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [statusReason, setStatusReason] = useState('');

  // Form State for New Assignment
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<any>('medical');
  const [newType, setNewType] = useState<any>('ambulance_dispatch');
  const [newPriority, setNewPriority] = useState<AssignmentPriority>('high');
  const [newDept, setNewDept] = useState('Emergency Medical');
  const [newLocation, setNewLocation] = useState('Kundannoor Junction, Kochi');
  const [newIncidentId, setNewIncidentId] = useState('');
  const [newCapability, setNewCapability] = useState('advanced_life_support');
  const [newRequiresApproval, setNewRequiresApproval] = useState(false);
  const [newTargetSla, setNewTargetSla] = useState(600);

  // Search filter handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: e.target.value });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim()) return;

    await createAssignment({
      title: newTitle.trim(),
      description: newDesc.trim(),
      category: newCategory,
      assignment_type: newType,
      priority: newPriority,
      department_id: newDept,
      location_name: newLocation.trim(),
      incident_id: newIncidentId || null,
      required_capability: newCapability || null,
      requires_approval: newRequiresApproval,
      target_response_sec: Number(newTargetSla),
      source: 'human',
      is_simulated: false,
    });

    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-rise">
        {/* Top Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Operations · Respond</p>
              <LiveBadge label="Engine Active" />
            </div>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight lg:text-4xl flex items-center gap-3">
              <Siren className="size-8 text-primary animate-pulse" />
              Unified Dispatch & Work Assignment Engine
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Integrated operational dispatch, work orders, supervisory authorization, and outcome verification for Kochi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Role Switcher */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-1.5 soft-shadow text-xs">
              <UserCheck className="size-3.5 text-primary" />
              <span className="text-muted-foreground hidden sm:inline">Role:</span>
              <select
                value={activeRole}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
              >
                <option value="city_operator" className="bg-slate-900 text-white">City Operator</option>
                <option value="traffic_supervisor" className="bg-slate-900 text-white">Traffic Supervisor</option>
                <option value="dispatch_coordinator" className="bg-slate-900 text-white">Dispatch Coordinator</option>
                <option value="field_lead" className="bg-slate-900 text-white">Field Team Lead</option>
                <option value="read_only_observer" className="bg-slate-900 text-white">Observer (Read-Only)</option>
              </select>
            </div>

            {/* Create Assignment Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" />
              New Assignment
            </button>

            {/* Refresh */}
            <button
              onClick={() => refresh()}
              title="Refresh Queue"
              className="rounded-2xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn('size-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Operational Metrics Row (Data-backed) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricTile
            label="Total Open"
            value={String(metrics?.total_open ?? assignments.length)}
            hint="Active operations"
            tone="primary"
          />
          <MetricTile
            label="Critical Tasks"
            value={String(metrics?.critical_count ?? 0)}
            hint="P0 SLA priority"
            tone="danger"
          />
          <MetricTile
            label="Awaiting Approval"
            value={String(metrics?.awaiting_approval ?? 0)}
            hint="Supervisor gate"
            tone="warn"
          />
          <MetricTile
            label="In Progress"
            value={String(metrics?.in_progress_count ?? 0)}
            hint="Field units rolling"
            tone="primary"
          />
          <MetricTile
            label="Blocked / Escalated"
            value={String((metrics?.blocked_count ?? 0) + (metrics?.escalated_count ?? 0))}
            hint="Action required"
            tone="warn"
          />
          <MetricTile
            label="Completed Today"
            value={String(metrics?.completed_today ?? 0)}
            hint="Audited & verified"
            tone="success"
          />
        </div>

        {/* Main Workspace Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 soft-shadow">
            <button
              onClick={() => setActiveTab('queue')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'queue'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FileText className="size-3.5" />
              <span>Assignment Queue ({assignments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('board')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'board'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers className="size-3.5" />
              <span>Kanban Board</span>
            </button>

            <button
              onClick={() => setActiveTab('resources')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'resources'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Car className="size-3.5" />
              <span>Fleet & Units Directory</span>
            </button>

            <button
              onClick={() => setActiveTab('scenarios')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'scenarios'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-amber-400 hover:text-amber-300'
              )}
            >
              <Sparkles className="size-3.5" />
              <span>Demo Scenarios (A-G)</span>
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ID, title, unit..."
                value={filters.search || ''}
                onChange={handleSearchChange}
                className="w-full rounded-2xl border border-border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>

            <select
              value={filters.priority || ''}
              onChange={(e) => setFilters({ priority: e.target.value || undefined })}
              className="rounded-2xl border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground outline-none"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filters.department || ''}
              onChange={(e) => setFilters({ department: e.target.value || undefined })}
              className="rounded-2xl border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground outline-none"
            >
              <option value="">All Departments</option>
              <option value="Emergency Medical">Medical</option>
              <option value="Traffic Police">Police</option>
              <option value="Fire & Rescue">Fire</option>
              <option value="Municipal">Municipal / PWD</option>
              <option value="Traffic Operations">Traffic Ops</option>
            </select>
          </div>
        </div>

        {/* --- TAB 1: QUEUE LIST VIEW --- */}
        {activeTab === 'queue' && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left 2 Cols: Table */}
            <div className="lg:col-span-2 space-y-3">
              <GlassCard className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-3 px-3">ID / Ref</th>
                        <th className="py-3 px-3">Title & Location</th>
                        <th className="py-3 px-3">Priority</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Assigned Unit</th>
                        <th className="py-3 px-3 text-right">Age / SLA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {assignments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
                            No assignments matching criteria.
                          </td>
                        </tr>
                      ) : (
                        assignments.map((item) => {
                          const status = getStatusBadge(item.status);
                          const isSelected = selectedAssignment?.id === item.id;
                          return (
                            <tr
                              key={item.id}
                              onClick={() => selectAssignment(item.id)}
                              className={cn(
                                'cursor-pointer transition-colors',
                                isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40'
                              )}
                            >
                              <td className="py-3 px-3 font-mono font-bold text-primary">
                                {item.id}
                                <div className="text-[10px] font-normal text-muted-foreground">
                                  {item.reference_code}
                                </div>
                              </td>

                              <td className="py-3 px-3 max-w-[220px]">
                                <div className="truncate font-medium text-foreground">{item.title}</div>
                                <div className="truncate text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="size-2.5 text-muted-foreground" />
                                  <span>{item.location_name}</span>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                                    getPriorityColor(item.priority)
                                  )}
                                >
                                  {item.priority}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                    status.color
                                  )}
                                >
                                  {status.label}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                {item.assigned_unit_name ? (
                                  <div className="truncate text-foreground font-medium flex items-center gap-1">
                                    <Car className="size-3 text-cyan-400" />
                                    <span>{item.assigned_unit_name.split('(')[0]}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic">Unassigned</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right font-mono text-[10px] text-muted-foreground">
                                {new Date(item.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {item.is_simulated && (
                                  <div className="text-[9px] text-amber-400 font-semibold uppercase">Simulated</div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>

            {/* Right Col: Assignment Detail Drawer */}
            <div className="lg:col-span-1">
              {selectedAssignment ? (
                <GlassCard className="sticky top-4 space-y-4">
                  {/* Detail Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{selectedAssignment.id}</span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                            getPriorityColor(selectedAssignment.priority)
                          )}
                        >
                          {selectedAssignment.priority}
                        </span>
                        {selectedAssignment.is_simulated && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase">
                            Demo Mode
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 font-display text-base font-semibold text-foreground leading-snug">
                        {selectedAssignment.title}
                      </h2>
                    </div>

                    <button
                      onClick={() => selectAssignment(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Status Banner & Action Workflow */}
                  <div className="rounded-2xl border border-border bg-secondary/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Current Status:</span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold',
                          getStatusBadge(selectedAssignment.status).color
                        )}
                      >
                        {getStatusBadge(selectedAssignment.status).label}
                      </span>
                    </div>

                    {/* Dynamic Action Buttons based on Legal State Transitions */}
                    <div className="pt-2 border-t border-border flex flex-wrap gap-2">
                      {/* Approve button */}
                      {selectedAssignment.status === 'pending_approval' && (
                        <button
                          onClick={() => transitionStatus('approved', 'Supervisor verification passed')}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-1.5 text-center text-xs font-bold text-white transition-colors"
                        >
                          Approve Dispatch
                        </button>
                      )}

                      {/* Reject button */}
                      {['pending_approval', 'pending_validation'].includes(selectedAssignment.status) && (
                        <button
                          onClick={() => {
                            const r = prompt('Reason for rejection:');
                            if (r) transitionStatus('rejected', r);
                          }}
                          disabled={isSubmitting}
                          className="rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors"
                        >
                          Reject
                        </button>
                      )}

                      {/* Assign Resource button */}
                      {['approved', 'pending_approval', 'assigned'].includes(selectedAssignment.status) && (
                        <button
                          onClick={() => setShowAssignModal(true)}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-primary hover:bg-primary/90 py-1.5 text-center text-xs font-semibold text-primary-foreground transition-colors"
                        >
                          {selectedAssignment.assigned_unit_name ? 'Reassign Unit' : 'Assign Resource'}
                        </button>
                      )}

                      {/* Acknowledge button */}
                      {selectedAssignment.status === 'assigned' && (
                        <button
                          onClick={() => transitionStatus('acknowledged', 'Unit received coordinates')}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-1.5 text-center text-xs font-bold text-white transition-colors"
                        >
                          Acknowledge Receipt
                        </button>
                      )}

                      {/* Start Work button */}
                      {['assigned', 'acknowledged'].includes(selectedAssignment.status) && (
                        <button
                          onClick={() => transitionStatus('in_progress', 'Unit deployed on-scene')}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-500 py-1.5 text-center text-xs font-bold text-white transition-colors"
                        >
                          Start Operation
                        </button>
                      )}

                      {/* Blocked button */}
                      {selectedAssignment.status === 'in_progress' && (
                        <button
                          onClick={() => {
                            const r = prompt('State reason for blockage (e.g. road flooded, equipment failure):');
                            if (r) transitionStatus('blocked', r);
                          }}
                          disabled={isSubmitting}
                          className="rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors"
                        >
                          Report Blocked
                        </button>
                      )}

                      {/* Complete Work button */}
                      {selectedAssignment.status === 'in_progress' && (
                        <button
                          onClick={() => {
                            const s = prompt('Enter completion summary / patient handover note:');
                            transitionStatus('completed', 'Operation completed on-site', s);
                          }}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-1.5 text-center text-xs font-bold text-white transition-colors"
                        >
                          Complete Operation
                        </button>
                      )}

                      {/* Verify & Close button */}
                      {['completed', 'pending_verification'].includes(selectedAssignment.status) && (
                        <button
                          onClick={() => transitionStatus('closed', 'Supervisory verification confirmed completion')}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 py-1.5 text-center text-xs font-bold text-white transition-colors"
                        >
                          Verify & Close Task
                        </button>
                      )}

                      {/* Reopen button */}
                      {selectedAssignment.status === 'closed' && (
                        <button
                          onClick={() => {
                            const r = prompt('Reason for reopening audited task:');
                            if (r) transitionStatus('in_progress', r);
                          }}
                          disabled={isSubmitting}
                          className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Reopen Task
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task Instructions & Info */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Description & Instructions
                      </p>
                      <p className="mt-1 text-foreground leading-relaxed">{selectedAssignment.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Department</p>
                        <p className="font-medium text-foreground">{selectedAssignment.department_id}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Target SLA</p>
                        <p className="font-mono font-medium text-foreground">
                          {Math.round((selectedAssignment.target_response_sec || 900) / 60)} mins
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Location</p>
                        <p className="font-medium text-foreground truncate">{selectedAssignment.location_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Assigned Unit</p>
                        <p className="font-medium text-primary truncate">
                          {selectedAssignment.assigned_unit_name || 'None'}
                        </p>
                      </div>
                    </div>

                    {/* Linked Incident */}
                    {selectedAssignment.incident_id && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-[10px] text-muted-foreground">Linked Incident Record</p>
                        <Link
                          to="/alerts"
                          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                          <Shield className="size-3.5" />
                          <span>Incident #{selectedAssignment.incident_id} (View in Alerts)</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Append-Only Audit Trail */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>Audit Event Trail ({selectedAssignment.events?.length || 0})</span>
                    </p>

                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1 text-[11px]">
                      {selectedAssignment.events?.map((evt) => (
                        <div key={evt.id} className="rounded-xl border border-border/70 bg-card p-2 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{evt.actor_name}</span>
                            <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-foreground">
                            {evt.event_type}: <span className="font-mono text-primary">{evt.to_status}</span>
                          </p>
                          {evt.reason && <p className="text-[10px] text-slate-400 italic">"{evt.reason}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Operational Notes / Comments */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      <span>Operational Notes</span>
                    </p>

                    <div className="space-y-1.5">
                      {selectedAssignment.comments?.map((c) => (
                        <div key={c.id} className="rounded-xl bg-secondary/50 p-2 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{c.author_name}</span>
                            <span>{new Date(c.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="mt-1 text-foreground">{c.comment}</p>
                        </div>
                      ))}

                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="Add internal dispatch note..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && commentText.trim()) {
                              addComment(commentText);
                              setCommentText('');
                            }
                          }}
                          className="flex-1 rounded-xl border border-border bg-card px-2.5 py-1 text-xs text-foreground outline-none"
                        />
                        <button
                          onClick={() => {
                            if (commentText.trim()) {
                              addComment(commentText);
                              setCommentText('');
                            }
                          }}
                          className="rounded-xl bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <FileText className="size-10 stroke-1 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No Assignment Selected</p>
                  <p className="text-xs max-w-xs mt-1">
                    Select any task from the queue to inspect instructions, dispatch candidates, approval states, and audit trail.
                  </p>
                </GlassCard>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 2: KANBAN BOARD VIEW --- */}
        {activeTab === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { status: 'pending_approval', title: 'Pending Approval', border: 'border-amber-500/30' },
              { status: 'assigned', title: 'Assigned', border: 'border-blue-500/30' },
              { status: 'in_progress', title: 'In Progress', border: 'border-teal-500/30' },
              { status: 'blocked', title: 'Blocked / Escalated', border: 'border-destructive/30' },
              { status: 'completed', title: 'Completed & Audited', border: 'border-emerald-500/30' },
            ].map((col) => {
              const colItems = assignments.filter((a) => {
                if (col.status === 'blocked') return a.status === 'blocked' || a.status === 'escalated';
                if (col.status === 'completed') return a.status === 'completed' || a.status === 'closed';
                return a.status === col.status;
              });

              return (
                <div key={col.status} className={cn('rounded-2xl border bg-card p-3 space-y-2.5', col.border)}>
                  <div className="flex items-center justify-between pb-1 border-b border-border">
                    <span className="text-xs font-semibold text-foreground">{col.title}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {colItems.length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                    {colItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          selectAssignment(item.id);
                          setActiveTab('queue');
                        }}
                        className="rounded-xl border border-border bg-secondary/50 p-2.5 cursor-pointer hover:border-primary transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-primary">{item.id}</span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-1.5 text-[9px] font-bold uppercase',
                              getPriorityColor(item.priority)
                            )}
                          >
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2">{item.title}</p>
                        <div className="text-[10px] text-muted-foreground truncate">{item.location_name}</div>
                        {item.assigned_unit_name && (
                          <div className="text-[10px] text-cyan-400 truncate">
                            Unit: {item.assigned_unit_name.split('(')[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- TAB 3: FLEET & UNITS DIRECTORY --- */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            <SectionHeader
              title="Kochi Emergency Fleet & Work Teams Directory"
              hint="Verified telemetry and operational availability across Panangad, Medical Trust, Gandhinagar, and PWD bases."
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {candidateResources.length > 0 ? (
                candidateResources.map((res) => (
                  <GlassCard key={res.id} className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-primary">{res.code}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              res.status === 'available'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : res.status === 'busy'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-slate-700 text-slate-300'
                            )}
                          >
                            {res.status.toUpperCase()}
                          </span>
                        </div>
                        <h3 className="mt-1 font-semibold text-sm text-foreground">{res.name}</h3>
                      </div>
                    </div>

                    <div className="text-xs space-y-1 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building2 className="size-3 text-muted-foreground" />
                        <span>Base: {res.base_station}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3 text-muted-foreground" />
                        <span>Location: {res.current_location?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Radio className="size-3 text-muted-foreground" />
                        <span>Comms: {res.contact_channel}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>
                          Telemetry:{' '}
                          {res.is_stale_location ? (
                            <strong className="text-destructive">STALE (&gt;120s ago)</strong>
                          ) : (
                            <span className="text-emerald-400">Live (GPS Fresh)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex flex-wrap gap-1">
                      {res.capabilities.map((cap) => (
                        <span key={cap} className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </GlassCard>
                ))
              ) : (
                <div className="col-span-3 text-center py-8 text-muted-foreground">
                  Loading verified fleet resources...
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 4: DEMO SCENARIO RUNNER --- */}
        {activeTab === 'scenarios' && (
          <GlassCard className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionHeader
                  title="Hackathon End-to-End Test Scenarios (A - G)"
                  hint="Execute isolated operational simulations with distinct records and state transitions."
                />
              </div>
              <button
                onClick={() => resetSimulation()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
              >
                <RotateCcw className="size-3.5" />
                Reset Simulation Records
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Scenario A */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="rounded bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold">SCENARIO A</span>
                  <h4 className="mt-1.5 font-semibold text-sm">Emergency Collision Dual Dispatch</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accident on MG Road triggers dual medical and police response assignments with distinct IDs and lifecycles.
                  </p>
                </div>
                <button
                  onClick={() => runScenario('accident')}
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  Run Scenario A
                </button>
              </div>

              {/* Scenario B */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="rounded bg-amber-500/20 text-amber-400 px-2 py-0.5 text-[10px] font-bold">SCENARIO B</span>
                  <h4 className="mt-1.5 font-semibold text-sm">Green Wave Preemption Approval</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generates corridor clearance task requiring supervisor approval before signal wave preemption is authorized.
                  </p>
                </div>
                <button
                  onClick={() => runScenario('corridor')}
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-xl bg-amber-600 hover:bg-amber-500 py-2 text-xs font-semibold text-white"
                >
                  Run Scenario B
                </button>
              </div>

              {/* Scenario C */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="rounded bg-rose-500/20 text-rose-400 px-2 py-0.5 text-[10px] font-bold">SCENARIO C</span>
                  <h4 className="mt-1.5 font-semibold text-sm">Stale Ambulance GPS Flagging</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ambulance telemetry goes silent (&gt;120s). The engine honestly flags GPS as stale and creates VHF verification.
                  </p>
                </div>
                <button
                  onClick={() => runScenario('stale_gps')}
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-xs font-semibold text-white"
                >
                  Run Scenario C
                </button>
              </div>

              {/* Scenario E */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="rounded bg-teal-500/20 text-teal-400 px-2 py-0.5 text-[10px] font-bold">SCENARIO E</span>
                  <h4 className="mt-1.5 font-semibold text-sm">Citizen Triage to Municipal Order</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verified citizen drainage complaint automatically converted into a PWD culvert repair work order.
                  </p>
                </div>
                <button
                  onClick={() => runScenario('civic_pothole')}
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-xl bg-teal-600 hover:bg-teal-500 py-2 text-xs font-semibold text-white"
                >
                  Run Scenario E
                </button>
              </div>

              {/* Scenario F */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="rounded bg-indigo-500/20 text-indigo-400 px-2 py-0.5 text-[10px] font-bold">SCENARIO F</span>
                  <h4 className="mt-1.5 font-semibold text-sm">CCTV Sensor Deduplication</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Camera CAM-18 stream outage creates exactly one deduplicated maintenance ticket within 30-min window.
                  </p>
                </div>
                <button
                  onClick={() => runScenario('cctv_fault')}
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2 text-xs font-semibold text-white"
                >
                  Run Scenario F
                </button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* --- MODAL 1: CREATE ASSIGNMENT MODAL --- */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-lg bg-slate-950 border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Create New Operational Assignment</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Submit an authenticated operational task into the Kochi Unified Dispatch engine.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-medium text-foreground">Assignment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ALS Ambulance Dispatch: Marine Drive"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-foreground">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none"
                  >
                    <option value="medical">Medical (Ambulance)</option>
                    <option value="police">Police & Traffic</option>
                    <option value="fire">Fire & Rescue</option>
                    <option value="municipal">Municipal & PWD</option>
                    <option value="traffic">Traffic Operations</option>
                    <option value="cctv">CCTV & Verification</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as AssignmentPriority)}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none"
                  >
                    <option value="critical">Critical (P0)</option>
                    <option value="high">High (P1)</option>
                    <option value="normal">Normal (P2)</option>
                    <option value="low">Low (P3)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Location</label>
                <input
                  type="text"
                  required
                  placeholder="Kochi junction, road segment, landmark"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-foreground">Linked Incident (Optional)</label>
                  <select
                    value={newIncidentId}
                    onChange={(e) => setNewIncidentId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none"
                  >
                    <option value="">None (Independent Task)</option>
                    {incidents.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.id}: {i.title.slice(0, 30)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground">Target Response SLA</label>
                  <select
                    value={newTargetSla}
                    onChange={(e) => setNewTargetSla(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none"
                  >
                    <option value={480}>8 Minutes (Emergency ALS)</option>
                    <option value={600}>10 Minutes (Police Deployment)</option>
                    <option value={1800}>30 Minutes (Municipal Dewatering)</option>
                    <option value={7200}>2 Hours (Technical Maintenance)</option>
                    <option value={86400}>24 Hours (Road Pothole Patching)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Instructions & Context</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Operational orders, casualty counts, required equipment..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="reqAppr"
                  checked={newRequiresApproval}
                  onChange={(e) => setNewRequiresApproval(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="reqAppr" className="text-xs text-muted-foreground cursor-pointer">
                  Requires supervisor pre-authorization before dispatch
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Create & Submit
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* --- MODAL 2: ASSIGN RESOURCE MODAL --- */}
        <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
          <DialogContent className="sm:max-w-md bg-slate-950 border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="font-display text-base">Select Unit for {selectedAssignment?.id}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Ranked by proximity, certified capability, and live availability.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {candidateResources.map((res) => (
                <div
                  key={res.id}
                  className="rounded-xl border border-border bg-card p-3 space-y-2 hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">{res.code}</span>
                      <p className="text-xs font-medium text-foreground">{res.name}</p>
                    </div>
                    <span className="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-bold">
                      {res.match_score}% Match
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground">{res.match_reason}</p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">{res.base_station}</span>
                    <button
                      onClick={async () => {
                        await assignResource(res);
                        setShowAssignModal(false);
                      }}
                      className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Assign Unit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
