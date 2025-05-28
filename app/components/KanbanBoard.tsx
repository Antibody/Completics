// components/KanbanBoard.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import KanbanStage from './KanbanStage'; // Will be renamed to KanbanStage
import KanbanTask from './KanbanTask'; // Will be renamed to KanbanTask
import StageModal from './StageModal'; // Will be renamed to StageModal
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useSearch } from '../contexts/SearchContext';
import { useFilters } from '../contexts/FilterContext'; // Import useFilters
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  MouseSensor, // Added for stage DnD
  TouchSensor, // Added for stage DnD
  useSensor,   // Added for stage DnD
  useSensors,  // Added for stage DnD
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove, // Utility for reordering
} from '@dnd-kit/sortable'; // Added for stage DnD
import { CSS } from '@dnd-kit/utilities'; // Added for stage DnD
import { useIsMobile } from '../hooks/useIsMobile';
import FloatingActionButton from './FloatingActionButton';
import CentralizedAddModal from './CentralizedAddModal'; // Will be renamed to CentralizedAddModal
import AddStageModal from './AddStageModal'; // Will be renamed to AddStageModal
import DeleteStageModal from './DeleteStageModal'; // Will be renamed to DeleteStageModal
import ToastNotification from './ToastNotification'; // Added ToastNotification import

import { TagBadgeProps } from './TagBadge'; // Changed from LabelBadge

// -----------------------------------------------------------------------------
//  Interfaces
// -----------------------------------------------------------------------------

interface TaskTagJoin { // Changed from CardLabelJoin
  tags: { // Changed from labels
    id: string;
    name: string;
    color: string | null;
  };
}

interface SupabaseTaskData {
  id: string;
  title: string;
  description?: string | null;
  stage_id: string;
  order: number;
  due_date?: string | null;
  project_id?: string | null;
  ver_id?: string | null;
  is_archived?: boolean | null;
  workspace_id?: string | null;
  task_tags?: TaskTagJoin[] | null;
}

export interface TaskData {
  id: string;
  title: string;
  description?: string | null; // Allow null or undefined
  stage_id: string;
  order: number;
  due_date?: string | null;
  project_id?: string | null;
  ver_id?: string | null;
  is_archived: boolean; // Must be boolean
  workspace_id: string; // Must be string
  tags?: TagBadgeProps[];
  assigned_tags?: TagBadgeProps[];
}

export interface StageData {
  id: string;
  title: string;
  order: number;
  workspace_id: string;
}

export interface ProjectForSelect {
  id: string;
  name: string;
  color?: string | null;
}

export interface VerForSelect {
  id: string;
  name: string;
  project_id?: string | null;
}

