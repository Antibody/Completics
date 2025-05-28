// app/components/ProjectsManager.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';
import KanbanTask from './KanbanTask';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  useDroppable
} from '@dnd-kit/core';
import { TaskData, StageData, ProjectForSelect, VerForSelect } from './KanbanBoard'; 
import { TagBadgeProps } from './TagBadge'; 

// Use ProjectForSelect from KanbanBoard, or define if it has more properties here
interface Project extends ProjectForSelect {
  description: string | null;
  created_at: string;
  start_date?: string | null;
  finish_date?: string | null;
  user_id?: string;
}

// AssociatedTask should extend TaskData for consistency
// The interface AssociatedTask was removed as it was redundant (extended TaskData without adding new members).

interface SupabaseTaskWithTags {
  id: string;
  title: string;
  description: string | null;
  stage_id: string;
  order: number;
  due_date: string | null;
  project_id: string | null;
  ver_id: string | null;
  is_archived: boolean;
  workspace_id: string;
  task_tags: {
    tags: {
      id: string;
      name: string;
      color: string | null;
    };
  }[];
}

const ProjectsManager: React.FC = () => {
  const { session, user } = useAuth();
  const { refetchFilterData } = useFilters();
  const isMobile = useIsMobile();

  const styles = {
    container: { display: 'flex', height: 'calc(100vh - 56px)', backgroundColor: 'var(--background)' },
    projectsListPanel: { width: '350px', padding: '16px', borderRight: '1px solid var(--card-border)', overflowY: 'auto', backgroundColor: 'var(--background-surface)', display: 'flex', flexDirection: 'column' },
    tasksPanel: { flexGrow: 1, padding: '16px', overflowY: 'auto', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' },
    formSection: { marginBottom: '20px', padding: '15px', border: '1px solid var(--input-border)', borderRadius: '8px', backgroundColor: 'var(--card-bg)' },
    inputGroup: { marginBottom: '10px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: '500', color: 'var(--foreground-secondary)' },
    input: { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--input-border)', boxSizing: 'border-box', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)'  },
    button: { padding: '8px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--button-primary-bg)', color: 'var(--button-primary-text)', marginRight: '8px' },
    buttonSecondary: { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--button-secondary-border)' },
    projectListItem: { listStyle: 'none', padding: '10px', border: '1px solid var(--input-border)', borderRadius: '8px', marginBottom: '10px', backgroundColor: 'var(--card-bg)', cursor: 'pointer' },
    projectListItemSelected: { backgroundColor: 'var(--column-border-hover)'},
    taskListItem: { listStyle: 'none', padding: '10px', border: '1px solid var(--input-border)', borderRadius: '8px', marginBottom: '8px', backgroundColor: 'var(--card-bg)' },
    error: { color: 'var(--text-error)', marginBottom: '15px', padding: '10px', border: '1px solid var(--text-error)', borderRadius: '4px' },
    loading: { textAlign: 'center', padding: '20px', color: 'var(--foreground-secondary)' },
    colorPickerInput: { width: 'calc(100% - 100px)', padding: '8px', borderRadius: '4px', border: '1px solid var(--input-border)', boxSizing: 'border-box', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', verticalAlign: 'middle' },
    colorSwatchButton: { width: '80px', height: '38px', marginLeft: '8px', verticalAlign: 'middle', border: '1px solid var(--input-border)', borderRadius: '4px' },
    scrollableList: { flexGrow: 1, overflowY: 'auto', listStyle: 'none', padding: 0 },
    tasksDisplayArea: { flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden' },
    dndContextContainer: { flexGrow: 1, display: 'flex', flexDirection: 'row', gap: '16px', overflowX: 'auto', overflowY: 'hidden' }
  } as const;

  const [projects, setProjects] = useState<Project[]>([]);
  const [allStages, setAllStages] = useState<StageData[]>([]);
  const [allVers, setAllVers] = useState<VerForSelect[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [loadingStages, setLoadingStages] = useState<boolean>(true);
  const [loadingVers, setLoadingVers] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [associatedTasks, setAssociatedTasks] = useState<TaskData[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);

  const [activeDraggedTaskData, setActiveDraggedTaskData] = useState<TaskData | null>(null);

  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectDescription, setNewProjectDescription] = useState<string>('');
  const [newProjectColor, setNewProjectColor] = useState<string>('#000000');
  const [newProjectStartDate, setNewProjectStartDate] = useState<string>('');
  const [newProjectFinishDate, setNewProjectFinishDate] = useState<string>('');
  const [newProjectStartDateError, setNewProjectStartDateError] = useState<string | null>(null);
  const [newProjectFinishDateError, setNewProjectFinishDateError] = useState<string | null>(null);

  const validateDates = (start: string, finish: string): string | null => {
    if (start && finish) {
      const startDate = new Date(start);
      const finishDate = new Date(finish);
      if (startDate >= finishDate) {
        return "Start date must be before finish date.";
      }
    }
    return null;
  };

  const fetchInitialData = useCallback(async () => {
    if (!session || !user) {
      setLoadingProjects(false); setLoadingStages(false); setLoadingVers(false);
      setError("You must be logged in to manage projects.");
      return;
    }
    setLoadingProjects(true); setLoadingStages(true); setLoadingVers(true);
    setError(null);
    try {
      const projectsPromise = supabase.from('projects').select('id, name, description, color, created_at, start_date, finish_date, user_id');
      const stagesPromise = supabase.from('stages').select('id, title, order, workspace_id'); // Added workspace_id
      const versPromise = supabase.from('vers').select('id, name, project_id'); // Added project_id

      const [{ data: projectsData, error: projectsError },
             { data: stagesData, error: stagesError },
             { data: versData, error: versError }] = await Promise.all([projectsPromise, stagesPromise, versPromise]);

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);
      if (stagesError) throw stagesError;
      const sortedStages = (stagesData || []).sort((a, b) => a.order - b.order);
      setAllStages(sortedStages);
      if (versError) throw versError;
      setAllVers(versData || []);
    } catch (err: unknown) {
      console.error("Error fetching initial data:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setLoadingProjects(false); setLoadingStages(false); setLoadingVers(false);
    }
  }, [session, user]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  const fetchTasksForProject = useCallback(async (projectId: string) => {
    if (!session || !user) {
        setError("You must be logged in to fetch tasks for a project.");
        setLoadingTasks(false);
        return;
    }
    setLoadingTasks(true);
    setError(null);
    setAssociatedTasks([]);
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags (
            tags ( id, name, color )
          )
        `)
        .eq('project_id', projectId)
        .order('stage_id')
        .order('order', { ascending: true });
      if (tasksError) throw tasksError;

      const processedTasks: TaskData[] = (tasksData || []).map((t: SupabaseTaskWithTags) => {
        const tgs: TagBadgeProps[] =
          t.task_tags
            ?.map((tt) => tt.tags)
            .filter((tag): tag is { id: string; name: string; color: string | null } => tag !== null)
            .map((tag) => ({
              id: tag.id,
              name: tag.name,
              color: tag.color ?? null,
            })) || [];

        return {
          id: t.id,
          title: t.title,
          description: t.description,
          stage_id: t.stage_id,
          order: t.order,
          due_date: t.due_date,
          project_id: t.project_id,
          ver_id: t.ver_id,
          is_archived: t.is_archived ?? false,
          workspace_id: t.workspace_id || '',
          tags: tgs,
        };
      });
      setAssociatedTasks(processedTasks);
    } catch (err: unknown) {
      console.error(`Error fetching tasks for project ${projectId}:`, err);
      setError(err instanceof Error ? err.message : `Please Refresh the Page. As an unknown error occurred while fetching tasks for project.`);
    } finally {
      setLoadingTasks(false);
    }
  }, [session, user]);

  const handleSelectProject = (projectId: string) => {
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null); setAssociatedTasks([]);
    } else {
      setSelectedProjectId(projectId); fetchTasksForProject(projectId);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) { setError("Project name cannot be empty."); return; }
    if (!user) { setError("User not authenticated. Cannot create project."); return; }

    // Date validation
    setNewProjectStartDateError(null);
    setNewProjectFinishDateError(null);
    const dateValidationError = validateDates(newProjectStartDate, newProjectFinishDate);
    if (dateValidationError) {
      setNewProjectFinishDateError(dateValidationError);
      setError(null);
      return;
    }
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
          color: newProjectColor,
          start_date: newProjectStartDate || null,
          finish_date: newProjectFinishDate || null,
          user_id: user.id
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) {
        setProjects((prev) => [data as Project, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        refetchFilterData();
      } else {
        fetchInitialData();
        refetchFilterData();
      }
      setNewProjectName(''); setNewProjectDescription(''); setNewProjectColor('#000000');
      setNewProjectStartDate(''); setNewProjectFinishDate('');
      setNewProjectStartDateError(null);
      setNewProjectFinishDateError(null);
    } catch (err: unknown) {
      console.error("Error creating project:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This may unlink it from associated tasks.')) return;
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('projects').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
        setAssociatedTasks([]);
      }
    } catch (err: unknown) {
      console.error(`Error deleting project ${id}:`, err);
      setError(err instanceof Error ? err.message : "An unknown error occurred while deleting project.");
    }
  };

  const handleDragStartProjectsPage = useCallback((event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'task') {
      const task = associatedTasks.find(t => t.id === active.id);
      if (task) {
        setActiveDraggedTaskData(task);
      }
    }
  }, [associatedTasks]);

  const handleDragEndProjectsPage = useCallback((event: DragEndEvent) => {
    setActiveDraggedTaskData(null);
    const { active, over } = event;
    if (!over || !active.data.current || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const targetStageId = over.data.current?.type === 'stage' ? overId : over.data.current?.stage_id as string;

    if (!targetStageId) return;

    const activeTask = associatedTasks.find(t => t.id === activeId);
    if (!activeTask) return;

    setAssociatedTasks(prevTasks => {
      const taskToMove = prevTasks.find(t => t.id === activeId);
      if (!taskToMove) return prevTasks;

      let newOrderInStage: number;
      const tasksInTargetStage = prevTasks.filter(t => t.stage_id === targetStageId && t.id !== activeId);

      if (over.data.current?.type === 'task') {
        const overTask = prevTasks.find(t => t.id === overId);
        if (overTask) {
          newOrderInStage = overTask.order;
        } else {
          newOrderInStage = tasksInTargetStage.length;
        }
      } else {
        newOrderInStage = tasksInTargetStage.length;
      }

      const tempTasks = prevTasks.map(t =>
        t.id === activeId ? { ...t, stage_id: targetStageId, order: -1 } : t
      );

      const finalTasksInTargetStage = tempTasks
        .filter(t => t.stage_id === targetStageId)
        .sort((a,b) => a.order - b.order);

      const draggedTaskIndex = finalTasksInTargetStage.findIndex(t => t.id === activeId);
      if (draggedTaskIndex !== -1) finalTasksInTargetStage.splice(draggedTaskIndex, 1);

      let insertAtIndex = finalTasksInTargetStage.findIndex(t => t.order >= newOrderInStage);
      if (insertAtIndex === -1) insertAtIndex = finalTasksInTargetStage.length;
      finalTasksInTargetStage.splice(insertAtIndex, 0, { ...taskToMove, stage_id: targetStageId, order: newOrderInStage });

      finalTasksInTargetStage.forEach((t, index) => t.order = index);

      const otherTasks = tempTasks.filter(t => t.stage_id !== targetStageId);
      const newAssociatedTasks = [...otherTasks, ...finalTasksInTargetStage].sort((a,b) => (a.stage_id.localeCompare(b.stage_id) || a.order - b.order));

      const taskForDb = newAssociatedTasks.find(t => t.id === activeId);

      if (taskForDb) {
        supabase.from('tasks').update({ stage_id: taskForDb.stage_id, order: taskForDb.order })
          .eq('id', activeId)
          .then(({ error: updateError }) => {
            if (updateError) {
              console.error("Error DND update task:", updateError);
              if (selectedProjectId) fetchTasksForProject(selectedProjectId);
            } else {
               if (selectedProjectId) fetchTasksForProject(selectedProjectId);
            }
          });
      }
      return newAssociatedTasks;
    });
  }, [associatedTasks, selectedProjectId, fetchTasksForProject]);

  if (!session || !user) {
    if (loadingProjects || loadingStages || loadingVers) {
        return <p style={styles.loading}>Loading...</p>;
    }
    return <p style={styles.error}>{error || "You must be logged in to view this page."}</p>;
  }

  const selectedProjectDetails = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;

  const handleTaskUpdatePlaceholder = async (
    taskId: string,
    updates: Partial<TaskData> // Use Partial<TaskData>
  ) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
      if (updateError) throw updateError;
      if (selectedProjectId) fetchTasksForProject(selectedProjectId);
    } catch (err) {
      console.error("Error updating task from Projects page:", err);
      setError(err instanceof Error ? err.message : "Failed to update task.");
    }
  };
  const handleTaskDeletePlaceholder = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (deleteError) throw deleteError;
      if (selectedProjectId) fetchTasksForProject(selectedProjectId);
    } catch (err) {
      console.error("Error deleting task from Projects page:", err);
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    }
  };

  const handleArchiveTaskPlaceholder = async (taskId: string) => {
    setError(null);
    try {
      const { error: archiveError } = await supabase
        .from('tasks')
        .update({ is_archived: true })
        .eq('id', taskId);
      if (archiveError) throw archiveError;
      if (selectedProjectId) fetchTasksForProject(selectedProjectId);
    } catch (err) {
      console.error("Error archiving task from Projects page:", err);
      setError(err instanceof Error ? err.message : "Failed to archive task.");
    }
  };

  const calculateDaysRemaining = (finishDateStr?: string | null): string => {
    if (!finishDateStr) return "N/A";
    const finishDate = new Date(finishDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    finishDate.setHours(0,0,0,0);

    if (isNaN(finishDate.getTime())) return "Invalid Date";

    const diffTime = finishDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day(s)`;
    if (diffDays === 0) return "Due today";
    return `${diffDays} day(s) remaining`;
  };

  return (
    <div style={styles.container}>
      <aside style={styles.projectsListPanel}>
        <h2 style={{ flexShrink: 0 }}>Projects</h2>
        {(loadingProjects || loadingStages || loadingVers) && !error && <p style={styles.loading}>Loading Data…</p>}
        {error && <p style={styles.error}>{error}</p>}

        <div style={{...styles.formSection, flexShrink: 0 }}>
          <h3>Create New Project</h3>
          <div style={styles.inputGroup}>
            <label htmlFor="newProjectName" style={styles.label}>Name*:</label>
            <input id="newProjectName" type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Project name" style={styles.input} />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="newProjectDescription" style={styles.label}>Description:</label>
            <textarea id="newProjectDescription" value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="Description (optional)" style={styles.input} rows={2} />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="newProjectColor" style={styles.label}>Color:</label>
            <input id="newProjectColor" type="color" value={newProjectColor} onChange={(e) => setNewProjectColor(e.target.value)} style={styles.colorSwatchButton} />
          </div>
          <div style={{...styles.inputGroup, position: 'relative' }}>
            <label htmlFor="newProjectStartDate" style={styles.label}>Start Date:</label>
            <input id="newProjectStartDate" type="date" value={newProjectStartDate} onChange={(e) => {
              setNewProjectStartDate(e.target.value);
              setNewProjectStartDateError(null);
              setNewProjectFinishDateError(null);
            }} style={styles.input} />
            {newProjectStartDateError && <div className="date-validation-hint">{newProjectStartDateError}</div>}
          </div>
          <div style={{...styles.inputGroup, position: 'relative' }}>
            <label htmlFor="newProjectFinishDate" style={styles.label}>Finish Date:</label>
            <input id="newProjectFinishDate" type="date" value={newProjectFinishDate} onChange={(e) => {
              setNewProjectFinishDate(e.target.value);
              setNewProjectFinishDateError(null);
              if (newProjectStartDate) {
                const validationError = validateDates(newProjectStartDate, e.target.value);
                if (validationError) setNewProjectFinishDateError(validationError);
              }
            }} style={styles.input} />
            {newProjectFinishDateError && <div className="date-validation-hint">{newProjectFinishDateError}</div>}
          </div>
          <button onClick={handleCreateProject} style={styles.button}>+ Add Project</button>
        </div>

        <h3 style={{ flexShrink: 0 }}>Existing Projects</h3>
        {!loadingProjects && projects.length === 0 && <p style={{ flexShrink: 0 }}>No projects found.</p>}
        <ul style={styles.scrollableList}>
          {projects.map((project) => (
            <li
              key={project.id}
              style={{
                ...styles.projectListItem,
                ...(selectedProjectId === project.id ? styles.projectListItemSelected : {}),
                borderLeft: `5px solid ${project.color || 'transparent'}`
              }}
              onClick={() => handleSelectProject(project.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: selectedProjectId === project.id ? 'bold' : 'normal' }}>{project.name}</span>
                <div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                    style={{...styles.buttonSecondary, padding: '2px 6px', fontSize: '0.8em', background: 'transparent', border:'none' }}
                    aria-label="Delete project"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {project.description && <p style={{ fontSize: '0.9em', margin: '4px 0 0', color: 'var(--text-subtle)'}}>{project.description}</p>}
            </li>
          ))}
        </ul>
      </aside>

      <section style={styles.tasksPanel}>
        {selectedProjectId && selectedProjectDetails ? (
          <>
            <div style={{marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
              <h2>{selectedProjectDetails.name}</h2>
              {selectedProjectDetails.description && <p style={{fontSize: '0.9em', color: 'var(--text-subtle)'}}>{selectedProjectDetails.description}</p>}
              {selectedProjectDetails.start_date &&
                <p style={{fontSize: '0.9em'}}>
                  Start: {new Date(selectedProjectDetails.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              }
              {selectedProjectDetails.finish_date &&
                <p style={{fontSize: '0.9em'}}>
                  Finish: {new Date(selectedProjectDetails.finish_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  <span style={{marginLeft: '10px', fontStyle: 'italic'}}>({calculateDaysRemaining(selectedProjectDetails.finish_date)})</span>
                </p>
              }
            </div>

            <div style={styles.tasksDisplayArea}>
              <DndContext
                onDragStart={handleDragStartProjectsPage}
                onDragEnd={handleDragEndProjectsPage}
                collisionDetection={closestCenter}
              >
                {(loadingStages || loadingVers) && !error && <p style={styles.loading}>Loading stage/ver data...</p>}
                {!loadingStages && !loadingVers && allStages.length > 0 ? (
                  <div style={styles.dndContextContainer}>
                    {allStages.map(stage => {
                      const StageTasks = ({ tasksInStage }: { tasksInStage: TaskData[] }) => (
                        <ul style={{ listStyle: 'none', padding: 0, minHeight: '50px' }}>
                          {tasksInStage.map(task => (
                            <KanbanTask
                              key={task.id}
                              id={task.id}
                              title={task.title}
                              description={task.description}
                              stage_id={task.stage_id}
                              order={task.order}
                              due_date={task.due_date}
                              project_id={task.project_id}
                              ver_id={task.ver_id}
                              is_archived={task.is_archived}
                              tags={task.tags} // Pass tags
                              allProjects={projects.map(p => ({id: p.id, name: p.name, color: p.color}))}
                              allVers={allVers}
                              allStages={allStages.map(s => ({id: s.id, title: s.title, order: s.order, workspace_id: s.workspace_id}))} // Pass full StageData
                              onUpdateTask={handleTaskUpdatePlaceholder}
                              onDeleteTask={handleTaskDeletePlaceholder}
                              onArchiveTask={handleArchiveTaskPlaceholder}
                              doneStageId={currentDoneStageId ? currentDoneStageId : undefined}
                              isMobile={isMobile}
                              highlightColor={selectedProjectDetails?.color || undefined}
                              workspaceId={task.workspace_id}
                            />
                          ))}
                        </ul>
                      );

                      const DroppableStage = ({ stage, children }: { stage: StageData, children: React.ReactNode }) => {
                        const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: 'stage', stageId: stage.id } });
                        return (
                          <div
                            ref={setNodeRef}
                            key={stage.id}
                            style={{
                              flex: '0 0 300px',
                              padding: '8px',
                              backgroundColor: isOver ? 'var(--column-border-hover)' : 'var(--column-bg)',
                              borderRadius: '8px',
                              height: 'fit-content',
                              maxHeight: '100%',
                              overflowY: 'auto'
                            }}
                          >
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1em', color: 'var(--column-header-text)' }}>{stage.title}</h3>
                            {children}
                          </div>
                        );
                      };

                      const tasksInStage = associatedTasks
                        .filter(task => task.stage_id === stage.id)
                        .sort((a, b) => a.order - b.order);

                      const currentDoneStageId: string | null = allStages.find(s => s.title.toLowerCase() === 'done')?.id || null;

                      return (
                        <DroppableStage stage={stage} key={stage.id}>
                          {tasksInStage.length === 0 && <p style={{fontSize: '0.9em', color: 'var(--text-subtle)'}}>No tasks here.</p>}
                          <StageTasks tasksInStage={tasksInStage} />
                        </DroppableStage>
                      );
                    })}
                  </div>
                ) : (
                  !loadingTasks && !(loadingStages || loadingVers) && !error && <p>No stages defined to display tasks.</p>
                )}
                <DragOverlay dropAnimation={null}>
                  {activeDraggedTaskData ? (
                    <KanbanTask
                      id={activeDraggedTaskData.id}
                      title={activeDraggedTaskData.title}
                      description={activeDraggedTaskData.description}
                      stage_id={activeDraggedTaskData.stage_id}
                      order={activeDraggedTaskData.order}
                      due_date={activeDraggedTaskData.due_date}
                      project_id={activeDraggedTaskData.project_id}
                      ver_id={activeDraggedTaskData.ver_id}
                      is_archived={activeDraggedTaskData.is_archived}
                      tags={activeDraggedTaskData.tags} // Pass tags
                      allProjects={projects.map(p => ({id: p.id, name: p.name, color: p.color}))}
                      allVers={allVers}
                      allStages={allStages.map(s => ({id: s.id, title: s.title, order: s.order, workspace_id: s.workspace_id}))} // Pass full StageData
                      onUpdateTask={handleTaskUpdatePlaceholder}
                      onDeleteTask={handleTaskDeletePlaceholder}
                      onArchiveTask={handleArchiveTaskPlaceholder}
                      doneStageId={(allStages.find(s => s.title.toLowerCase() === 'done')?.id || null) ? (allStages.find(s => s.title.toLowerCase() === 'done')?.id) : undefined}
                      isMobile={isMobile}
                      highlightColor={selectedProjectDetails?.color || undefined}
                      workspaceId={activeDraggedTaskData.workspace_id}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </>
        ) : (
          <div style={{textAlign: 'center', color: 'var(--foreground-secondary)', paddingTop: '50px'}}>
            <p>Select a Project from the list to view its details and associated tasks.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectsManager;
