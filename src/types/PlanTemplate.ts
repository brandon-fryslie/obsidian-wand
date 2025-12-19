import { ActionPlan } from "./ActionPlan";

/**
 * Template category for organization
 */
export type TemplateCategory =
  | "daily-notes"
  | "organization"
  | "creation"
  | "search"
  | "custom";

/**
 * Parameter type for template inputs
 */
export type ParameterType =
  | "string"
  | "number"
  | "file"
  | "folder"
  | "selection"
  | "date";

/**
 * Template parameter definition
 */
export interface TemplateParameter {
  /** Parameter name (used as placeholder variable) */
  name: string;
  /** Human-readable label */
  label: string;
  /** Input type */
  type: ParameterType;
  /** Description of what this parameter does */
  description?: string;
  /** Default value if not provided */
  defaultValue?: string;
  /** Whether this parameter is required */
  required: boolean;
  /** Placeholder text for input field */
  placeholder?: string;
}

/**
 * Reusable plan template with parameterization
 */
export interface PlanTemplate {
  /** Unique identifier */
  id: string;
  /** Template name */
  name: string;
  /** Description of what this template does */
  description: string;
  /** Category for organization */
  category: TemplateCategory;
  /** Icon emoji or character */
  icon?: string;
  /** Action plan with ${param} placeholders */
  actionPlan: ActionPlan;
  /** Parameters that need to be filled */
  parameters: TemplateParameter[];
  /** Whether this is a built-in template */
  isBuiltIn: boolean;
  /** When the template was created */
  createdAt: Date;
  /** How many times this template has been used */
  usageCount: number;
}

/**
 * Draft for creating a new template
 */
export interface TemplateDraft {
  name: string;
  description: string;
  category: TemplateCategory;
  icon?: string;
  actionPlan: ActionPlan;
  parameters: TemplateParameter[];
}
