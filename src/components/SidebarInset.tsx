"use client";

import { useSidebar } from "@/context/SidebarContext";
import { useAgentChat } from "@/components/agent/AgentChatProvider";
import { useLanguage } from "@/context/LanguageContext";
import { APP_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Offsets page content by the sidebar's current width, and by the agent chat
// panel's width while it is docked (lg+ only — below that the panel covers
// the viewport instead of docking).
function SidebarInset({ children }: { children: React.ReactNode }) {
  const { expanded } = useSidebar();
  const { isOpen, panelWidth, isResizing } = useAgentChat();
  const { isRtl } = useLanguage();

  const contentOffset = isRtl
    ? expanded
      ? "sm:pr-56"
      : "sm:pr-14"
    : expanded
      ? "sm:pl-56"
      : "sm:pl-14";

  return (
    <div
      className={cn(
        "flex flex-1 flex-col sm:gap-4 sm:py-4",
        // Following the drag handle 200ms late reads as lag, not animation.
        isResizing
          ? "transition-none"
          : "transition-[padding] duration-200 ease-in-out",
        contentOffset,
        isOpen && (isRtl ? "lg:pl-(--agent-chat-offset)" : "lg:pr-(--agent-chat-offset)")
      )}
      // Only while open: panelWidth is seeded from localStorage, so emitting
      // it during SSR (always closed) is a hydration mismatch.
      style={
        isOpen
          ? ({
              // 100vw, not the drag-resize ratio cap: expanding docks the
              // panel flush against the sidebar, which can exceed that ratio.
              "--agent-chat-offset": `min(${panelWidth}px, 100vw)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}

export default SidebarInset;
