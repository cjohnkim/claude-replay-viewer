"use client";
import { useEffect } from "react";
import type { ReplayEvent } from "@/lib/types";

/** Shared chronological playback. Gaps are compressed for inspection, not real-time claims. */
export function useReplayPlayback(
  events: ReplayEvent[], selectedIndex: number, playing: boolean, speed: number,
  onSelect: (index: number) => void, onStop: () => void,
) {
  useEffect(() => {
    if (!playing) return;
    if (selectedIndex >= events.length - 1) { onStop(); return; }
    const current = Date.parse(events[selectedIndex].timestamp);
    const next = Date.parse(events[selectedIndex + 1].timestamp);
    const delay = Math.max(400, Math.min(2400, (next - current) / 4)) / speed;
    const timer = setTimeout(() => onSelect(selectedIndex + 1), delay);
    return () => clearTimeout(timer);
  }, [events, selectedIndex, playing, speed, onSelect, onStop]);
}
