// React hook exposing live Emergency Mission state, publish function and presence counts
import { useState, useEffect, useCallback } from "react";
import { emergencyMissionClient } from "./client";
import { MissionState } from "./types";

export function useMission() {
  const [mission, setMission] = useState<MissionState>(() => emergencyMissionClient.getState());
  const [subscriberCount, setSubscriberCount] = useState<number>(() =>
    emergencyMissionClient.getSubscriberCount()
  );

  useEffect(() => {
    const unsubMission = emergencyMissionClient.subscribe((latest) => {
      setMission(latest);
    });

    const unsubCount = emergencyMissionClient.subscribeCount((count) => {
      setSubscriberCount(count);
    });

    return () => {
      unsubMission();
      unsubCount();
    };
  }, []);

  const publishMission = useCallback((state: Partial<MissionState>) => {
    emergencyMissionClient.publish(state);
  }, []);

  const registerCitizenPresence = useCallback((enabled: boolean) => {
    emergencyMissionClient.registerCitizenPresence(enabled);
  }, []);

  return {
    mission,
    publishMission,
    subscriberCount,
    registerCitizenPresence,
    isEnroute: mission.status === "enroute",
    isArrived: mission.status === "arrived" || mission.status === "completed",
  };
}
