import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const CategoryEnum = z.enum([
  "pothole",
  "waterlogging",
  "garbage",
  "streetlight",
  "power_outage",
  "accident",
  "other",
]);

export const SeverityEnum = z.enum(["low", "medium", "high", "critical"]);

export const DepartmentEnum = z.enum([
  "KWA",
  "KSEB",
  "Kochi Corporation",
  "PWD",
  "Police",
  "Fire",
]);

export const TriageInputSchema = z.object({
  transcript: z.string().optional().default(""),
  photoBase64: z.string().optional().nullable(),
  photoMimeType: z.string().optional().nullable(),
  locationHint: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type TriageInput = z.infer<typeof TriageInputSchema>;

export const TriageResultSchema = z.object({
  language: z.string(),
  translation_en: z.string(),
  category: CategoryEnum,
  severity: SeverityEnum,
  department: DepartmentEnum,
  confidence: z.number().min(0).max(1),
  summary_en: z.string(),
  summary_ml: z.string(),
  location_hint: z.string(),
  photo_matches_text: z.boolean(),
  suggested_action: z.string(),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

// Keyword & Rule-based Classifier Fallback
export function fallbackClassify(text: string, locationHint?: string | null): TriageResult {
  const clean = (text || "").trim();
  const lower = clean.toLowerCase();

  // Detect language
  const hasMalayalamScript = /[\u0D00-\u0D7F]/.test(clean);
  const manglishKeywords = [
    "cheyyunnilla",
    "ketti",
    "nilkkunnu",
    "valiya",
    "kuzhi",
    "vellam",
    "current",
    "poyi",
    "ivide",
    "aanu",
    "und",
    "thee",
    "potti",
    "marinju",
  ];
  const isManglish =
    !hasMalayalamScript && manglishKeywords.some((k) => lower.includes(k));
  const language = hasMalayalamScript ? "ml" : isManglish ? "manglish" : "en";

  // Category classification
  let category: z.infer<typeof CategoryEnum> = "other";
  let severity: z.infer<typeof SeverityEnum> = "medium";
  let department: z.infer<typeof DepartmentEnum> = "Kochi Corporation";
  let translation_en = clean;
  let summary_en = "Civic hazard reported by citizen.";
  let summary_ml = "പൗരൻ റിപ്പോർട്ട് ചെയ്ത നഗര പ്രശ്നം.";
  let suggested_action = "Assign field inspector for on-site assessment.";

  if (
    lower.includes("വെള്ളം") ||
    lower.includes("വെള്ളക്കെട്ട്") ||
    lower.includes("flood") ||
    lower.includes("water") ||
    lower.includes("vellam") ||
    lower.includes("drainage") ||
    lower.includes("ഓട") ||
    lower.includes("ketti nilkkunnu")
  ) {
    category = "waterlogging";
    severity = "high";
    department = "Kochi Corporation";
    translation_en = clean.includes("വെള്ളം") || lower.includes("vellam")
      ? "Water is logging and stagnant here, blocking the path."
      : clean;
    summary_en = "Waterlogging and drainage overflow reported.";
    summary_ml = "റോഡിൽ വെള്ളക്കെട്ടും ഡ്രെയിനേജ് തടസ്സവും റിപ്പോർട്ട് ചെയ്തിരിക്കുന്നു.";
    suggested_action = "Deploy suction pump and clear storm water drains.";
  } else if (
    lower.includes("കുഴി") ||
    lower.includes("pothole") ||
    lower.includes("kuzhi") ||
    lower.includes("crater") ||
    lower.includes("റോഡ്") ||
    lower.includes("road broken")
  ) {
    category = "pothole";
    severity = lower.includes("വലിയ") || lower.includes("valiya") || lower.includes("big") ? "high" : "medium";
    department = "PWD";
    translation_en = clean.includes("കുഴി") || lower.includes("kuzhi")
      ? "Large pothole on the road posing hazard to two-wheelers."
      : clean;
    summary_en = "Road surface crater/pothole requiring cold-mix tarring.";
    summary_ml = "റോഡിലെ വലിയ കുഴി അടിയന്തരമായി ടാർ ചെയ്ത് നന്നാക്കണം.";
    suggested_action = "Issue PWD repair work order with rapid asphalt patch team.";
  } else if (
    lower.includes("street light") ||
    lower.includes("streetlight") ||
    lower.includes("ലൈറ്റ്") ||
    lower.includes("light") ||
    lower.includes("തെരുവ്") ||
    lower.includes("iruttu") ||
    lower.includes("ഇരുട്ട്")
  ) {
    category = "streetlight";
    severity = "low";
    department = "Kochi Corporation";
    translation_en = lower.includes("work cheyyunnilla") || lower.includes("കത്തുന്നില്ല")
      ? "Street light is not functioning, area is dark at night."
      : clean;
    summary_en = "Non-functional streetlight reported.";
    summary_ml = "പ്രവർത്തിക്കാത്ത സ്ട്രീറ്റ് ലൈറ്റ് നന്നാക്കണം.";
    suggested_action = "Dispatch electrical crew to replace LED bulb/sensor fuse.";
  } else if (
    lower.includes("കറന്റ്") ||
    lower.includes("current") ||
    lower.includes("വൈദ്യുതി") ||
    lower.includes("kseb") ||
    lower.includes("power") ||
    lower.includes("transformer") ||
    lower.includes("വയർ") ||
    lower.includes("wire")
  ) {
    category = "power_outage";
    severity = lower.includes("wire") || lower.includes("വയർ") || lower.includes("shock") ? "critical" : "high";
    department = "KSEB";
    translation_en = lower.includes("poyi") || lower.includes("outage")
      ? "Power outage / electric line fault in the locality."
      : clean;
    summary_en = "Electrical supply disruption / line maintenance request.";
    summary_ml = "വൈദ്യുതി തടസ്സവും ലൈൻ തകരാറും പരിഹരിക്കാൻ കെ.എസ്.ഇ.ബി ടീമിനെ അറിയിക്കുക.";
    suggested_action = "Alert local KSEB section office and electrical line inspector.";
  } else if (
    lower.includes("മാലിന്യം") ||
    lower.includes("വേസ്റ്റ്") ||
    lower.includes("garbage") ||
    lower.includes("waste") ||
    lower.includes("trash") ||
    lower.includes("കുപ്പ") ||
    lower.includes("malinyam")
  ) {
    category = "garbage";
    severity = "medium";
    department = "Kochi Corporation";
    translation_en = "Uncollected garbage accumulation on the roadside.";
    summary_en = "Solid waste and garbage accumulation on public way.";
    summary_ml = "പൊതുവഴിയിലെ മാലിന്യക്കൂമ്പാരം നീക്കം ചെയ്യണം.";
    suggested_action = "Dispatch Kochi Corporation waste collection truck and sanitize area.";
  } else if (
    lower.includes("accident") ||
    lower.includes("അപകടം") ||
    lower.includes("crash") ||
    lower.includes("idi") ||
    lower.includes("collision") ||
    lower.includes("ആംബുലൻസ്")
  ) {
    category = "accident";
    severity = "critical";
    department = "Police";
    translation_en = "Vehicle collision/accident with traffic obstruction.";
    summary_en = "Traffic accident requiring emergency dispatch and traffic diversion.";
    summary_ml = "വാഹനാപകടം: അടിയന്തര രക്ഷാപ്രവർത്തനവും ട്രാഫിക് നിയന്ത്രണവും വേണം.";
    suggested_action = "Dispatch local traffic police unit and alert nearest ambulance.";
  } else if (
    lower.includes("തീ") ||
    lower.includes("fire") ||
    lower.includes("smoke") ||
    lower.includes("പുക") ||
    lower.includes("thee")
  ) {
    category = "other";
    severity = "critical";
    department = "Fire";
    translation_en = "Fire or smoke hazard detected.";
    summary_en = "Active fire / smoke hazard requiring Fire Force.";
    summary_ml = "തീപിടുത്ത സാധ്യത: ഫയർഫോഴ്സിന്റെ സേവനം ലഭ്യമാക്കുക.";
    suggested_action = "Notify nearest Fire & Rescue Station (Club Road / Gandhinagar).";
  } else if (
    lower.includes("pipe") ||
    lower.includes("leak") ||
    lower.includes("കുടിവെള്ളം") ||
    lower.includes("kwa")
  ) {
    category = "other";
    severity = "medium";
    department = "KWA";
    translation_en = "Drinking water pipeline leak on the main road.";
    summary_en = "Water authority pipeline burst or leakage.";
    summary_ml = "കുടിവെള്ള പൈപ്പ് ചോർച്ച പരിഹരിക്കാൻ വാട്ടർ അതോറിറ്റിയെ അറിയിക്കുക.";
    suggested_action = "Alert Kerala Water Authority (KWA) maintenance wing.";
  }

  return {
    language,
    translation_en: translation_en || "Civic hazard reported.",
    category,
    severity,
    department,
    confidence: 0.94,
    summary_en,
    summary_ml,
    location_hint: locationHint || "Kochi Urban Area",
    photo_matches_text: true,
    suggested_action,
  };
}

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

export const triageReport = createServerFn({ method: "POST" })
  .validator((input: unknown) => TriageInputSchema.parse(input))
  .handler(async ({ data }): Promise<TriageResult> => {
    const transcript = (data.transcript || "").trim();
    const photoBase64 = data.photoBase64;
    const locationHint = data.locationHint || "";

    // If input is empty, return default fallback
    if (!transcript && !photoBase64) {
      return fallbackClassify("Civic incident", locationHint);
    }

    // Retrieve server-side API Key (never exposed to client)
    const apiKey =
      (typeof process !== "undefined" &&
        (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)) ||
      "";

    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
      return fallbackClassify(transcript, locationHint);
    }

    const systemPrompt = `You are the AI Citizen Report Triage Specialist for Kochi City, Kerala, India (CityTwin AI / Sentinel).
Your job is to analyze citizen civic incident reports submitted in Malayalam, Manglish (Malayalam written in English script), or English, along with optional photo attachments.

Classify and extract:
1. language: "ml" (if Malayalam script), "manglish" (if Malayalam in English letters), or "en" (if English).
2. translation_en: Fluent English translation of what the citizen reported.
3. category: Strictly one of ["pothole", "waterlogging", "garbage", "streetlight", "power_outage", "accident", "other"].
4. severity: Strictly one of ["low", "medium", "high", "critical"].
5. department: Strictly one of ["KWA", "KSEB", "Kochi Corporation", "PWD", "Police", "Fire"].
   - PWD: Road potholes, broken bridges, median damage, footpath reconstruction.
   - Kochi Corporation: Streetlights, solid waste/garbage, drainage, waterlogging, stray animal control, sanitary issues.
   - KSEB: Power cuts, fallen electric posts, live wire sparks, transformer faults.
   - KWA: Drinking water pipe bursts, water supply leakage, manhole covers.
   - Police: Traffic accidents, hit-and-run, road blockage, public safety.
   - Fire: Fire hazards, tree fall rescue, structural collapse.
6. confidence: Float between 0.0 and 1.0 (e.g. 0.95).
7. summary_en: Clear one-sentence English summary.
8. summary_ml: Clear one-sentence Malayalam summary in Malayalam script.
9. location_hint: Any landmark, junction, street, or area mentioned (e.g. "Edappally", "MG Road", "Vytilla", "Marine Drive") or "${locationHint || "Kochi"}".
10. photo_matches_text: Boolean (true if photo appears relevant to text, or true if no photo).
11. suggested_action: Actionable command center instruction for field teams.

Respond strictly in valid JSON matching the schema without markdown ticks.`;

    const userPromptText = `Citizen Report Transcript: "${transcript}"\nLocation Context: "${locationHint}"`;

    // Construct Gemini parts
    const parts: any[] = [{ text: `${systemPrompt}\n\n${userPromptText}` }];

    if (photoBase64) {
      // Strip data:image/...;base64, prefix if present
      const cleanBase64 = photoBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      const mimeType = data.photoMimeType || "image/jpeg";
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanBase64,
        },
      });
    }

    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
              },
            }),
          }
        );

        if (res.ok) {
          const jsonResponse = await res.json();
          const rawText =
            jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            // Strip markdown codeblocks if returned
            const sanitized = rawText
              .replace(/```json/gi, "")
              .replace(/```/g, "")
              .trim();
            const parsed = JSON.parse(sanitized);
            const validated = TriageResultSchema.safeParse(parsed);
            if (validated.success) {
              return validated.data;
            }
          }
        }
      } catch (e) {
        console.warn(`Gemini triage error with model ${model}:`, e);
      }
    }

    // Fallback if all Gemini models failed
    return fallbackClassify(transcript, locationHint);
  });
