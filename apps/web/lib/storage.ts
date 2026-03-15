const STORAGE_KEY = "empirical-agent-projects";

type StoredProject = {
  id: string;
  token: string;
  title?: string;
};

export function getStoredProjects(): StoredProject[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredProject[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredProject(project: StoredProject) {
  if (typeof window === "undefined") {
    return;
  }

  const existing = getStoredProjects().filter((item) => item.id !== project.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([project, ...existing]));
}

export function getStoredProject(projectId: string) {
  return getStoredProjects().find((item) => item.id === projectId) ?? null;
}