export interface KanbanBoardProps { // Exported for use in other pages
  workspaceId: string;
  initialStages?: StageData[];
  initialTasks?: TaskData[];
  isReadOnly?: boolean;
  selectedProjectFilterId: string | null;
  selectedVerFilterId: string | null;
  selectedTagIds?: string[];
  showOnboardingEffect?: boolean;
  onDismissOnboardingEffect?: () => void;
  isAddStageModalOpen?: boolean;
  onCloseAddStageModal?: () => void;
  onDeleteStage?: (stageId: string) => void;
  hasUserCreatedFirstTaskEver?: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  workspaceId,
  initialStages,
  initialTasks,
  isReadOnly = false,
  selectedProjectFilterId,
  selectedVerFilterId,
  selectedTagIds = [],
  showOnboardingEffect = false,
  onDismissOnboardingEffect,
  isAddStageModalOpen: isAddStageModalOpenFromPage,
  onCloseAddStageModal: onCloseAddStageModalFromPage,
  hasUserCreatedFirstTaskEver, // Renamed from hasUserCreatedFirstCardEver
}) => {
  const [stages, setStages] = useState<StageData[]>(initialStages || []);
  const [allTasks, setAllTasks] = useState<TaskData[]>(initialTasks || []);
  const [tasks, setTasks] = useState<TaskData[]>(initialTasks || []);
  const [isLoadingBoard, setIsLoadingBoard] = useState<boolean>(
    !initialStages && !isReadOnly
  );
  const [error, setError] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{
    key: number;
    message: string;
    type: 'success' | 'error' | 'info';
    actionText?: string;
    onActionClick?: () => void;
  } | null>(null);
  const [showArchiveOnboarding, setShowArchiveOnboarding] = useState<boolean>(false);

  const [showDeleteStageModal, setShowDeleteStageModal] = useState<boolean>(false);
  const [stageToDeleteId, setStageToDeleteId] = useState<string | null>(null);
  const [stageToDeleteTitle, setStageToDeleteTitle] = useState<string>('');
  const [isDeletingStage, setIsDeletingStage] = useState<boolean>(false);
  const [deleteStageError, setDeleteStageError] = useState<string | null>(null);

  const [showDragTaskOnboarding, setShowDragTaskOnboarding] = useState<boolean>(false);
  const [onboardingTaskRect, setOnboardingTaskRect] = useState<DOMRect | null>(null);
  const [onboardingTaskId, setOnboardingTaskId] = useState<string | null>(null);

  const { session, isDbSetupInProgress, user } = useAuth();
  const { searchTerm } = useSearch();
  const { allProjectsForFilter, allVersForFilter } = useFilters(); // Removed allTagsForFilter as it's not directly used here
  const isMobile = useIsMobile();

  const [activeDraggedTask, setActiveDraggedTask] = useState<TaskData | null>(null);
  const [activeDraggedStage, setActiveDraggedStage] = useState<StageData | null>(null);
  const [focusedStageId, setFocusedStageId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [stageIdForNewTask, setStageIdForNewTask] = useState<string | null>(null);

  const hasFetched = useRef<boolean>(false);

  const tagIdsKey = useMemo(
    () =>
      selectedTagIds.length > 0
        ? [...selectedTagIds].sort().join('|')
        : '',
    [selectedTagIds]
  );

  const fetchData = useCallback(async (): Promise<void> => {
    console.log('KanbanBoard: fetchData START for workspaceId:', workspaceId);
    if (!session || !user || !workspaceId) {
      setIsLoadingBoard(false);
      if (!workspaceId && session) setError('No active workspace selected.');
      else if (!session) setError('Not authenticated.');
      return;
    }
    if (isDbSetupInProgress) {
      setIsLoadingBoard(true);
      return;
    }

    setIsLoadingBoard(true);
    setError(null);

    try {
      const stagesPromise = supabase
        .from('stages')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('order', { ascending: true });

      const tasksPromise = supabase
        .from('tasks')
        .select(`
          *,
          task_tags (
            tags ( id, name, color )
          )
        `)
        .eq('workspace_id', workspaceId)
        .eq('is_archived', false)
        .order('stage_id')
        .order('order', { ascending: true });

      const [
        { data: stagesData, error: stagesError },
        { data: tasksData, error: tasksError },
      ] = await Promise.all([stagesPromise, tasksPromise]);

      if (stagesError) throw stagesError;
      if (tasksError) throw tasksError;

      setStages(stagesData || []);

      const processed: TaskData[] = (tasksData as SupabaseTaskData[] || []).map((t) => {
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
          description: t.description, // Keep as string | null | undefined
          stage_id: t.stage_id,
          order: t.order,
          due_date: t.due_date,
          project_id: t.project_id,
          ver_id: t.ver_id,
          is_archived: t.is_archived ?? false, // Ensure it's always boolean
          workspace_id: t.workspace_id || '', // Ensure it's always string
          tags: tgs,
          assigned_tags: tgs,
        };
      });

      console.log('KanbanBoard: fetchData SUCCESS, processed tasks count:', processed.length, processed);
      setAllTasks(processed);
    } catch (err: unknown) {
      console.error('KanbanBoard: fetchData ERROR', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingBoard(false);
    }
  }, [session, user, workspaceId, isDbSetupInProgress]);

  useEffect(() => {
    if (isReadOnly && initialStages) {
      setIsLoadingBoard(false);
      return;
    }
    if (
      !hasFetched.current &&
      session &&
      user &&
      workspaceId &&
      !isDbSetupInProgress
    ) {
      hasFetched.current = true;
      void fetchData();
    }
  }, [
    session,
    user,
    workspaceId,
    isDbSetupInProgress,
    isReadOnly,
    initialStages,
    fetchData,
  ]);

  useEffect(() => {
    console.log('KanbanBoard: Filtering useEffect triggered. Deps:', {
      allTasksLength: allTasks.length,
      allTasksData: allTasks,
      selectedProjectFilterId,
      selectedVerFilterId,
      selectedTagIds,
      searchTerm,
      tagIdsKey
    });
    let filtered = allTasks;

    if (selectedProjectFilterId) {
      filtered = filtered.filter((t) => t.project_id === selectedProjectFilterId);
    }

    if (selectedVerFilterId) {
      filtered = filtered.filter((t) => t.ver_id === selectedVerFilterId);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      );
    }

    if (selectedTagIds && selectedTagIds.length > 0) {
      filtered = filtered.filter((t) =>
        selectedTagIds.every((tagId) =>
          t.tags?.some((tg) => tg.id === tagId)
        )
      );
    }

    console.log('KanbanBoard: Filtering result count:', filtered.length, filtered);
    setTasks(filtered);
  }, [
    allTasks,
    selectedProjectFilterId,
    selectedVerFilterId,
    searchTerm,
    selectedTagIds,
    tagIdsKey,
  ]);

  useEffect(() => {
    if (user && user.id && !isReadOnly && !hasUserCreatedFirstTaskEver && allTasks.length === 1) {
      const dragOnboardingKey = `kanban_drag_onboarding_shown_${user.id}`;
      try {
        const hasDragOnboardingBeenShown = localStorage.getItem(dragOnboardingKey);
        if (!hasDragOnboardingBeenShown) {
          console.log('[KanbanBoard] Triggering drag task onboarding animation.');
          setShowDragTaskOnboarding(true);
          if (allTasks.length > 0) {
            setOnboardingTaskId(allTasks[0].id);
          }
          localStorage.setItem(dragOnboardingKey, 'true');
        }
      } catch (e) {
        console.error("Error accessing localStorage for drag onboarding:", e);
      }
    }
  }, [allTasks, hasUserCreatedFirstTaskEver, user, isReadOnly]);

  const handleRegisterOnboardingTaskPosition = useCallback((taskId: string, rect: DOMRect) => {
    console.log('[KanbanBoard] handleRegisterOnboardingTaskPosition called:', { taskId, rect });
    if (taskId === onboardingTaskId) {
      setOnboardingTaskRect(rect);
    }
  }, [onboardingTaskId]);

  const dismissDragTaskOnboarding = useCallback(() => {
    setShowDragTaskOnboarding(false);
    setOnboardingTaskRect(null);
    setOnboardingTaskId(null);
  }, []);

  useEffect(() => {
    console.log('[KanbanBoard] Archive Onboarding Init Effect RUNNING. User:', user?.id, 'isReadOnly:', isReadOnly);
    if (user && user.id && !isReadOnly) {
      const onboardingKey = `kanban_archive_onboarding_shown_${user.id}`;
      try {
        const hasBeenShown = localStorage.getItem(onboardingKey);
        console.log(`[KanbanBoard] localStorage key '${onboardingKey}' value:`, hasBeenShown);
        if (!hasBeenShown) {
          console.log('[KanbanBoard] Setting showArchiveOnboarding to TRUE');
          setShowArchiveOnboarding(true);
        } else {
          console.log('[KanbanBoard] Setting showArchiveOnboarding to FALSE (already shown)');
          setShowArchiveOnboarding(false);
        }
      } catch (e) {
        console.error("[KanbanBoard] Error accessing localStorage for archive onboarding:", e);
        setShowArchiveOnboarding(false);
      }
    } else {
      console.log('[KanbanBoard] Setting showArchiveOnboarding to FALSE (no user or read-only)');
      setShowArchiveOnboarding(false);
    }
  }, [user, isReadOnly]);

  const dismissArchiveOnboarding = useCallback(() => {
    console.log('[KanbanBoard] dismissArchiveOnboarding CALLED. User:', user?.id);
    if (user && user.id && !isReadOnly) {
      const onboardingKey = `kanban_archive_onboarding_shown_${user.id}`;
      try {
        localStorage.setItem(onboardingKey, 'true');
        console.log(`[KanbanBoard] localStorage key '${onboardingKey}' SET to true.`);
        setShowArchiveOnboarding(false);
      } catch (e) {
        console.error("[KanbanBoard] Error setting localStorage for archive onboarding:", e);
      }
    }
  }, [user, isReadOnly]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent): void => {
    const { active } = event;
    const type = active.data.current?.type;

    if (type === 'task') {
      const task = tasks.find((t) => t.id === active.id);
      if (task) setActiveDraggedTask(task);
      setActiveDraggedStage(null);
    } else if (type === 'stage') {
      const stage = stages.find((s) => s.id === active.id);
      if (stage) setActiveDraggedStage(stage);
      setActiveDraggedTask(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveDraggedTask(null);
    setActiveDraggedStage(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;

    if (activeType === 'stage') {
      setStages((prevStages) => {
        const oldIndex = prevStages.findIndex(stage => stage.id === active.id);
        const newIndex = prevStages.findIndex(stage => stage.id === over.id);
        
        if (oldIndex === -1 || newIndex === -1) return prevStages;

        const newOrderedStages = arrayMove(prevStages, oldIndex, newIndex);
        
        const updates = newOrderedStages.map((stage, index) => ({
          ...stage,
          order: index,
        }));

        setStages(updates);

        const dbUpdates = updates
          .filter((stage, index) => stage.order !== prevStages.find(ps => ps.id === stage.id)?.order || stage.id !== prevStages[index]?.id)
          .map(stage => supabase.from('stages').update({ order: stage.order }).eq('id', stage.id));
        
        Promise.all(dbUpdates)
          .then(results => {
            const anyError = results.some(r => r.error);
            if (anyError) {
              setError('Failed to reorder stages. Reverting.');
              console.error("Stage reorder failed", results.map(r => r.error).filter(Boolean));
              setStages(prevStages);
            } else {
              setToastInfo({ key: Date.now(), message: 'Stages reordered.', type: 'success' });
            }
          })
          .catch(dbError => {
            setError('Error persisting stage reorder: ' + dbError.message);
            setStages(prevStages);
          });
        
        return updates;
      });
    } else if (activeType === 'task') {
      const activeId = active.id as string;
      const overId = over.id as string;
      const overIsTask = over.data.current?.type === 'task';
      const overIsStage = over.data.current?.type === 'stage';

      setTasks((prev) => {
        const copy = [...prev];
        const fromIndex = copy.findIndex((t) => t.id === activeId);
        if (fromIndex === -1) return prev;
        
        const movingTask = { ...copy[fromIndex] };
        const originalStageId = movingTask.stage_id;

        let targetStageId = originalStageId;
        if (overIsStage) {
          targetStageId = overId;
        } else if (overIsTask) {
          targetStageId = over.data.current?.stage_id as string;
        }

        if (originalStageId !== targetStageId) {
          movingTask.stage_id = targetStageId;
          movingTask.order = copy.filter(t => t.stage_id === targetStageId).length;
          
          copy.splice(fromIndex, 1);
          copy.push(movingTask);

          const updatedTasksForUI = copy.map(t => ({...t}));
          
          let orderInNewStage = 0;
          updatedTasksForUI.filter(t => t.stage_id === targetStageId).sort((a,b) => a.order - b.order).forEach(t => {
            if (t.stage_id === targetStageId) t.order = orderInNewStage++;
          });
          if (originalStageId !== targetStageId) {
            let orderInOldStage = 0;
            updatedTasksForUI.filter(t => t.stage_id === originalStageId).sort((a,b) => a.order - b.order).forEach(t => {
              if (t.stage_id === originalStageId) t.order = orderInOldStage++;
            });
          }

          supabase
            .from('tasks')
            .update({ stage_id: targetStageId, order: movingTask.order })
            .eq('id', activeId)
            .then(({ error: dbError }) => {
              if (dbError) {
                setError('Failed to move task: ' + dbError.message);
                fetchData();
              } else {
                setAllTasks(prevAllTasks => {
                  const updatedAllTasks = prevAllTasks.map(task => {
                    if (task.id === activeId) {
                      return { ...task, stage_id: targetStageId, order: movingTask.order };
                    }
                    return task;
                  });
                  return updatedAllTasks;
                });

                if (targetStageId === doneStageId && showArchiveOnboarding && user && !isReadOnly) {
                  // Logic for archive onboarding
                }
              }
            });
          return updatedTasksForUI.sort((a,b) => a.stage_id.localeCompare(b.stage_id) || a.order - b.order);

        } else if (overIsTask && activeId !== overId) {
          const toIndex = copy.findIndex((t) => t.id === overId);
          if (toIndex === -1) return prev;

          copy.splice(fromIndex, 1);
          copy.splice(toIndex, 0, movingTask);

          let currentOrder = 0;
          const updates = [];
          for (const task of copy) {
            if (task.stage_id === targetStageId) {
              if (task.order !== currentOrder) {
                task.order = currentOrder;
                updates.push(supabase.from('tasks').update({ order: task.order }).eq('id', task.id));
              }
              currentOrder++;
            }
          }
          
          if (updates.length > 0) {
            Promise.all(updates).then((results) => {
              const anyError = results.some(r => r.error);
              if (anyError) {
                setError('Failed to reorder tasks.');
                fetchData();
              }
            });
          }
          return copy.sort((a,b) => a.stage_id.localeCompare(b.stage_id) || a.order - b.order);
        }
        return prev;
      });
    }
  };

  const handleUpdateTaskInDb = async (
    taskId: string,
    updates: Partial<TaskData>
  ): Promise<void> => {
    const { error: ue } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);
    if (ue) setError(`Failed to update: ${ue.message}`);
    void fetchData();
  };

  const handleDeleteTaskInDb = async (taskId: string): Promise<void> => {
    const { error: de } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    if (de) setError(`Failed to delete: ${de.message}`);
    void fetchData();
  };

  const handleMoveTask = async (
    taskId: string,
    targetStageId: string
  ): Promise<void> => {
    await supabase
      .from('tasks')
      .update({ stage_id: targetStageId, order: 0 })
      .eq('id', taskId);
    void fetchData();
  };

  const handleReorderLocalTasks = (newTasks: TaskData[]): void => setTasks(newTasks);
  const openAddModal = (stageId?: string): void => {
    setStageIdForNewTask(stageId || null);
    setIsAddModalOpen(true);
  };
  const closeAddModal = (): void => {
    setIsAddModalOpen(false);
    setStageIdForNewTask(null);
  };
  const handleNewTaskAdded = (): void => {
    void fetchData();
    closeAddModal();
  };

  const openDeleteStageModal = (stageId: string, stageTitle: string): void => {
    setStageToDeleteId(stageId);
    setStageToDeleteTitle(stageTitle);
    setDeleteStageError(null);
    setShowDeleteStageModal(true);
  };

  const handleStageAdded = async (): Promise<void> => {
    await fetchData();
    if (onCloseAddStageModalFromPage) {
      onCloseAddStageModalFromPage();
    }
    setToastInfo({
      key: Date.now(),
      message: 'New stage added successfully!',
      type: 'success',
    });
  };

  const handleDeleteStageInDb = async (stageId: string): Promise<void> => {
    setIsDeletingStage(true);
    setDeleteStageError(null);
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete stage. Status: ${response.status}`);
      }

      setToastInfo({
        key: Date.now(),
        message: 'Stage deleted successfully!',
        type: 'success',
      });
      setShowDeleteStageModal(false);
      setStageToDeleteId(null);
      setStageToDeleteTitle('');
      void fetchData();
    } catch (err) {
      console.error('Failed to delete stage:', err);
      const msg = err instanceof Error ? err.message : 'An unknown error occurred during stage deletion.';
      setDeleteStageError(msg);
      setToastInfo({
        key: Date.now(),
        message: msg,
        type: 'error',
      });
    } finally {
      setIsDeletingStage(false);
    }
  };

  const handleUndoArchive = async (taskId: string): Promise<void> => {
    const targetStageId = doneStageId;

    if (!targetStageId) {
      const errorMessage = "Could not find 'Done' stage to unarchive to. Please ensure a 'Done' stage exists.";
      setError(errorMessage);
      setToastInfo({
        key: Date.now(),
        message: errorMessage,
        type: 'error',
      });
      return;
    }

    await handleUpdateTaskInDb(taskId, { is_archived: false, stage_id: targetStageId, order: 0 });
    setToastInfo({
      key: Date.now(),
      message: 'Task unarchived and moved to "Done".',
      type: 'success',
    });
  };

  const handleArchiveTask = async (taskId: string): Promise<void> => {
    const taskToArchive = allTasks.find(task => task.id === taskId);
    if (!taskToArchive) {
      setError("Task not found for archiving.");
      return;
    }

    await handleUpdateTaskInDb(taskId, { is_archived: true });
    setToastInfo({
      key: Date.now(),
      message: `Task "${taskToArchive.title}" was archived. You can find it in the archive tab.`,
      type: 'info',
      actionText: 'Undo',
      onActionClick: () => handleUndoArchive(taskId),
    });
  };

  const doneStageId =
    stages.find((s) => s.title.toLowerCase() === 'done')?.id ?? null;

  if (isLoadingBoard) {
    return (
      <div style={{ textAlign: 'center', padding: 20, fontSize: '1.2em' }}>
        Loading Kanban Board…
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 20,
          color: 'var(--text-error)',
          fontSize: '1.2em',
        }}
      >
        Error: {error}
      </div>
    );
  }
  if (!isReadOnly && !workspaceId) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        Select a workspace to get started or create a new one.
      </div>
    );
  }

  const BoardBodyContent = (
    <div
      style={{
        display: 'flex',
        flexGrow: 1,
        padding: '0 24px 24px 24px',
        backgroundColor: 'var(--background)',
        overflowX: 'auto',
        overflowY: 'hidden',
        gap: 16,
        flexDirection: 'row',
        scrollSnapType: isMobile ? 'x mandatory' : undefined,
      }}
      className={isMobile ? 'kanban-board' : undefined}
    >
      {stages.map((stage, index) => (
        <SortableStage
          key={stage.id}
          stage={stage}
          isReadOnly={isReadOnly}
          tasks={tasks}
          isMobile={isMobile}
          onTaskUpdated={isReadOnly ? async () => {} : handleUpdateTaskInDb}
          onTaskDeleted={isReadOnly ? async () => {} : handleDeleteTaskInDb}
          onFocusStage={setFocusedStageId}
          allStages={stages}
          allProjects={allProjectsForFilter}
          allVers={allVersForFilter}
          onMoveTask={isReadOnly ? async () => {} : handleMoveTask}
          doneStageId={doneStageId}
          onArchiveTask={isReadOnly ? async () => {} : handleArchiveTask}
          onAddModalClick={isReadOnly ? undefined : openAddModal}
          onDeleteStage={
            isReadOnly
              ? undefined
              : (stageId: string) => {
                  const stage = stages.find(s => s.id === stageId);
                  if (stage) {
                    openDeleteStageModal(stageId, stage.title);
                  }
                }
          }
          showOnboardingEffect={showOnboardingEffect && !isReadOnly}
          isFirstOnboardingStage={index === 0 && !isReadOnly}
          onDismissOnboardingEffect={onDismissOnboardingEffect}
          showArchiveOnboarding={showArchiveOnboarding && !isReadOnly && stage.id === doneStageId}
          dismissArchiveOnboarding={dismissArchiveOnboarding}
          showDragTaskOnboarding={index === 0 && showDragTaskOnboarding}
          dismissDragTaskOnboarding={dismissDragTaskOnboarding}
          onRegisterOnboardingTaskPosition={handleRegisterOnboardingTaskPosition}
          workspaceId={workspaceId}
        />
      ))}
    </div>
  );

  const BoardBody = isReadOnly ? BoardBodyContent : (
    <SortableContext items={stages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
      {BoardBodyContent}
    </SortableContext>
  );

  console.log('[KanbanBoard] RENDERING. Current showArchiveOnboarding state:', showArchiveOnboarding, 'DoneStageId:', doneStageId);
  return (
    <>
      {toastInfo && (
        <ToastNotification
          key={toastInfo.key}
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
          actionText={toastInfo.actionText}
          onActionClick={toastInfo.onActionClick}
        />
      )}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
      >
        {BoardBody}
        <DragOverlay dropAnimation={null}>
          {activeDraggedTask && (
            <KanbanTask
              id={activeDraggedTask.id}
              title={activeDraggedTask.title}
              description={activeDraggedTask.description}
              stage_id={activeDraggedTask.stage_id}
              order={activeDraggedTask.order}
              due_date={activeDraggedTask.due_date}
              project_id={activeDraggedTask.project_id}
              ver_id={activeDraggedTask.ver_id}
              is_archived={activeDraggedTask.is_archived}
              tags={activeDraggedTask.tags} // Changed from assigned_tags
              allProjects={allProjectsForFilter}
              allVers={allVersForFilter}
              onUpdateTask={async () => {}}
              onDeleteTask={async () => {}}
              isMobile={isMobile}
              allStages={stages}
              doneStageId={doneStageId ?? undefined}
              onArchiveTask={async () => {}}
              isReadOnly
              workspaceId={workspaceId}
            />
          )}
          {activeDraggedStage && !isReadOnly && (
            <div style={{ opacity: 0.7, background: 'var(--column-bg)', padding: '10px', borderRadius: 'var(--column-border-radius)', border: '1px solid var(--border-color)', minWidth: 'var(--column-width)' }}>
              <h3>{activeDraggedStage.title}</h3>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showDragTaskOnboarding && onboardingTaskRect && (
        <div
          className="drag-onboarding-container"
          style={{
            position: 'fixed',
            left: `${onboardingTaskRect.right + 10}px`,
            top: `${onboardingTaskRect.top + onboardingTaskRect.height / 2}px`,
            transform: 'translateY(-50%)',
            zIndex: 10000,
          }}
        >
          <div className="drag-onboarding-arrow">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="#000"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8.59003 16.59L13.17 12L8.59003 7.41L10 6L16 12L10 18L8.59003 16.59Z" />
            </svg>
          </div>
          <div className="drag-onboarding-text">
            You can drag task to another stage
          </div>
        </div>
      )}

      {isMobile && focusedStageId && (
        <StageModal
          stage={stages.find((s) => s.id === focusedStageId)!}
          stages={stages}
          tasks={tasks
            .filter((t) => t.stage_id === focusedStageId)
            .sort((a, b) => a.order - b.order)}
          onClose={() => setFocusedStageId(null)}
          onMoveTask={handleMoveTask}
          onUpdateTask={handleUpdateTaskInDb}
          onDeleteTask={handleDeleteTaskInDb}
          onReorderLocal={handleReorderLocalTasks}
          allProjects={allProjectsForFilter}
          allVers={allVersForFilter}
          doneStageId={doneStageId ?? undefined}
          onArchiveTask={handleArchiveTask}
          isReadOnly={isReadOnly}
          showArchiveOnboarding={showArchiveOnboarding && !isReadOnly && focusedStageId === doneStageId}
          dismissArchiveOnboarding={dismissArchiveOnboarding}
          workspaceId={workspaceId}
        />
      )}

      {!isReadOnly && session && user && workspaceId && (
        <>
          <FloatingActionButton onClick={openAddModal} />
          <CentralizedAddModal
            isOpen={isAddModalOpen}
            onClose={closeAddModal}
            onTaskAdded={handleNewTaskAdded}
            stages={stages}
            allProjects={allProjectsForFilter}
            allVers={allVersForFilter}
            workspaceId={workspaceId}
            initialStageId={stageIdForNewTask}
          />
          {workspaceId && !isReadOnly && isAddStageModalOpenFromPage && onCloseAddStageModalFromPage && (
            <AddStageModal
              isOpen={isAddStageModalOpenFromPage}
              onClose={onCloseAddStageModalFromPage}
              onStageAdded={handleStageAdded}
              workspaceId={workspaceId}
            />
          )}
        </>
      )}

      {showDeleteStageModal && stageToDeleteId && (
        <DeleteStageModal
          isOpen={showDeleteStageModal}
          onClose={() => setShowDeleteStageModal(false)}
          onConfirmDelete={handleDeleteStageInDb}
          stageTitle={stageToDeleteTitle}
          stageId={stageToDeleteId}
          isDeleting={isDeletingStage}
          errorMessage={deleteStageError}
        />
      )}
    </>
  );
};

interface SortableStageProps {
  stage: StageData;
  tasks: TaskData[];
  isReadOnly: boolean;
  isMobile: boolean;
  onTaskUpdated: (taskId: string, updates: Partial<TaskData>) => Promise<void>;
  onTaskDeleted: (taskId: string) => Promise<void>;
  onFocusStage: (stageId: string | null) => void;
  allStages: StageData[];
  allProjects: ProjectForSelect[];
  allVers: VerForSelect[];
  onMoveTask: (taskId: string, targetStageId: string) => Promise<void>;
  doneStageId: string | null;
  onArchiveTask: (taskId: string) => Promise<void>;
  onAddModalClick?: (stageId?: string) => void;
  onDeleteStage?: (stageId: string) => void;
  showOnboardingEffect?: boolean;
  isFirstOnboardingStage?: boolean;
  onDismissOnboardingEffect?: () => void;
  showArchiveOnboarding?: boolean;
  dismissArchiveOnboarding?: () => void;
  showDragTaskOnboarding?: boolean;
  dismissDragTaskOnboarding?: () => void;
  onRegisterOnboardingTaskPosition?: (taskId: string, rect: DOMRect) => void;
  workspaceId: string;
}

const SortableStage: React.FC<SortableStageProps> = (props) => {
  const { stage, tasks, isReadOnly, isMobile, workspaceId, ...kanbanStageProps } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage.id,
    data: {
      type: 'stage',
      item: stage,
    }
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const flexItemClasses = isMobile
    ? 'flex-shrink-0 w-[85vw] min-w-[85vw] snap-start h-full'
    : 'flex-1 min-w-[280px] h-full';

  if (isReadOnly) {
    return (
       <KanbanStage
        id={stage.id}
        title={stage.title}
        tasks={tasks.filter(t => t.stage_id === stage.id).sort((a,b) => a.order - b.order)}
        isReadOnly={isReadOnly}
        workspaceId={workspaceId}
        {...kanbanStageProps}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={flexItemClasses}
      {...attributes}
      {...listeners}
    >
      <KanbanStage
        id={stage.id}
        title={stage.title}
        tasks={tasks.filter(t => t.stage_id === stage.id).sort((a,b) => a.order - b.order)}
        isReadOnly={isReadOnly}
        workspaceId={workspaceId}
        {...kanbanStageProps}
      />
    </div>
  );
};

export default KanbanBoard;
