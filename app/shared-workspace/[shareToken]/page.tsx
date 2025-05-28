'use client';

'use client';

'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // Hook to get route parameters
import KanbanBoard, { StageData, TaskData } from '../../components/KanbanBoard'; // Assuming StageData and TaskData are defined in KanbanBoard.tsx
import { useAuth } from '../../contexts/AuthContext';

interface PublicWorkspaceData {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  public_share_mode?: string | null;
  is_shared_publicly?: boolean;
}

interface PublicTaskData {
  id: string;
  title: string;
  description?: string | null;
  stage_id: string;
  order: number;
  due_date?: string | null;
  project_id?: string | null;
  ver_id?: string | null;
  created_at: string;
  // Add tags property if it's part of the shared workspace API response
  tags?: { tag_id: string; name: string; color: string }[];
}

interface PublicProjectData {
  id: string;
  name: string;
  color?: string | null;
}

interface PublicVerData {
  id: string;
  name: string;
}

interface SharedWorkspaceApiResponse {
  success: boolean;
  workspace: PublicWorkspaceData;
  stages: StageData[];
  tasks: PublicTaskData[];
  projects: PublicProjectData[];
  vers: PublicVerData[];
  error?: string;
}

export default function SharedWorkspacePage() {
  const params = useParams();
  const shareToken = params?.shareToken as string | undefined;
  const { session, loading: authLoading } = useAuth();

  const [workspaceData, setWorkspaceData] = useState<PublicWorkspaceData | null>(null);
  const [stages, setStages] = useState<StageData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const initialTheme = (storedTheme === 'light' || storedTheme === 'dark') ? storedTheme : 'dark';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(initialTheme);
  }, []);

  useEffect(() => {
    if (!shareToken) {
      setError('Share token not found in URL.');
      setIsLoading(false);
      return;
    }

    const fetchSharedWorkspace = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public/workspaces/${shareToken}`);
        const data: SharedWorkspaceApiResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Failed to fetch shared workspace (status: ${response.status})`);
        }

        setWorkspaceData(data.workspace);
        setStages(data.stages);
        const mappedTasks: TaskData[] = data.tasks.map(task => ({
          ...task,
          description: task.description,
          is_archived: false,
          workspace_id: data.workspace.id,
          tags: task.tags?.map(tag => ({ id: tag.tag_id, name: tag.name, color: tag.color || null })) || [],
        }));
        setTasks(mappedTasks);

      } catch (fetchErr: unknown) {
        console.error("Error fetching shared workspace:", fetchErr);
        setError(fetchErr instanceof Error ? fetchErr.message : 'An unknown error occurred while fetching the workspace.');
        setWorkspaceData(null);
        setStages([]);
        setTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedWorkspace();
  }, [shareToken]);

  const baseMainStyle: React.CSSProperties = {
    fontFamily: 'var(--font-geist-sans)',
    backgroundColor: 'var(--background)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    color: 'var(--foreground)',
  };

  const centeredMessageStyle: React.CSSProperties = {
    ...baseMainStyle,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '20px',
  };

  if (isLoading || authLoading) {
    return <main style={centeredMessageStyle}><div>Loading shared workspace...</div></main>;
  }

  if (error) {
    return <main style={centeredMessageStyle}><div style={{ color: 'var(--text-error)' }}>Error: {error}</div></main>;
  }

  if (!workspaceData) {
    return <main style={centeredMessageStyle}><div>Shared workspace could not be loaded.</div></main>;
  }

  const isEditableForViewer = workspaceData.public_share_mode === 'editable' && !!session;

  return (
    <>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: '56px',
          backgroundColor: 'var(--header-bg)',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--foreground)' }}>
          {workspaceData.name}
        </span>
        <span style={{ fontSize: '0.9rem', color: 'var(--foreground-secondary)' }}>
          {isEditableForViewer ? '(Shared - Editable)' : '(Shared - Read-Only)'}
        </span>
      </header>

      <main style={{ ...baseMainStyle, minHeight: 'calc(100vh - 56px)' }}>
        <KanbanBoard
          workspaceId={workspaceData.id}
          initialStages={isEditableForViewer ? undefined : stages}
          initialTasks={isEditableForViewer ? undefined : tasks}
          isReadOnly={!isEditableForViewer}
          selectedProjectFilterId={null}
          selectedVerFilterId={null} // Changed from selectedVersionFilterId
        />
      </main>
    </>
  );
}
