"use client";

// Sprint 13a — the config-driven renderer. Walks a stored (or default)
// layout, resolves each entry through WIDGET_REGISTRY, and renders using the
// constrained size presets. Reproduces the pre-13a OverviewGrid's outer grid
// shell exactly (grid-cols-12 + the fixed gridTemplateRows) — only the
// children come from config.
//
// Sprint 13b — adds an optional editable/onChangeLayout path (§2): when
// `editable` is on, each widget gets a small overlay of edit affordances
// (move up/down, resize, swap, remove) that call the pure reducers in
// dashboard-layout.ts and report the next draft LayoutConfig via
// onChangeLayout. The read-only path (editable falsy/omitted) is byte-for-byte
// the 13a rendering — this is additive, not a rewrite of 13a internals.

import { useState } from "react";
import { ChevronUp, ChevronDown, X, RefreshCcw } from "lucide-react";
import { WIDGET_REGISTRY } from "@/lib/widget-registry";
import {
  WIDGET_SIZE_CLASS,
  GRID_TEMPLATE_ROWS,
  reorderWidgetInLayout,
  resizeWidgetInLayout,
  removeWidgetFromLayout,
  swapWidgetInLayout,
  swapCandidatesFor,
  type LayoutConfig,
  type WidgetDataPayload,
  type WidgetSize,
} from "@/lib/dashboard-layout";
import { cn } from "@/lib/utils";

const SIZE_CYCLE: WidgetSize[] = ["sm", "md", "lg", "xl"];

// Responsive cell classes for the read-only grid. Tailwind needs these as literal strings (they
// mirror WIDGET_SIZE_CLASS from dashboard-layout.ts for lg+, which stays the desktop source of truth).
const MOBILE_SPAN_CLASS: Record<WidgetSize, string> = {
  sm: "col-span-1 lg:col-span-3",
  md: "col-span-2 lg:col-span-4",
  lg: "col-span-2 lg:col-span-8",
  xl: "col-span-2 lg:col-span-12",
};
const MOBILE_HEIGHT_BY_SIZE: Record<WidgetSize, string> = {
  sm: "h-[112px]",
  md: "h-[300px]",
  lg: "h-[300px]",
  xl: "h-[320px]",
};
// Widgets that need more room than their size preset gives them on a phone.
const MOBILE_HEIGHT_BY_TYPE: Record<string, string> = {
  "install-donuts": "h-[640px]",
  "top-locations": "h-[260px]",
  "geo-map": "h-[360px]",
  "geo-ranked-cities": "h-[420px]",
};

function nextSize(size: WidgetSize): WidgetSize {
  const idx = SIZE_CYCLE.indexOf(size);
  return SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length];
}

// KPI tiles are short regardless of their desktop size preset (e.g. the Locations KPIs are "md").
function mobileHeightClass(type: string, size: WidgetSize): string {
  if (MOBILE_HEIGHT_BY_TYPE[type]) return MOBILE_HEIGHT_BY_TYPE[type];
  if (type.includes("kpi")) return "h-[112px]";
  return MOBILE_HEIGHT_BY_SIZE[size];
}

export function WidgetGrid({
  layout,
  projectId,
  data,
  editable = false,
  onChangeLayout,
  gridTemplateRows = GRID_TEMPLATE_ROWS,
}: {
  layout: LayoutConfig;
  projectId: string;
  data: WidgetDataPayload;
  editable?: boolean;
  onChangeLayout?: (next: LayoutConfig) => void;
  gridTemplateRows?: string;
}) {
  if (!editable || !onChangeLayout) {
    // Desktop (md+): the original fixed 12-col / 3-row dashboard shell, unchanged.
    // Phones: a normal scrolling page — 2-col grid where KPI tiles sit two-up and charts take
    // the full width at a fixed height (charts need a definite height to render).
    return (
      <div
        className="grid grid-cols-2 gap-2 lg:h-full lg:grid-cols-12 lg:overflow-hidden lg:[grid-template-rows:var(--grid-rows)]"
        style={{ ["--grid-rows" as string]: gridTemplateRows }}
      >
        {layout.widgets.map((widget) => {
          const def = WIDGET_REGISTRY[widget.type];
          if (!def) return null;
          const Component = def.component;
          return (
            <div
              key={widget.id}
              className={cn(
                "min-h-0 lg:h-auto",
                MOBILE_SPAN_CLASS[widget.size],
                mobileHeightClass(widget.type, widget.size)
              )}
            >
              <Component
                projectId={projectId}
                data={data}
                params={widget.params}
                className="h-full w-full"
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="grid h-full grid-cols-12 gap-2 overflow-auto"
      style={{ gridTemplateRows }}
    >
      {layout.widgets.map((widget, index) => {
        const def = WIDGET_REGISTRY[widget.type];
        if (!def) return null;
        const Component = def.component;
        const swapCandidates = swapCandidatesFor(widget.type);
        return (
          <div
            key={widget.id}
            className={cn(WIDGET_SIZE_CLASS[widget.size], "group relative min-h-0")}
          >
            <div className="pointer-events-none absolute inset-0 z-10 rounded-lg ring-1 ring-dashed ring-brand/40 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute right-1 top-1 z-20 flex items-center gap-0.5 rounded-md border border-border bg-popover/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              <button
                type="button"
                title="Move up"
                className="rounded p-1 hover:bg-muted disabled:opacity-30"
                disabled={index === 0}
                onClick={() => onChangeLayout(reorderWidgetInLayout(layout, widget.id, "up"))}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Move down"
                className="rounded p-1 hover:bg-muted disabled:opacity-30"
                disabled={index === layout.widgets.length - 1}
                onClick={() => onChangeLayout(reorderWidgetInLayout(layout, widget.id, "down"))}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Cycle size"
                className="rounded px-1.5 py-1 text-[10px] font-medium hover:bg-muted"
                onClick={() => onChangeLayout(resizeWidgetInLayout(layout, widget.id, nextSize(widget.size)))}
              >
                {widget.size.toUpperCase()}
              </button>
              {swapCandidates.length > 0 && (
                <SwapControl
                  candidates={swapCandidates}
                  onSwap={(newType) => onChangeLayout(swapWidgetInLayout(layout, widget.id, newType))}
                />
              )}
              <button
                type="button"
                title="Remove widget"
                className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onChangeLayout(removeWidgetFromLayout(layout, widget.id))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Component projectId={projectId} data={data} params={widget.params} className="h-full w-full" />
          </div>
        );
      })}
    </div>
  );
}

function SwapControl({
  candidates,
  onSwap,
}: {
  candidates: string[];
  onSwap: (newType: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        title="Swap chart type"
        className="rounded p-1 hover:bg-muted"
        onClick={() => setOpen((v) => !v)}
      >
        <RefreshCcw className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-border bg-popover p-1 shadow-md">
          {candidates.map((type) => (
            <button
              key={type}
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
              onClick={() => {
                onSwap(type);
                setOpen(false);
              }}
            >
              {WIDGET_REGISTRY[type]?.label ?? type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
