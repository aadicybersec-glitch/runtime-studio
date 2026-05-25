// src/types/index.ts

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "password"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "tags";

export interface FieldDefinition {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  default?: any;
  options?: string[]; // Used for select, radio
  placeholder?: string;
  showIf?: {
    field: string;
    equals: any;
  };
}

export interface EntityDefinition {
  name: string;
  fields: FieldDefinition[];
}

export interface SidebarItem {
  label: string;
  icon?: string;
  targetPage: string;
}

export interface LayoutDefinition {
  sidebar?: SidebarItem[];
}

export interface ComponentDefinition {
  id: string;
  type: string; // e.g., "form", "table", "dashboard", "chart", "unknown"
  props: Record<string, any>;
}

export interface PageDefinition {
  id: string;
  title: string;
  components: ComponentDefinition[];
}

export interface WorkflowAction {
  type: "sendNotification" | "webHookCall" | "updateRecord";
  params: {
    to?: string;
    subject?: string;
    body?: string;
    url?: string;
    fieldUpdates?: Record<string, any>;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  trigger: {
    type: "onRecordCreated" | "onRecordUpdated";
    entity: string;
  };
  actions: WorkflowAction[];
}

export interface AppConfig {
  appName: string;
  entities: EntityDefinition[];
  layout: LayoutDefinition;
  pages: PageDefinition[];
  workflows: WorkflowDefinition[];
}

// User & session types for NextAuth
export interface SessionUser {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
}
