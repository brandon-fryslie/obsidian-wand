import { ItemView, WorkspaceLeaf, MarkdownView, Notice, Modal, App } from "obsidian";
import { ToolAgentSettings } from "../types/settings";
import { PluginServices } from "../services/PluginServices";
import { PlanEvent } from "../types/PlanEvents";
import { plans, activePlanId, addEvent } from "../stores/planStore";
import { ExecutionProgress } from "../services/ExecutionManager";
import { PlanTemplate } from "../types/PlanTemplate";
import PlanPanel from "../components/PlanPanel.svelte";

export const VIEW_TYPE_PLAN = "wand-plan";

export class PlanView extends ItemView {
  private planPanel!: PlanPanel; // Initialized in onOpen
  private services: PluginServices;
  private unsubscribePlanStore?: () => void;
  private unsubscribeExecutionProgress?: () => void;
  private currentExecutionProgress: ExecutionProgress | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    app: App,
    _settings: ToolAgentSettings,
    services: PluginServices
  ) {
    super(leaf);
    this.app = app;
    this.services = services;
  }

  getViewType() {
    return VIEW_TYPE_PLAN;
  }

  getDisplayText() {
    return "Wand Plans";
  }

  getIcon() {
    return "list-checks";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("wand-plan");

    // Subscribe to plan store events to sync Svelte stores
    this.unsubscribePlanStore = this.services.planStore.subscribe(
      (event: PlanEvent) => {
        this.handlePlanEvent(event);
      }
    );

    // Subscribe to execution progress
    this.unsubscribeExecutionProgress =
      this.services.executionManager.onProgress((progress) => {
        this.currentExecutionProgress = progress;
        this.updatePanelProgress();
      });

    // Initialize Svelte stores with current plans
    this.syncPlansToStore();

    // Create Svelte component
    this.planPanel = new PlanPanel({
      target: container,
      props: {
        contextInfo: this.getCurrentContext(),
        executionProgress: null,
        templates: this.services.templateStore.list(),
      },
    });

    // Listen to events from the plan panel
    this.planPanel.$on("newPlan", () => {
      console.log("New plan requested");
    });

    this.planPanel.$on("selectPlan", (event: CustomEvent) => {
      console.log("Plan selected:", event.detail.plan);
    });

    this.planPanel.$on("planAction", async (event: CustomEvent) => {
      await this.handlePlanAction(event.detail);
    });

    this.planPanel.$on("generatePlan", async (event: CustomEvent) => {
      await this.handleGeneratePlan(event.detail);
    });

    this.planPanel.$on("cancelGeneration", () => {
      this.handleCancelGeneration();
    });

    this.planPanel.$on("saveAsTemplate", (event: CustomEvent) => {
      this.handleSaveAsTemplate(event.detail);
    });

    this.planPanel.$on("createFromTemplate", async (event: CustomEvent) => {
      await this.handleCreateFromTemplate(event.detail);
    });

    this.planPanel.$on("deleteTemplate", (event: CustomEvent) => {
      this.handleDeleteTemplate(event.detail);
    });

    this.planPanel.$on("newTemplate", () => {
      this.handleNewTemplate();
    });
  }

  async onClose() {
    if (this.unsubscribePlanStore) {
      this.unsubscribePlanStore();
    }
    if (this.unsubscribeExecutionProgress) {
      this.unsubscribeExecutionProgress();
    }
    if (this.planPanel) {
      this.planPanel.$destroy();
    }
  }

  updateSettings(_settings: ToolAgentSettings) {
  }

  /**
   * Update the panel with current execution progress
   */
  private updatePanelProgress() {
    if (this.planPanel) {
      this.planPanel.$set({
        executionProgress: this.currentExecutionProgress,
      });
    }
  }

  /**
   * Update the panel with current templates
   */
  private updateTemplates() {
    if (this.planPanel) {
      this.planPanel.$set({
        templates: this.services.templateStore.list(),
      });
    }
  }

  /**
   * Handle plan generation request from the UI
   */
  private async handleGeneratePlan(detail: {
    prompt: string;
    context: { activeFile?: string; selection?: string };
  }) {
    const { prompt, context } = detail;

    try {
      const plan = await this.services.planGenerator.generatePlan(
        prompt,
        {
          activeFilePath: context.activeFile,
          selection: context.selection
            ? { text: context.selection, source: context.activeFile || "" }
            : undefined,
        },
        (status: string) => {
          console.log("[PlanView] Generation status:", status);
        }
      );

      // Sync plans to store
      this.syncPlansToStore();

      // Auto-select the new plan
      activePlanId.set(plan.id);

      // Notify panel of success
      this.planPanel.onGenerationComplete(true);

      new Notice("Plan created successfully!");
    } catch (error) {
      console.error("Plan generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Notify panel of failure
      this.planPanel.onGenerationComplete(false, errorMessage);

      new Notice(`Failed to generate plan: ${errorMessage}`);
    }
  }

  /**
   * Handle cancellation of plan generation
   */
  private handleCancelGeneration() {
    this.services.planGenerator.cancel();
    new Notice("Plan generation cancelled");
  }

  /**
   * Handle save as template action
   */
  private handleSaveAsTemplate(detail: { plan: any }) {
    const { plan } = detail;

    // Show modal to get template name and description
    const modal = new SaveTemplateModal(
      this.app,
      async (name: string, description: string) => {
        try {
          const template = this.services.templateStore.saveAsTemplate(
            plan,
            name,
            description
          );
          this.updateTemplates();
          new Notice(`Template "${template.name}" created successfully!`);
        } catch (error) {
          console.error("Failed to save template:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          new Notice(`Failed to save template: ${errorMessage}`);
        }
      }
    );
    modal.open();
  }

  /**
   * Handle create plan from template
   */
  private async handleCreateFromTemplate(detail: {
    template: PlanTemplate;
    parameters: Record<string, any>;
  }) {
    const { template, parameters } = detail;

    try {
      // Create action plan from template
      const actionPlan = this.services.templateStore.createPlanFromTemplate(
        template.id,
        parameters
      );

      // Create a new plan with the bound action plan
      const plan = this.services.planStore.create({
        title: actionPlan.goal,
        goal: actionPlan.goal,
        actionPlan,
      });

      // Sync plans and select the new plan
      this.syncPlansToStore();
      activePlanId.set(plan.id);
      this.updateTemplates(); // Update usage count

      new Notice(`Plan created from template "${template.name}"!`);
    } catch (error) {
      console.error("Failed to create plan from template:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to create plan: ${errorMessage}`);
    }
  }

  /**
   * Handle delete template
   */
  private handleDeleteTemplate(detail: { template: PlanTemplate }) {
    const { template } = detail;

    try {
      this.services.templateStore.delete(template.id);
      this.updateTemplates();
      new Notice(`Template "${template.name}" deleted`);
    } catch (error) {
      console.error("Failed to delete template:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to delete template: ${errorMessage}`);
    }
  }

  /**
   * Handle new template creation
   */
  private handleNewTemplate() {
    new Notice("Custom template creation not yet implemented");
    // TODO: Implement custom template creation UI
  }

  /**
   * Handle plan actions (approve, execute, etc.)
   */
  private async handlePlanAction(detail: {
    action: string;
    plan?: any;
    [key: string]: any;
  }) {
    const { action, plan } = detail;

    try {
      switch (action) {
        case "open":
          // Already handled by PlanPanel's selection logic
          break;

        case "approve":
          if (plan?.id) {
            this.services.planStore.approve(plan.id);
            this.syncPlansToStore();
            new Notice("Plan approved");
          }
          break;

        case "execute":
          if (plan?.id) {
            await this.executePlan(plan.id);
          }
          break;

        case "pause":
          try {
            this.services.executionManager.pause();
            this.syncPlansToStore();
            new Notice("Execution paused");
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            new Notice(`Failed to pause: ${errorMessage}`);
          }
          break;

        case "resume":
          await this.resumePlan();
          break;

        case "cancel":
          if (plan?.id) {
            if (this.services.executionManager.isExecuting() &&
                this.services.executionManager.getCurrentPlanId() === plan.id) {
              // Cancel running execution
              this.services.executionManager.cancel();
              this.currentExecutionProgress = null;
              this.updatePanelProgress();
              new Notice("Execution cancelled");
            } else {
              // Cancel pending/approved plan
              this.services.planStore.cancel(plan.id);
              new Notice("Plan cancelled");
            }
            this.syncPlansToStore();
          }
          break;

        case "retry":
          if (plan?.id) {
            // Retry a failed plan - approve it again and execute
            this.services.planStore.approve(plan.id);
            this.syncPlansToStore();
            await this.executePlan(plan.id);
          }
          break;

        case "delete":
          if (plan?.id) {
            this.services.planStore.delete(plan.id);
            this.syncPlansToStore();
            activePlanId.set(null);
            new Notice("Plan deleted");
          }
          break;

        default:
          console.log("Unhandled plan action:", action, plan);
      }
    } catch (error) {
      console.error("Plan action failed:", error);
      new Notice(
        `Failed to ${action} plan: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a plan
   */
  private async executePlan(planId: string) {
    try {
      new Notice("Starting plan execution...");

      const result = await this.services.executionManager.execute(planId);

      // Clear execution progress
      this.currentExecutionProgress = null;
      this.updatePanelProgress();
      this.syncPlansToStore();

      if (result.success) {
        new Notice(
          `Plan completed successfully! ${result.completedSteps}/${result.totalSteps} steps`
        );
      } else {
        new Notice(
          `Plan execution failed: ${result.error || "Unknown error"}`,
          5000
        );
      }
    } catch (error) {
      console.error("Plan execution failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to execute plan: ${errorMessage}`, 5000);

      // Clear execution progress
      this.currentExecutionProgress = null;
      this.updatePanelProgress();
      this.syncPlansToStore();
    }
  }

  /**
   * Resume a paused plan
   */
  private async resumePlan() {
    try {
      new Notice("Resuming plan execution...");

      const result = await this.services.executionManager.resume();

      // Clear execution progress
      this.currentExecutionProgress = null;
      this.updatePanelProgress();
      this.syncPlansToStore();

      if (result.success) {
        new Notice(
          `Plan completed successfully! ${result.completedSteps}/${result.totalSteps} steps`
        );
      } else {
        new Notice(
          `Plan execution failed: ${result.error || "Unknown error"}`,
          5000
        );
      }
    } catch (error) {
      console.error("Plan resume failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to resume plan: ${errorMessage}`, 5000);

      // Clear execution progress
      this.currentExecutionProgress = null;
      this.updatePanelProgress();
      this.syncPlansToStore();
    }
  }

  /**
   * Handle plan store events
   */
  private handlePlanEvent(event: PlanEvent) {
    console.log("[PlanView] Plan event:", event.type);

    // Add to activity log
    addEvent(event);

    // Show notifications for key events
    this.showEventNotification(event);

    // Sync plans to store
    this.syncPlansToStore();
  }

  /**
   * Show notifications for important plan events
   */
  private showEventNotification(event: PlanEvent) {
    switch (event.type) {
      case "status-changed":
        if (event.to === "completed") {
          const plan = this.services.planStore.get(event.planId);
          const title = plan ? plan.title : "Plan";
          new Notice(`Plan "${title}" completed successfully!`);
        } else if (event.to === "failed") {
          const plan = this.services.planStore.get(event.planId);
          const title = plan ? plan.title : "Plan";
          new Notice(`Plan "${title}" failed`, 5000);
        } else if (event.to === "paused") {
          new Notice("Plan execution paused");
        }
        break;

      case "execution-completed":
        if (!event.result.success) {
          new Notice(
            `Execution failed: ${event.result.error || "Unknown error"}`,
            5000
          );
        }
        break;

      // Don't show notifications for other events (created, updated, etc.)
      // to avoid noise
      default:
        break;
    }
  }

  /**
   * Sync plans from PlanStore to Svelte stores
   */
  private syncPlansToStore() {
    const allPlans = this.services.planStore.list();
    plans.set(allPlans);
  }

  /**
   * Get current workspace context
   */
  private getCurrentContext(): {
    activeFile?: string;
    selection?: string;
  } {
    const activeFile = this.app.workspace.getActiveFile();
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = activeView?.editor?.getSelection();

    return {
      activeFile: activeFile?.path,
      selection: selection || undefined,
    };
  }
}

/**
 * Modal for saving a plan as a template
 */
class SaveTemplateModal extends Modal {
  private onSubmit: (name: string, description: string) => void;
  private nameInput!: HTMLInputElement;
  private descriptionInput!: HTMLTextAreaElement;

  constructor(app: App, onSubmit: (name: string, description: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Save as Template" });

    // Name field
    const nameContainer = contentEl.createDiv({ cls: "setting-item" });
    nameContainer.createEl("label", { text: "Template Name" });
    this.nameInput = nameContainer.createEl("input", {
      type: "text",
      placeholder: "My Template",
    });
    this.nameInput.style.width = "100%";
    this.nameInput.style.marginTop = "4px";

    // Description field
    const descContainer = contentEl.createDiv({ cls: "setting-item" });
    descContainer.style.marginTop = "16px";
    descContainer.createEl("label", { text: "Description" });
    this.descriptionInput = descContainer.createEl("textarea", {
      placeholder: "What does this template do?",
    });
    this.descriptionInput.style.width = "100%";
    this.descriptionInput.style.marginTop = "4px";
    this.descriptionInput.rows = 3;

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    buttonContainer.style.marginTop = "20px";
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = buttonContainer.createEl("button", {
      text: "Save",
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", () => {
      const name = this.nameInput.value.trim();
      const description = this.descriptionInput.value.trim();

      if (!name) {
        new Notice("Template name is required");
        return;
      }

      this.onSubmit(name, description);
      this.close();
    });

    // Focus name input
    this.nameInput.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
