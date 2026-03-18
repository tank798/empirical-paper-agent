const STORAGE_KEY = "empirical-agent-projects";
const PENDING_BOOTSTRAP_KEY = "empirical-agent-pending-bootstrap";

type StoredProject = {
  id: string;
  token: string;
  title?: string;
};

type PendingProjectBootstrap = {
  projectId: string;
  topic: string;
  createdAt: number;
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

export function removeStoredProject(projectId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const remaining = getStoredProjects().filter((item) => item.id !== projectId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

export function getStoredProject(projectId: string) {
  return getStoredProjects().find((item) => item.id === projectId) ?? null;
}

export function setPendingProjectBootstrap(payload: PendingProjectBootstrap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_BOOTSTRAP_KEY, JSON.stringify(payload));
}

export function getPendingProjectBootstrap(projectId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PENDING_BOOTSTRAP_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PendingProjectBootstrap;
    if (parsed.projectId !== projectId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingProjectBootstrap(projectId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (!projectId) {
    window.localStorage.removeItem(PENDING_BOOTSTRAP_KEY);
    return;
  }

  const current = getPendingProjectBootstrap(projectId);
  if (current) {
    window.localStorage.removeItem(PENDING_BOOTSTRAP_KEY);
  }
}
