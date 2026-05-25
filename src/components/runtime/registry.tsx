// src/components/runtime/registry.tsx

import React, { Suspense, useEffect } from "react";
import type { ComponentDefinition } from "@/types";
import ComponentFallback from "@/components/fallbacks/ComponentFallback";
import WidgetErrorBoundary from "@/components/fallbacks/WidgetErrorBoundary";
import logger from "@/lib/logger/logger";

// ---------------------------------------------------------------------------
// Lazy-loaded dynamic widgets
// ---------------------------------------------------------------------------

const DynamicForm = React.lazy(
  () => import("@/components/dynamic/DynamicForm")
);

const DynamicTable = React.lazy(
  () => import("@/components/dynamic/DynamicTable")
);

const DynamicDashboard = React.lazy(
  () => import("@/components/dynamic/DynamicDashboard")
);

const DynamicChart = React.lazy(
  () => import("@/components/dynamic/DynamicChart")
);

// ---------------------------------------------------------------------------
// SkeletonCard — shown via Suspense while a lazy chunk is loading
// ---------------------------------------------------------------------------

export const SkeletonCard: React.FC = () => (
  <div
    aria-label="Loading component…"
    aria-busy="true"
    className="animate-pulse rounded-xl bg-zinc-800 min-h-24 w-full"
  />
);

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

export interface RegistryEntry {
  /** The lazy-loaded React component. */
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Human-readable display name used in logs and error messages. */
  displayName: string;
}

// ---------------------------------------------------------------------------
// Central widget registry
// Keys must match the `type` field on ComponentDefinition.
// ---------------------------------------------------------------------------

export const widgetRegistry: Record<string, RegistryEntry> = {
  form: {
    component: DynamicForm,
    displayName: "Dynamic Form",
  },
  table: {
    component: DynamicTable,
    displayName: "Dynamic Table",
  },
  dashboard: {
    component: DynamicDashboard,
    displayName: "Dynamic Dashboard",
  },
  chart: {
    component: DynamicChart,
    displayName: "Dynamic Chart",
  },
};

// ---------------------------------------------------------------------------
// resolveComponent
// Returns the RegistryEntry for a given type string, or null if unknown.
// ---------------------------------------------------------------------------

export function resolveComponent(type: string): RegistryEntry | null {
  const entry = widgetRegistry[type.toLowerCase().trim()];
  return entry ?? null;
}

// ---------------------------------------------------------------------------
// renderWidget
// Resolves and renders a ComponentDefinition, fully wrapped in error + suspense
// boundaries.  Falls back to ComponentFallback for unknown types.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ResolvedWidget — wrapper to execute dynamic widget rendering and manage
// telemetry logging side-effects safely inside useEffect (commit phase).
// This prevents infinite render loops caused by render-phase state updates.
// ---------------------------------------------------------------------------

interface ResolvedWidgetProps {
  component: ComponentDefinition;
  WidgetComponent: React.ComponentType<any>;
  resolvedProps: Record<string, any>;
  resolvedEntity: any;
  isInline: boolean;
}

const ResolvedWidget: React.FC<ResolvedWidgetProps> = ({
  component,
  WidgetComponent,
  resolvedProps,
  resolvedEntity,
  isInline,
}) => {
  useEffect(() => {
    if (component.type === "form" || component.type === "table" || component.type === "chart") {
      if (!resolvedEntity) {
        logger.warn(
          "registryResolver",
          `[WARN] registryResolver → entity hydration failed for widget ${component.id} (fallback activated)`
        );
      } else {
        if (isInline) {
          logger.info("registryResolver", `[INFO] registryResolver → Resolved inline entity metadata for widget ${component.id}`);
        }
        logger.info(
          "registryResolver",
          `[INFO] registryResolver → entity resolved successfully: "${resolvedEntity.name}" for widget ${component.id}`
        );
      }
    }
    logger.info(
      "hydrationPipeline",
      `[TRACE] hydrationPipeline → widget hydration complete for widget ${component.id}`
    );
  }, [component.id, component.type, resolvedEntity?.name, isInline]);

  return <WidgetComponent {...resolvedProps} />;
};

