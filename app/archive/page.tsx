'use client';

import React, { useState, useEffect, useCallback } from 'react';
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import KanbanTask from '../components/KanbanTask';
import { StageData, TaskData, ProjectForSelect, VerForSelect } from '../components/KanbanBoard';
// ArchivedTaskData should align with TaskData for consistency
// The interface ArchivedTaskData was removed as it was redundant (extended TaskData without adding new members).

const ArchivePage: React.FC = () => {
  const { session, user } = useAuth();
  const [archivedTasks, setArchivedTasks] = useState<TaskData[]>([]);
  const [allStages, setAllStages] = useState<StageData[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectForSelect[]>([]);
  const [allVers, setAllVers] = useState<VerForSelect[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArchivedData = useCallback(async () => {
    if (!session || !user) {
      setLoading(false);
      setError("You must be logged in to view archived tasks.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch user's workspaces
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('user_id', user.id);

      if (workspacesError) throw workspacesError;
      if (!workspacesData || workspacesData.length === 0) {
        setArchivedTasks([]);
        setAllStages([]);
        setLoading(false);
        return;
      }
      const userWorkspaceIds = workspacesData.map(workspace => workspace.id);

      // 2. Fetch archived tasks from those workspaces, including workspace_id
      const tasksPromise = supabase
        .from('tasks')
        .select('*, allProjects:projects(id,name,color), allVers:vers(id,name)')
        .in('workspace_id', userWorkspaceIds)
        .eq('is_archived', true)
        .order('title', { ascending: true });

      // 3. Fetch stages from those workspaces (for unarchiving to "Done")
      const stagesPromise = supabase
        .from('stages')
        .select('*')
        .in('workspace_id', userWorkspaceIds)
        .order('order');
      
      // 4. Fetch user's projects and vers
      const projectsPromise = supabase.from('projects').select('id, name, color');
      const versPromise = supabase.from('vers').select('id, name');

      const [
        { data: tasksData, error: tasksError },
        { data: stagesData, error: stagesError },
        { data: projectsData, error: projectsError },
        { data: versData, error: versError },
      ] = await Promise.all([tasksPromise, stagesPromise, projectsPromise, versPromise]);

      if (tasksError) throw tasksError;
      if (stagesError) throw stagesError;
      if (projectsError) throw projectsError;
      if (versError) throw versError;
      
      setArchivedTasks(tasksData || []);
      setAllStages(stagesData || []);
      setAllProjects(projectsData || []);
      setAllVers(versData || []);

    } catch (err: unknown) {
      console.error('Error fetching archived data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setArchivedTasks([]);
      setAllStages([]);
    } finally {
      setLoading(false);
    }
  }, [session, user]);

  useEffect(() => {
    fetchArchivedData();
  }, [fetchArchivedData]);

  const handleUnarchiveTask = async (taskId: string) => {
    setError(null);
    
    const taskToUnarchive = archivedTasks.find(task => task.id === taskId);
    if (!taskToUnarchive) {
      setError("Task not found in archived list.");
      return;
    }

    const doneStageForWorkspace = allStages.find(
      stage => stage.workspace_id === taskToUnarchive.workspace_id && stage.title.toLowerCase() === 'done'
    );

    const targetStageId = doneStageForWorkspace
      ? doneStageForWorkspace.id
      : (allStages.find(stage => stage.workspace_id === taskToUnarchive.workspace_id)?.id || null);

    if (!targetStageId) {
      setError(`Could not find a target stage on workspace ${taskToUnarchive.workspace_id} to unarchive to.`);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ is_archived: false, stage_id: targetStageId, order: 0 })
        .eq('id', taskId);
      if (updateError) throw updateError;
      fetchArchivedData();
    } catch (err) {
      console.error(`Error unarchiving task ${taskId}:`, err);
      setError(err instanceof Error ? err.message : "Failed to unarchive task.");
    }
  };
  
  const handleUpdateTask = async (taskId: string, updates: Partial<TaskData>) => {
    console.log(`Update task ${taskId} from archive:`, updates);
    // This function is currently a placeholder. If actual updates are needed from the archive page,
    // it should call supabase.from('tasks').update(updates).eq('id', taskId) and then fetchData().
    // For now, it just logs.
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm("Are you sure you want to permanently delete this task? This action cannot be undone.")) {
      setError(null);
      try {
        const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId);
        if (deleteError) throw deleteError;
        fetchArchivedData();
      } catch (err) {
        console.error(`Error deleting task ${taskId} from archive:`, err);
        setError(err instanceof Error ? err.message : "Failed to delete task permanently.");
      }
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--foreground)' }}>Loading archived tasks...</div>;
  }
    
  if (!session || !user) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--foreground)' }}>{error || "Please log in to view archived tasks."}</div>;
  }

  if (error && !loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-error)' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', backgroundColor: 'var(--background)', minHeight: 'calc(100vh - 56px)', color: 'var(--foreground)' }}>
      <h1 style={{ marginBottom: '20px', color: 'var(--foreground-emphasis)' }}>Archived Tasks</h1>
      {archivedTasks.length === 0 ? (
        <p>No archived tasks found.</p>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {archivedTasks.map(task => (
            <div
              key={task.id}
              style={{
                border: '1px solid var(--card-border-archived, #718096)',
                borderRadius: '8px',
                padding: '10px',
                backgroundColor: 'var(--card-bg-archived, #e2e8f0)'
              }}
            >
              <KanbanTask
                id={task.id}
                title={task.title}
                description={task.description}
                stage_id={task.stage_id}
                order={task.order}
                due_date={task.due_date}
                project_id={task.project_id}
                ver_id={task.ver_id}
                is_archived={task.is_archived}
                allProjects={allProjects}
                allVers={allVers}
                allStages={allStages}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                workspaceId={task.workspace_id}
              />
              <button
                onClick={() => handleUnarchiveTask(task.id)}
                style={{
                  marginTop: '10px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--button-secondary-bg)',
                  color: 'var(--button-secondary-text)',
                  border: '1px solid var(--button-secondary-border)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Unarchive
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArchivePage;
