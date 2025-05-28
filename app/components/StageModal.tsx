'use client';

import React, { useCallback, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import KanbanTask from './KanbanTask';
import { TaskData, StageData, ProjectForSelect, VerForSelect } from './KanbanBoard'; // Import types from KanbanBoard

interface StageModalProps {
  stage: StageData;
  stages: StageData[];
  tasks: TaskData[]; // Use imported TaskData
  onClose: () => void;
  onMoveTask: (taskId: string, targetStageId: string) => void;
  onUpdateTask: (
    id: string,
    updates: Partial<TaskData> // Use Partial<TaskData>
  ) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  allProjects?: ProjectForSelect[]; // Use imported ProjectForSelect
  allVers?: VerForSelect[]; // Use imported VerForSelect
  doneStageId?: string | null;
  onArchiveTask?: (taskId: string) => Promise<void>;
  isReadOnly?: boolean;
  showArchiveOnboarding?: boolean;
  dismissArchiveOnboarding?: () => void;
  workspaceId: string;
  onReorderLocal?: (newTasks: TaskData[]) => void; // Re-added this prop as it was in KanbanBoard's StageModal usage
}

const StageModal: React.FC<StageModalProps> = ({
  stage,
  stages,
  tasks,
  onClose,
  onMoveTask,
  onUpdateTask,
  onDeleteTask,
  allProjects = [],
  allVers = [],
  doneStageId,
  onArchiveTask,
  isReadOnly = false,
  showArchiveOnboarding = false,
  dismissArchiveOnboarding,
  workspaceId,
  onReorderLocal, // Destructure onReorderLocal
}) => {
  const [activeTask, setActiveTask] = useState<TaskData | null>(null);

  const handleDragStart = useCallback(
    (e: DragStartEvent): void => {
      const { active } = e;
      if (active.data.current?.type === 'task') {
        const task = tasks.find((t) => t.id === active.id);
        if (task) {
          setActiveTask(task);
        }
      }
    },
    [tasks],
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent): void => {
      if (isReadOnly) {
        return;
      }
      setActiveTask(null);
      const { active, over } = e;
      if (!over) {
        return;
      }

      if (
        active.id !== over.id &&
        active.data.current?.type === 'task' &&
        over.data.current?.type === 'task'
      ) {
        const newTasks = [...tasks];
        const fromIndex = newTasks.findIndex((t) => t.id === active.id);
        const toIndex = newTasks.findIndex((t) => t.id === over.id);
        if (fromIndex === -1 || toIndex === -1) {
          return;
        }

        const [moved] = newTasks.splice(fromIndex, 1);
        newTasks.splice(toIndex, 0, moved);
        newTasks.forEach((t, idx) => {
          t.order = idx;
        });
        if (onReorderLocal) { // Call onReorderLocal if it exists
          onReorderLocal(newTasks);
        }
      }
    },
    [tasks, isReadOnly, onReorderLocal],
  );

  if (isReadOnly) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: '#fff',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            padding: '16px',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f4f5f7',
          }}
        >
          <h2 style={{ margin: 0 }}>{stage.title}</h2>
          <button
            onClick={onClose}
            aria-label="Close stage view"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '1.5rem',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {tasks.map((task) => (
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
              tags={task.tags} // Use tags from TaskData
              allProjects={allProjects}
              allVers={allVers}
              onUpdateTask={async () => {}}
              onDeleteTask={async () => {}}
              isMobile
              allStages={stages}
              onMoveTask={async () => {}}
              doneStageId={doneStageId === null ? undefined : doneStageId}
              onArchiveTask={async () => {}}
              isReadOnly={isReadOnly}
              showArchiveOnboarding={showArchiveOnboarding && task.stage_id === doneStageId}
              onDismissArchiveOnboarding={dismissArchiveOnboarding}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#fff',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '16px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f4f5f7',
        }}
      >
        <h2 style={{ margin: 0 }}>{stage.title}</h2>
        <button
          onClick={onClose}
          aria-label="Close stage view"
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </header>

      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
      >
        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {tasks.map((task) => (
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
              allProjects={allProjects}
              allVers={allVers}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              isMobile
              allStages={stages}
              onMoveTask={onMoveTask}
              doneStageId={doneStageId === null ? undefined : doneStageId}
              onArchiveTask={onArchiveTask}
              isReadOnly={isReadOnly}
              showArchiveOnboarding={showArchiveOnboarding && task.stage_id === doneStageId}
              onDismissArchiveOnboarding={dismissArchiveOnboarding}
              workspaceId={workspaceId}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <KanbanTask
              id={activeTask.id}
              title={activeTask.title}
              description={activeTask.description}
              stage_id={activeTask.stage_id}
              order={activeTask.order}
              due_date={activeTask.due_date}
              project_id={activeTask.project_id}
              ver_id={activeTask.ver_id}
              is_archived={activeTask.is_archived}
              tags={activeTask.tags} // Use tags from TaskData
              allProjects={allProjects}
              allVers={allVers}
              onUpdateTask={async () => {}}
              onDeleteTask={async () => {}}
              isMobile
              allStages={stages}
              doneStageId={doneStageId === null ? undefined : doneStageId}
              onArchiveTask={onArchiveTask}
              isReadOnly={true}
              workspaceId={workspaceId}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default StageModal;
