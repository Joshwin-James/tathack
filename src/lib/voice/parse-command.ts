// Gemini-powered Voice Command Parser with Malayalam / Manglish / English support
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Allowed Actions Schema
export const AllowedActionEnum = z.enum([
  "start_mission",
  "pause",
  "reset",
  "set_green_corridor",
  "force_signal",
  "set_camera",
  "set_speed",
  "set_scenario",
  "compare_mode",
  "open_page",
  "send_citizen_alert",
  "show_status",
]);

export type AllowedAction = z.infer<typeof AllowedActionEnum>;

export const CommandResponseSchema = z.object({
  action: AllowedActionEnum,
  params: z.record(z.any()).default({}),
  confidence: z.number().min(0).max(100),
  spoken_reply_ml: z.string(),
  spoken_reply_en: z.string(),
});

export type CommandResponse = z.infer<typeof CommandResponseSchema>;

// Deterministic fallback keyword matcher for common Malayalam, Manglish, and English voice phrases
export function fallbackKeywordMatch(rawTranscript: string): CommandResponse {
  const t = rawTranscript.toLowerCase().trim();

  // 1. Force Signal
  if (t.includes("signal") || t.includes("green aakku") || t.includes("red aakku") || t.includes("സിഗ്നൽ")) {
    let junction = "Edappally Toll";
    if (t.includes("palarivattom") || t.includes("പാലാരിവട്ടം")) junction = "Palarivattom Flyover";
    else if (t.includes("kaloor") || t.includes("കലൂർ")) junction = "Kaloor Junction";
    else if (t.includes("vyttila") || t.includes("vytilla") || t.includes("വൈറ്റില")) junction = "Vyttila Hub";
    else if (t.includes("edappally") || t.includes("ഇടപ്പള്ളി")) junction = "Edappally Toll";

    const state = t.includes("red") || t.includes("ചുവപ്പ്") ? "red" : "green";
    return {
      action: "force_signal",
      params: { junction, state },
      confidence: 94,
      spoken_reply_ml: `${junction} സിഗ്നൽ ${state === "green" ? "ഗ്രീൻ" : "റെഡ്"} ആക്കുന്നു.`,
      spoken_reply_en: `Forcing signal at ${junction} to ${state.toUpperCase()}.`,
    };
  }

  // 2. Green Corridor Toggle
  if (t.includes("corridor") || t.includes("കോറിഡോർ")) {
    const isOff = t.includes("off") || t.includes("ഓഫ്") || t.includes("disable");
    return {
      action: "set_green_corridor",
      params: { enabled: !isOff },
      confidence: 96,
      spoken_reply_ml: `ഗ്രീൻ കോറിഡോർ ${!isOff ? "ഓൺ" : "ഓഫ്"} ആക്കി.`,
      spoken_reply_en: `Green corridor mode ${!isOff ? "enabled" : "disabled"}.`,
    };
  }

  // 3. Start Mission / Dispatch Ambulance
  if (
    t.includes("start") ||
    t.includes("തുടങ്ങൂ") ||
    t.includes("തുടങ്ങുക") ||
    t.includes("thudangoo") ||
    t.includes("ആംബുലൻസ് അയക്കൂ") ||
    t.includes("ആംബുലൻസ് തുടങ്ങൂ") ||
    t.includes("ambulance vidu") ||
    t.includes("dispatch")
  ) {
    return {
      action: "start_mission",
      params: {},
      confidence: 98,
      spoken_reply_ml: "ആംബുലൻസ് എമർജൻസി മിഷൻ ആരംഭിച്ചു. കോറിഡോർ സിഗ്നലുകൾ ലോക്ക് ചെയ്യുന്നു.",
      spoken_reply_en: "Emergency ambulance mission started. Green corridor signal preemption locked.",
    };
  }

  // 4. Pause
  if (t.includes("pause") || t.includes("നിർത്തൂ") || t.includes("stop") || t.includes("hold")) {
    return {
      action: "pause",
      params: {},
      confidence: 95,
      spoken_reply_ml: "സിമുലേഷൻ താൽക്കാലികമായി നിർത്തിവെച്ചു.",
      spoken_reply_en: "Simulation paused.",
    };
  }

  // 5. Reset
  if (t.includes("reset") || t.includes("പുനരാരംഭിക്കുക") || t.includes("veendum") || t.includes("clear")) {
    return {
      action: "reset",
      params: {},
      confidence: 96,
      spoken_reply_ml: "സിമുലേഷൻ റീസെറ്റ് ചെയ്തു.",
      spoken_reply_en: "Simulation reset to beginning.",
    };
  }

  // 6. Camera Switch
  if (t.includes("camera") || t.includes("ക്യാമറ") || t.includes("cam")) {
    let mode: "chase" | "top" | "cinematic" | "free" = "chase";
    if (t.includes("top") || t.includes("മുകളിൽ")) mode = "top";
    else if (t.includes("cinematic") || t.includes("സിനിമാറ്റിക്")) mode = "cinematic";
    else if (t.includes("free") || t.includes("ഫ്രീ")) mode = "free";
    else mode = "chase";

    return {
      action: "set_camera",
      params: { mode },
      confidence: 95,
      spoken_reply_ml: `ക്യാമറ മോഡ് ${mode} ലേക്ക് മാറ്റി.`,
      spoken_reply_en: `Camera switched to ${mode} mode.`,
    };
  }

  // 7. Simulation Speed
  if (t.includes("speed") || t.includes("വേഗത") || t.includes("fast") || t.includes("slow")) {
    let speed = 1;
    if (t.includes("4x") || t.includes("4") || t.includes("നാല്")) speed = 4;
    else if (t.includes("2x") || t.includes("2") || t.includes("രണ്ട്") || t.includes("koottoo")) speed = 2;
    else if (t.includes("0.5") || t.includes("slow") || t.includes("കുറയ്ക്കൂ")) speed = 0.5;
    else speed = 1;

    return {
      action: "set_speed",
      params: { speed },
      confidence: 92,
      spoken_reply_ml: `സിമുലേഷൻ വേഗത ${speed}X ആയി ക്രമീകരിച്ചു.`,
      spoken_reply_en: `Simulation speed set to ${speed}X.`,
    };
  }

  // 8. Scenario Switch
  if (t.includes("rush hour") || t.includes("congestion") || t.includes("scenario") || t.includes("ട്രാഫിക്")) {
    let scenario: "normal" | "rush_hour" | "congestion" = "rush_hour";
    if (t.includes("congestion") || t.includes("ബ്ലോക്ക്")) scenario = "congestion";
    else if (t.includes("normal") || t.includes("സാധാരണ")) scenario = "normal";
    else scenario = "rush_hour";

    return {
      action: "set_scenario",
      params: { scenario },
      confidence: 93,
      spoken_reply_ml: `ട്രാഫിക് സാഹചര്യം ${scenario} ലേക്ക് മാറ്റി.`,
      spoken_reply_en: `Traffic scenario changed to ${scenario}.`,
    };
  }

  // 9. Compare Mode
  if (t.includes("compare") || t.includes("താരതമ്യം") || t.includes("split")) {
    const isOff = t.includes("off") || t.includes("ഓഫ്");
    return {
      action: "compare_mode",
      params: { enabled: !isOff },
      confidence: 94,
      spoken_reply_ml: `താരതമ്യ മോഡ് ${!isOff ? "ഓൺ" : "ഓഫ്"} ആക്കി.`,
      spoken_reply_en: `Split-screen comparison ${!isOff ? "enabled" : "disabled"}.`,
    };
  }

  // 10. Open Page / Navigation
  if (t.includes("open") || t.includes("go to") || t.includes("kaanikk") || t.includes("തുറക്കൂ") || t.includes("പോവുക")) {
    let route = "/twin";
    if (t.includes("hospital") || t.includes("ഹോസ്പിറ്റൽ")) route = "/hospital";
    else if (t.includes("cctv") || t.includes("ക്യാമറകൾ") || t.includes("സിസിടിവി")) route = "/cctv";
    else if (t.includes("citizen") || t.includes("സിറ്റിസൺ")) route = "/citizen";
    else if (t.includes("map") || t.includes("മാപ്പ്")) route = "/map";
    else if (t.includes("alert") || t.includes("അലേർട്ട്")) route = "/alerts";
    else if (t.includes("twin") || t.includes("3d") || t.includes("simulation")) route = "/twin";

    return {
      action: "open_page",
      params: { route },
      confidence: 95,
      spoken_reply_ml: `${route} പേജിലേക്ക് മാറുന്നു.`,
      spoken_reply_en: `Navigating to ${route}.`,
    };
  }

  // 11. Send Citizen Alert
  if (t.includes("citizen alert") || t.includes("send alert") || t.includes("അലേർട്ട് അയക്കൂ")) {
    return {
      action: "send_citizen_alert",
      params: { message: "Ambulance approaching corridor. Please pull over left." },
      confidence: 95,
      spoken_reply_ml: "സിറ്റിസൺ ആപ്പുകളിലേക്ക് ആംബുലൻസ് അലേർട്ട് അയയ്ക്കാൻ തയാറെടുക്കുന്നു.",
      spoken_reply_en: "Broadcasting emergency corridor alert to citizen mobile apps.",
    };
  }

  // 12. Show Status (Default)
  return {
    action: "show_status",
    params: {},
    confidence: 90,
    spoken_reply_ml: "കൊച്ചി ഗ്രീൻ കോറിഡോർ സിസ്റ്റം സജീവമാണ്. എല്ലാ സിഗ്നലുകളും എ ഐ നിയന്ത്രണത്തിലാണ്.",
    spoken_reply_en: "Kochi Green Corridor digital twin is operational. All AI signal preemptions synchronized.",
  };
}

