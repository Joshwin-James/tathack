// Seeded / Deterministic Patient Generator for Demo Missions
import { MissionPatient } from "./types";

const CONDITIONS: { condition: string; severity: "critical" | "high" | "moderate"; bp: string; hr: number; spo2: number; gcs: number }[] = [
  {
    condition: "Acute Anterior ST-Elevation Myocardial Infarction (STEMI)",
    severity: "critical",
    bp: "85/55 mmHg",
    hr: 118,
    spo2: 91,
    gcs: 14,
  },
  {
    condition: "Polytrauma with Suspected Hemothorax & Pelvic Fracture",
    severity: "critical",
    bp: "80/50 mmHg",
    hr: 132,
    spo2: 89,
    gcs: 11,
  },
  {
    condition: "Acute Ischemic Stroke (LVO - Thrombolysis Candidate, Onset <2h)",
    severity: "critical",
    bp: "185/105 mmHg",
    hr: 88,
    spo2: 96,
    gcs: 12,
  },
  {
    condition: "Severe Respiratory Failure / Acute Exacerbation of COPD",
    severity: "high",
    bp: "140/90 mmHg",
    hr: 110,
    spo2: 86,
    gcs: 15,
  },
  {
    condition: "Compound Lower Extremity Fracture with Active Arterial Hemorrhage",
    severity: "high",
    bp: "100/65 mmHg",
    hr: 104,
    spo2: 97,
    gcs: 15,
  },
];

const BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-"];
const AGES = [27, 34, 42, 51, 58, 64, 72];

export function generateMissionPatient(seed: number | string = 101): MissionPatient {
  const numericSeed =
    typeof seed === "number"
      ? seed
      : seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const condIdx = numericSeed % CONDITIONS.length;
  const c = CONDITIONS[condIdx];
  const blood = BLOOD_GROUPS[numericSeed % BLOOD_GROUPS.length];
  const age = AGES[(numericSeed * 3) % AGES.length];

  return {
    condition: c.condition,
    severity: c.severity,
    bloodGroup: blood,
    age,
    isSimulated: true,
    vitals: {
      bp: c.bp,
      heartRate: c.hr,
      spo2: c.spo2,
      gcs: c.gcs,
    },
  };
}

export const generateSimulatedPatient = generateMissionPatient;
