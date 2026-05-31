export type JobWorkspaceContext = {
  workspaceId?: string;
  postProjectId?: string;
};

export type WorkspaceJobLike = {
  id: string;
  workspaceId?: string;
  postProjectId?: string;
};

export type WorkspaceLike = {
  workspaceId?: string;
  recentJobIds?: string[];
};

export function isJobForWorkspace(job: WorkspaceJobLike | null | undefined, workspace: WorkspaceLike | null | undefined): boolean {
  if (!job || !workspace?.workspaceId) {
    return false;
  }

  if (job.workspaceId) {
    return job.workspaceId === workspace.workspaceId;
  }

  return Boolean(workspace.recentJobIds?.includes(job.id));
}

export function canApplyWorkspaceSnapshot(
  snapshot: WorkspaceLike | null | undefined,
  currentWorkspace: WorkspaceLike | null | undefined
): boolean {
  if (!snapshot) {
    return false;
  }

  if (!currentWorkspace?.workspaceId) {
    return true;
  }

  return snapshot.workspaceId === currentWorkspace.workspaceId;
}