// TanStack Start Server Function
export const parseCommand = createServerFn({ method: "POST" })
  .validator((d: { transcript: string; lang?: string }) => d)
  .handler(async ({ data }) => {
    const { transcript } = data;
    if (!transcript || !transcript.trim()) {
      return fallbackKeywordMatch("");
    }

    const apiKey =
      (typeof process !== "undefined" && (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)) ||
      "";

    if (!apiKey) {
      return fallbackKeywordMatch(transcript);
    }

    const systemPrompt = `You are the AI Voice Command Parser for Kochi Sentinel Digital Twin & Green Corridor Command Center.
The operator speaks commands in Malayalam, Manglish (Malayalam written in English letters), or English.

You MUST analyze the operator's transcript and map it to ONE of the allowed actions:
Allowed Actions:
1. start_mission: Start the emergency ambulance simulation/green corridor. (Params: {})
2. pause: Pause the active simulation. (Params: {})
3. reset: Reset the simulation to start. (Params: {})
4. set_green_corridor: Toggle green corridor on/off. (Params: { enabled: boolean })
5. force_signal: Force junction signal state. (Params: { junction: string (e.g. "Edappally Toll"|"Palarivattom Flyover"|"Kaloor Junction"|"Vyttila Hub"), state: "green"|"red" })
6. set_camera: Change camera view. (Params: { mode: "chase"|"top"|"cinematic"|"free" })
7. set_speed: Change simulation speed multiplier. (Params: { speed: 0.5|1|2|4 })
8. set_scenario: Change traffic density scenario. (Params: { scenario: "normal"|"rush_hour"|"congestion" })
9. compare_mode: Toggle split-screen comparison mode. (Params: { enabled: boolean })
10. open_page: Navigate to another system page. (Params: { route: "/twin"|"/hospital"|"/cctv"|"/citizen"|"/map"|"/alerts"|"/routing" })
11. send_citizen_alert: Send emergency broadcast to citizen portal. (Params: { message?: string })
12. show_status: Query city or mission status. (Params: {})

Respond ONLY with a valid JSON object matching this schema:
{
  "action": string (one of the 12 allowed actions),
  "params": object,
  "confidence": number between 0 and 100,
  "spoken_reply_ml": string (concise natural Malayalam confirmation for text-to-speech),
  "spoken_reply_en": string (concise English confirmation for text-to-speech)
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nOperator Transcript: "${transcript}"` }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          const validated = CommandResponseSchema.parse(parsed);
          return validated;
        }
      }
    } catch (err) {
      console.warn("Gemini voice parse failed, using fallback matcher:", err);
    }

    return fallbackKeywordMatch(transcript);
  });
