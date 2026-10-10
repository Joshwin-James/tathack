// Project Sentinel — Resource Directory & Allocation Engine
// Realistically calibrated for Kochi municipal and emergency infrastructure

import type { EligibleResource, AssignmentCategory, AssignmentType } from './types';

// Kochi coordinates benchmark
// Kundannoor: 9.9366, 76.3116 | Vytilla: 9.9678, 76.3218 | Edappally: 10.0250, 76.3090 | Marine Drive: 9.9800, 76.2735

export const KOCHI_RESOURCES: EligibleResource[] = [
  // --- Emergency Medical Fleet ---
  {
    id: 'RES-AMB-K14',
    name: 'ALS Ambulance K-14 (KL-07-CC-4821)',
    code: 'K-14',
    type: 'ambulance',
    department: 'Emergency Medical',
    status: 'available',
    capabilities: ['advanced_life_support', 'ventilator', 'trauma_kit', 'telemetry_uplink'],
    base_station: 'Medical Trust Hospital Emergency Hub',
    current_location: { lat: 9.9622, lng: 76.2941, name: 'Medical Trust Hospital, SA Road' },
    location_updated_at: new Date(Date.now() - 35000).toISOString(), // Fresh (35s ago)
    is_stale_location: false,
    current_active_tasks: 0,
    match_score: 98,
    match_reason: 'Dedicated ALS unit stationed 1.4km from Kundannoor corridor. Telemetry active.',
    contact_channel: 'VHF Ch-4 (156.800 MHz)',
  },
  {
    id: 'RES-AMB-A12',
    name: 'Aster Trauma Rig A-12 (KL-07-BT-1102)',
    code: 'A-12',
    type: 'ambulance',
    department: 'Emergency Medical',
    status: 'available',
    capabilities: ['advanced_life_support', 'icu_transfer', 'pediatric_support'],
    base_station: 'Aster Medcity Emergency Dept',
    current_location: { lat: 10.0267, lng: 76.2736, name: 'Aster Medcity Cheranalloor' },
    location_updated_at: new Date(Date.now() - 45000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 1,
    match_score: 92,
    match_reason: 'High-capability mobile ICU; primary receiving hospital Aster Medcity.',
    contact_channel: 'VHF Ch-4 (156.800 MHz)',
  },
  {
    id: 'RES-AMB-M02',
    name: 'Standby Ambulance M-02 (KL-07-BN-8840)',
    code: 'M-02',
    type: 'ambulance',
    department: 'Emergency Medical',
    status: 'available',
    capabilities: ['basic_life_support', 'first_aid', 'patient_transport'],
    base_station: 'General Hospital Ernakulam',
    current_location: { lat: 9.9800, lng: 76.2735, name: 'Marine Drive Waterfront Walkway' },
    location_updated_at: new Date(Date.now() - 180000).toISOString(), // 3 mins ago (>120s => Stale GPS!)
    is_stale_location: true,
    current_active_tasks: 0,
    match_score: 84,
    match_reason: 'Stationed near Marine Drive; GPS telemetry is stale (flagged for verification).',
    contact_channel: 'VHF Ch-7 (162.400 MHz)',
  },

  // --- Police & Traffic Management ---
  {
    id: 'RES-POL-P4',
    name: 'Panangad Traffic Patrol Unit P-4',
    code: 'P-4',
    type: 'police_patrol',
    department: 'Traffic Police',
    status: 'available',
    capabilities: ['traffic_diversion', 'accident_security', 'green_corridor_escort'],
    base_station: 'Panangad Police Station',
    current_location: { lat: 9.9366, lng: 76.3116, name: 'Kundannoor Flyover Base' },
    location_updated_at: new Date(Date.now() - 20000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 0,
    match_score: 99,
    match_reason: 'Stationed directly at Kundannoor junction. Immediate on-scene deployment.',
    contact_channel: 'VHF Ch-4 (156.800 MHz)',
  },
  {
    id: 'RES-POL-P2',
    name: 'Edappally Flying Squad P-2',
    code: 'P-2',
    type: 'police_patrol',
    department: 'Traffic Police',
    status: 'busy',
    capabilities: ['highway_patrol', 'crowd_control', 'radar_enforcement'],
    base_station: 'Edappally Police Station',
    current_location: { lat: 10.0250, lng: 76.3090, name: 'NH-66 Edappally Toll' },
    location_updated_at: new Date(Date.now() - 50000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 1,
    match_score: 75,
    match_reason: 'Currently engaged in NH-66 container truck perimeter control.',
    contact_channel: 'VHF Ch-2 (154.200 MHz)',
  },
  {
    id: 'RES-POL-P1',
    name: 'Central Police Station Rapid Team P-1',
    code: 'P-1',
    type: 'police_patrol',
    department: 'Police',
    status: 'available',
    capabilities: ['crowd_control', 'vip_movement', 'scene_security'],
    base_station: 'Central Police Station, Shanmugham Rd',
    current_location: { lat: 9.9750, lng: 76.2800, name: 'MG Road North' },
    location_updated_at: new Date(Date.now() - 15000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 0,
    match_score: 94,
    match_reason: 'Rapid response team for central commercial corridor.',
    contact_channel: 'VHF Ch-7 (162.400 MHz)',
  },

  // --- Fire & Rescue ---
  {
    id: 'RES-FIRE-F1',
    name: 'Rescue Tender F-1 & Squad',
    code: 'F-1',
    type: 'fire_tender',
    department: 'Fire & Rescue',
    status: 'available',
    capabilities: ['hydraulic_cutters', 'heavy_extrication', 'fire_suppression', 'flood_rescue'],
    base_station: 'Gandhinagar Fire Command',
    current_location: { lat: 9.9890, lng: 76.3010, name: 'Gandhinagar Main Fire Station' },
    location_updated_at: new Date(Date.now() - 25000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 0,
    match_score: 96,
    match_reason: 'Equipped with Holmatro hydraulic extraction tools and foam sprayers.',
    contact_channel: 'VHF Ch-1 (151.600 MHz)',
  },
  {
    id: 'RES-FIRE-P4',
    name: 'High-Capacity Dewatering Pump Unit P-4',
    code: 'P-4-PUMP',
    type: 'fire_tender',
    department: 'Fire & Rescue',
    status: 'available',
    capabilities: ['high_volume_pumping', 'canal_dewatering', 'monsoon_response'],
    base_station: 'High Court Road Fire Post',
    current_location: { lat: 9.9820, lng: 76.2750, name: 'High Court Marine Drive Jetty' },
    location_updated_at: new Date(Date.now() - 30000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 0,
    match_score: 97,
    match_reason: 'High-discharge diesel dewatering pump (4,000 LPM) for lowlands.',
    contact_channel: 'VHF Ch-7 (162.400 MHz)',
  },

  // --- Municipal Operations & PWD ---
  {
    id: 'RES-MUN-M1',
    name: 'Kochi Corp Drainage Jetting Crew M-1',
    code: 'M-1',
    type: 'municipal_crew',
    department: 'Kochi Municipal Corporation',
    status: 'available',
    capabilities: ['culvert_clearing', 'suction_jetting', 'manhole_inspection'],
    base_station: 'Corporation Engineering Yard, Kaloor',
    current_location: { lat: 9.9980, lng: 76.2925, name: 'Kaloor Basin Yard' },
    location_updated_at: new Date(Date.now() - 40000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 0,
    match_score: 95,
    match_reason: 'Super Sucker jetting vehicle with 8-ton waste containment.',
    contact_channel: 'City Ops Dispatch (144.250 MHz)',
  },
  {
    id: 'RES-PWD-R3',
    name: 'PWD Rapid Road Repair Unit R-3',
    code: 'R-3',
    type: 'municipal_crew',
    department: 'PWD Roads Division',
    status: 'available',
    capabilities: ['cold_mix_patching', 'pothole_compactor', 'barricade_placement'],
    base_station: 'PWD Sub-Division Yard, Edappally',
    current_location: { lat: 10.0150, lng: 76.3100, name: 'Palarivattom Bypass Yard' },
    location_updated_at: new Date(Date.now() - 60000).toISOString(),
    is_stale_location: false,
    current_active_tasks: 1,
    match_score: 89,
    match_reason: 'Rapid cold asphalt mix patching crew with roller compactor.',
    contact_channel: 'PWD Dispatch Tel #0484-2422001',
  },

  // --- CCTV Optical & TMC Desk ---
  {
    id: 'RES-TMC-C1',
    name: 'TMC Optical Analysis Station C-1',
    code: 'TMC-C1',
    type: 'cctv_station',
    department: 'Traffic Operations',
    status: 'available',
    capabilities: ['neural_review', 'ptz_tracking', 'stalled_vehicle_verification'],
    base_station: 'Kochi Smart City TMC, Kakkanad',
    current_location: { lat: 10.0159, lng: 76.3533, name: 'Kakkanad Command Center' },
    location_updated_at: new Date().toISOString(),
    is_stale_location: false,
    current_active_tasks: 0,
    match_score: 100,
    match_reason: 'Direct fiber connection to Vytilla and Kundannoor PTZ camera matrices.',
    contact_channel: 'Internal VoIP Console #401',
  },
];

// Helper: Calculate distance in kilometers using Haversine formula
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Resource ranking algorithm
export function evaluateCandidateResources(
  category: AssignmentCategory,
  assignmentType: AssignmentType,
  targetLat?: number | null,
  targetLng?: number | null,
  requiredCapability?: string | null
): EligibleResource[] {
  return KOCHI_RESOURCES.map((resource) => {
    let score = 50;
    const reasons: string[] = [];

    // 1. Department & Type matching
    if (
      (category === 'medical' && resource.type === 'ambulance') ||
      (category === 'police' && resource.type === 'police_patrol') ||
      (category === 'fire' && resource.type === 'fire_tender') ||
      (category === 'municipal' && resource.type === 'municipal_crew') ||
      (category === 'cctv' && resource.type === 'cctv_station')
    ) {
      score += 30;
      reasons.push(`Direct capability match for ${category} operations`);
    }

    // 2. Capability matching
    if (requiredCapability && resource.capabilities.includes(requiredCapability)) {
      score += 15;
      reasons.push(`Certified for '${requiredCapability}'`);
    }

    // 3. Availability penalty
    if (resource.status === 'busy') {
      score -= 20;
      reasons.push('Currently assigned to another active task');
    } else if (resource.status === 'available') {
      score += 10;
      reasons.push('Unit is ready for immediate deployment');
    }

    // 4. Proximity calculation
    if (targetLat && targetLng && resource.current_location) {
      const dist = calculateDistanceKm(
        targetLat,
        targetLng,
        resource.current_location.lat,
        resource.current_location.lng
      );
      if (dist < 2.5) {
        score += 15;
        reasons.push(`High proximity (${dist.toFixed(1)} km away)`);
      } else if (dist < 6.0) {
        score += 8;
        reasons.push(`Moderate proximity (${dist.toFixed(1)} km away)`);
      } else {
        score -= 5;
        reasons.push(`Estimated transit distance ${dist.toFixed(1)} km`);
      }
    }

    // 5. GPS Freshness check
    if (resource.is_stale_location) {
      score -= 10;
      reasons.push('Warning: Telemetry is stale (>120s old)');
    }

    const finalScore = Math.max(10, Math.min(99, score));
    return {
      ...resource,
      match_score: finalScore,
      match_reason: reasons.join('. ') + '.',
    };
  }).sort((a, b) => b.match_score - a.match_score);
}