export function renderWidget(
  component: ComponentDefinition,
  entityData?: any[],
  context?: { appId: string; config: any; refreshTrigger?: number; onFormSuccess?: (record: any) => void }
): React.ReactNode {
  const entry = resolveComponent(component.type);

  // Unknown component type — render informative fallback
  if (!entry) {
    return (
      <ComponentFallback
        key={component.id}
        componentType={component.type}
        componentId={component.id}
        reason="No registered widget matches this component type."
      />
    );
  }

  const WidgetComponent = entry.component;

  // Merge entityData into props when provided
  const resolvedProps: Record<string, any> = {
    ...component.props,
    ...(entityData !== undefined ? { entityData } : {}),
  };

  // ── 1. Resilient Entity Reference Resolution ──
  let resolvedEntity: any = null;
  let isInline = false;
  const entities = context?.config?.entities || [];

  if (component.type === "form" || component.type === "table" || component.type === "chart" || component.type === "dashboard") {
    // Collect all possible entity references in all supported patterns
    const ref = 
      component.props?.entity || 
      (component as any).entity ||
      component.props?.entityName ||
      (component as any).entityName ||
      component.props?.entityId ||
      (component as any).entityId;

    if (ref) {
      if (typeof ref === "object" && !Array.isArray(ref)) {
        // Pattern 3: Inline entity object config pattern
        resolvedEntity = ref;
        isInline = true;
      } else if (typeof ref === "string") {
        // Pattern 1 & 2: Entity ID or Entity Name string config pattern
        resolvedEntity = entities.find(
          (e: any) => 
            e.id === ref || 
            e.name === ref || 
            e.name?.toLowerCase() === ref.toLowerCase() ||
            e.id?.toLowerCase() === ref.toLowerCase()
        );
      }
    }

    // Fallback: try mapping directly via explicit props
    if (!resolvedEntity) {
      const propEntityName = component.props?.entityName || component.props?.entity;
      const propEntityId = component.props?.entityId || component.props?.entity;
      
      resolvedEntity = entities.find(
        (e: any) =>
          e.id === propEntityId ||
          e.name === propEntityName ||
          e.id === propEntityName ||
          e.name?.toLowerCase() === String(propEntityName).toLowerCase()
      );
    }
  }

  // Inject dynamic system context to bind forms/tables/dashboards to metadata runtime
  if (context) {
    resolvedProps.appId = context.appId;
    resolvedProps.entity = resolvedEntity; // Normalized entity passed globally!

    if (component.type === "form") {
      if (context.onFormSuccess) {
        resolvedProps.onSuccess = context.onFormSuccess;
      }
    } else if (component.type === "table") {
      if (context.refreshTrigger !== undefined) {
        resolvedProps.refreshTrigger = context.refreshTrigger;
      }
    } else if (component.type === "dashboard") {
      resolvedProps.config = context.config;
    } else if (component.type === "chart") {
      resolvedProps.entities = context.config?.entities || [];
      resolvedProps.config = {
        entityName: resolvedEntity?.name || component.props.entityName,
        chartType: component.props.chartType || "bar",
        xField: component.props.xField,
        yField: component.props.yField,
        title: component.props.title,
      };
    }
  }

  return (
    <WidgetErrorBoundary
      key={component.id}
      componentId={component.id}
      fallbackLabel={entry.displayName}
    >
      <Suspense fallback={<SkeletonCard />}>
        <ResolvedWidget
          component={component}
          WidgetComponent={WidgetComponent}
          resolvedProps={resolvedProps}
          resolvedEntity={resolvedEntity}
          isInline={isInline}
        />
      </Suspense>
    </WidgetErrorBoundary>
  );
}
