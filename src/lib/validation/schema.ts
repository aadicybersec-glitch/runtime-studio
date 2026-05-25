// src/lib/validation/schema.ts
import { z } from "zod";

export const FieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "email",
  "password",
  "select",
  "checkbox",
  "radio",
  "date",
  "tags"
]);

export const ConditionalRuleSchema = z.object({
  field: z.string(),
  equals: z.any(),
});

export const FieldDefinitionSchema = z.object({
  name: z.string().min(1, "Field name must be at least 1 character"),
  type: FieldTypeSchema,
  label: z.string().optional(),
  required: z.boolean().optional().default(false),
  default: z.any().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  showIf: ConditionalRuleSchema.optional(),
});

export const EntityDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Entity name is required").regex(/^[A-Za-z0-9_]+$/, "Entity name must be alphanumeric"),
  fields: z.array(FieldDefinitionSchema),
});

export const SidebarItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  icon: z.string().optional(),
  targetPage: z.string().min(1),
});

export const LayoutDefinitionSchema = z.object({
  sidebar: z.array(SidebarItemSchema).optional(),
});

export const ComponentDefinitionSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  title: z.string().optional(),
  entity: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  chartType: z.string().optional(),
  props: z.record(z.string(), z.any()).optional().default({}),
});

export const PageDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  components: z.array(ComponentDefinitionSchema),
});

export const WorkflowActionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["sendNotification", "webHookCall", "updateRecord"]),
  params: z.record(z.string(), z.any()).optional().default({}),
});

export const WorkflowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trigger: z.object({
    type: z.enum(["onRecordCreated", "onRecordUpdated"]),
    entity: z.string().min(1),
  }),
  actions: z.array(WorkflowActionSchema),
});

export const AppConfigSchema = z.object({
  appName: z.string().min(1, "App name is required").default("Dynamic Generated App"),
  entities: z.array(EntityDefinitionSchema).default([]),
  layout: LayoutDefinitionSchema.default({ sidebar: [] }),
  pages: z.array(PageDefinitionSchema).default([]),
  workflows: z.array(WorkflowDefinitionSchema).default([]),
});

export type ValidatedAppConfig = z.infer<typeof AppConfigSchema>;
export type ValidatedComponent = z.infer<typeof ComponentDefinitionSchema>;
export type ValidatedField = z.infer<typeof FieldDefinitionSchema>;
export type ValidatedEntity = z.infer<typeof EntityDefinitionSchema>;
