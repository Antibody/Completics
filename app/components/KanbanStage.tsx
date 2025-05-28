// components/KanbanStage.tsx

'use client';

import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import KanbanTask from './KanbanTask';
import { useDroppable } from '@dnd-kit/core';
import { useIsMobile } from '../hooks/useIsMobile';
import { TaskData, StageData, ProjectForSelect, VerForSelect } from './KanbanBoard';

// Bin/Trash SVG Icon
const BinIcon: React.FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
};

interface KanbanStageProps {
  id: string;
  title: string;
  tasks: TaskData[];
  onTaskUpdated: (
    id: string,
    updates: Partial<TaskData>
  ) => Promise<void>;
  onTaskDeleted: (id: string) => Promise<void>;
  onFocusStage?: (id: string) => void;
  allStages?: StageData[];
  allProjects?: ProjectForSelect[];
  allVers?: VerForSelect[];
  onMoveTask?: (taskId: string, targetStageId: string) => void;
  doneStageId?: string | null;
  onArchiveTask?: (taskId: string) => Promise<void>;
  isReadOnly?: boolean;
  onAddModalClick?: (stageId: string) => void;
  onDeleteStage?: (stageId: string, stageTitle: string) => void;
  showOnboardingEffect?: boolean;
  isFirstOnboardingStage?: boolean;
  onDismissOnboardingEffect?: () => void;
  showArchiveOnboarding?: boolean;
  dismissArchiveOnboarding?: () => void;
  showDragTaskOnboarding?: boolean;
  dismissDragTaskOnboarding?: () => void;
  workspaceId: string;
}

const getStageBgClasses = (
  title: string,
  isOver: boolean
): string => {
  const map: Record<string, { def: string; over: string }> = {
    'To Do': {
      def: 'bg-blue-100/40 dark:bg-blue-800/40',
      over: 'bg-blue-200/40 dark:bg-blue-700/40',
    },
    'In Progress': {
      def: 'bg-cyan-100/40 dark:bg-cyan-800/40',
      over: 'bg-cyan-200/40 dark:bg-cyan-700/40',
    },
    'Done': {
      def: 'bg-green-100/40 dark:bg-green-800/40',
      over: 'bg-green-200/40 dark:bg-green-700/40',
    },
  };
  const fallback = {
    def: 'bg-gray-100/40 dark:bg-gray-700/40',
    over: 'bg-gray-200/40 dark:bg-gray-600/40',
  };
  const { def, over } = map[title] ?? fallback;
  return isOver ? over : def;
};

const KanbanStage: React.FC<KanbanStageProps> = ({
  id,
  title,
  tasks,
  onTaskUpdated,
  onTaskDeleted,
  onFocusStage,
  allStages,
  allProjects,
  allVers,
  onMoveTask,
  doneStageId,
  onArchiveTask,
  isReadOnly = false,
  onAddModalClick,
  showOnboardingEffect = false,
  isFirstOnboardingStage = false,
  onDismissOnboardingEffect,
  showArchiveOnboarding = false,
  dismissArchiveOnboarding,
  showDragTaskOnboarding = false,
  dismissDragTaskOnboarding,
  onDeleteStage,
  workspaceId,
}) => {
  // Set up droppable area for DnD
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'stage', stageId: id },
    disabled: isReadOnly,
  });

  const isMobile = useIsMobile();
  const addTaskButtonRef = useRef<HTMLButtonElement>(null);
  const [addTaskHintPosition, setAddTaskHintPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Initialize portal container for onboarding hints
  useEffect(() => {
    setPortalContainer(document.getElementById('hint-portal-root'));
  }, []);

  // Position onboarding hint when first stage is shown
  useEffect(() => {
    if (showOnboardingEffect && isFirstOnboardingStage && addTaskButtonRef.current) {
      const rect = addTaskButtonRef.current.getBoundingClientRect();
      setAddTaskHintPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    } else {
      setAddTaskHintPosition(null);
    }
  }, [showOnboardingEffect, isFirstOnboardingStage]);

  const baseClasses = 'p-4 rounded-lg shadow-md flex flex-col overflow-hidden';
  const bgClasses = getStageBgClasses(title, isOver);
  const headerBg = getStageBgClasses(title, false);

  const handleDeleteStage = (): void => {
    if (isReadOnly) return;
    onDeleteStage?.(id, title);
  };

  return (
    <div
      ref={setNodeRef}
      className={`${baseClasses} ${bgClasses} transition-colors duration-150 ease-in-out h-full`}
      style={{ position: 'relative' }}
    >
      {/* Stage header */}
      <div
        className={`mb-4 flex items-center justify-between p-1 flex-shrink-0 ${
          isMobile ? `sticky top-0 ${headerBg} z-10` : ''
        }`}
      >
        <h3
          className={`text-sm font-semibold text-[var(--column-header-text)] uppercase tracking-wider ${
            isMobile && onFocusStage ? 'cursor-pointer' : ''
          }`}
          onClick={() => isMobile && onFocusStage?.(id)}
        >
          {title}
        </h3>

        {/* Add Task Button */}
        {!isReadOnly && onAddModalClick && (
          <div className="relative onboarding-text-container">
            <button
              ref={addTaskButtonRef}
              onClick={() => {
                if (showOnboardingEffect && isFirstOnboardingStage && onDismissOnboardingEffect) {
                  onDismissOnboardingEffect();
                }
                onAddModalClick(id);
              }}
              className={`ml-2 p-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-[var(--column-header-text)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                showOnboardingEffect && isFirstOnboardingStage ? 'pulsate-plus-btn' : ''
              }`}
              aria-label={`Add task to ${title}`}
              title={`Add task to ${title}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            {/* Onboarding floating hint */}
            {portalContainer &&
              addTaskHintPosition &&
              showOnboardingEffect &&
              isFirstOnboardingStage &&
              ReactDOM.createPortal(
                <div
                  className="onboarding-floating-text"
                  style={{
                    position: 'fixed',
                    top: `${addTaskHintPosition.top}px`,
                    left: `${addTaskHintPosition.left}px`,
                    transform: 'translateX(-50%)',
                    zIndex: 10000,
                  }}
                >
                  Click to create new task
                </div>,
                portalContainer
              )}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-grow overflow-y-auto p-1 mb-2">
        {tasks.map((task, index) => (
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
            tags={task.tags}
            onUpdateTask={onTaskUpdated}
            onDeleteTask={onTaskDeleted}
            isMobile={isMobile}
            allStages={allStages}
            allProjects={allProjects}
            allVers={allVers}
            onMoveTask={onMoveTask}
            doneStageId={doneStageId === null ? undefined : doneStageId}
            onArchiveTask={onArchiveTask}
            isReadOnly={isReadOnly}
            showArchiveOnboarding={showArchiveOnboarding && task.stage_id === doneStageId}
            onDismissArchiveOnboarding={dismissArchiveOnboarding}
            showDragTaskOnboarding={index === 0 && showDragTaskOnboarding}
            dismissDragTaskOnboarding={index === 0 ? dismissDragTaskOnboarding : undefined}
            workspaceId={workspaceId}
          />
        ))}
      </div>

      {/* Delete Stage Button */}
      {!isReadOnly && (
        <button
          onClick={handleDeleteStage}
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: 'var(--button-danger-bg)',
            color: 'var(--button-danger-text)',
            border: 'none',
            borderRadius: '4px',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s ease',
          }}
          title={`Delete stage "${title}"`}
          aria-label={`Delete stage "${title}"`}
        >
          <BinIcon />
        </button>
      )}
    </div>
  );
};

export default KanbanStage;
