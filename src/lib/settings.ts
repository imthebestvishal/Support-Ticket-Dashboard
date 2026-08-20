export interface WorkspaceSettings {
  aiSuggestedReplies: boolean;
  defaultTone: "formal" | "friendly" | "shorten" | "simplify";
  autoAnalyzeGmail: boolean;
  emailNotifications: boolean;
  autoRefreshInterval: number; // in seconds, 0 = disabled
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  aiSuggestedReplies: true,
  defaultTone: "formal",
  autoAnalyzeGmail: true,
  emailNotifications: true,
  autoRefreshInterval: 0,
};

const SETTINGS_KEY = "support_ai_workspace_settings";

export function getWorkspaceSettings(): WorkspaceSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save workspace settings:", err);
  }
}

export function resetWorkspaceSettings(): WorkspaceSettings {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (err) {
    console.error("Failed to reset workspace settings:", err);
  }
  return DEFAULT_SETTINGS;
}
