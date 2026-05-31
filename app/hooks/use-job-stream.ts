"use client";

import { useEffect, useRef } from "react";
import type { JobRecord, PostProject, WorkspaceState } from "@/app/types";

type JobStreamOptions = {
  enabled: boolean;
  onSnapshot: (jobs: JobRecord[], workspace?: WorkspaceState, postProject?: PostProject) => void | Promise<void>;
  onFallbackPoll: () => void | Promise<void>;
};

export function useJobStream({ enabled, onSnapshot, onFallbackPoll }: JobStreamOptions): void {
  const onSnapshotRef = useRef(onSnapshot);
  const onFallbackPollRef = useRef(onFallbackPoll);

  onSnapshotRef.current = onSnapshot;
  onFallbackPollRef.current = onFallbackPoll;

  useEffect(() => {
    if (!enabled) return;

    let fallbackTimer: number | null = null;
    const events = new EventSource("/api/jobs/stream");

    events.addEventListener("jobs", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          jobs: JobRecord[];
          workspace?: WorkspaceState;
          postProject?: PostProject;
        };
        void onSnapshotRef.current(payload.jobs, payload.workspace, payload.postProject);
      } catch {
        void onFallbackPollRef.current();
      }
    });

    events.onerror = () => {
      events.close();
      fallbackTimer = window.setInterval(() => {
        void onFallbackPollRef.current();
      }, 2500);
    };

    return () => {
      events.close();
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer);
      }
    };
  }, [enabled]);
}
