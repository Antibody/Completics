// app/components/CentralizedAddModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import AddTaskForm from './AddTaskForm';
import { StageData, ProjectForSelect, VerForSelect } from '../components/KanbanBoard';

interface CentralizedAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded: () => void;
  stages: StageData[];
  allProjects?: ProjectForSelect[];
  allVers?: VerForSelect[];
  workspaceId: string;
  initialStageId?: string | null;
}
interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

const stageColors: { [key: string]: string } = {
  'To Do': 'bg-blue-500 hover:bg-blue-600',
  'In Progress': 'bg-cyan-500 hover:bg-cyan-600',
  'Done': 'bg-green-500 hover:bg-green-600',
};
const getStageButtonColor = (stageTitle: string): string => {
  return stageColors[stageTitle] || 'bg-gray-500 hover:bg-gray-600';
};

const CentralizedAddModal: React.FC<CentralizedAddModalProps> = ({
  isOpen,
  onClose,
  onTaskAdded,
  stages,
  allProjects = [],
  allVers = [],
  workspaceId,
  initialStageId,
}) => {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(initialStageId ?? null);
  const [showForm, setShowForm] = useState<boolean>(() => !!initialStageId);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tagsLoading, setTagsLoading] = useState<boolean>(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen) {
      const currentInitialId = initialStageId;
      if (!prevIsOpen.current) {
        if (currentInitialId) {
          setSelectedStageId(currentInitialId);
          setShowForm(true);
          fetchTags();
        } else {
          setSelectedStageId(null);
          setShowForm(false);
        }
      } else {
        if (selectedStageId !== (currentInitialId ?? null)) {
          setSelectedStageId(currentInitialId ?? null);
        }
        const newShowFormState = !!currentInitialId;
        if (showForm !== newShowFormState) {
          setShowForm(newShowFormState);
        }
        if (currentInitialId && !tags.length && !tagsLoading && !tagsError) {
        }
      }
    } else {
      setSelectedStageId(null);
      setShowForm(false);
      setTags([]);
      setSelectedTagIds(new Set());
      setTagsError(null);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialStageId, tags.length, tagsError, tagsLoading, selectedStageId, showForm]);

  const fetchTags = async () => {
    setTagsLoading(true);
    setTagsError(null);
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data: Tag[] = await res.json();
      setTags(data);
    } catch (err) {
      console.error('Error fetching tags:', err);
      setTagsError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTagsLoading(false);
    }
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const handleTaskSuccessfullyAdded = () => {
    onTaskAdded();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-30"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h5 className="text-xl font-semibold text-gray-800 dark:text-white">
            Add New Task
          </h5>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Target Stage:
          </p>
          <div className="flex flex-wrap gap-2">
            {stages.map(stage => (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  setSelectedStageId(stage.id);
                  setShowForm(true);
                  if (!tags.length && !tagsLoading && !tagsError) {
                    fetchTags();
                  }
                }}
                className={`
                  ${getStageButtonColor(stage.title)}
                  px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${selectedStageId === stage.id
                    ? 'ring-2 ring-offset-2 ring-black dark:ring-white'
                    : ''}
                `}
              >
                {stage.title}
              </button>
            ))}
          </div>
          {!showForm && !initialStageId && stages.length > 0 && (
            <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-md">
              Please select a target stage above to proceed with adding your task.
            </p>
          )}
        </div>

        {showForm && selectedStageId && (
          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assign Tags:
            </p>
            {tagsLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading tags…
              </p>
            )}
            {tagsError && (
              <p className="text-sm text-red-500">{tagsError}</p>
            )}
            {!tagsLoading && !tagsError && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={`
                      flex items-center px-2 py-1 text-sm rounded
                      hover:bg-gray-200 dark:hover:bg-gray-600
                      ${selectedTagIds.has(tag.id)
                        ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-offset-2 ring-black dark:ring-white'
                        : 'bg-gray-100 dark:bg-gray-700'}
                    `}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: tag.color || '#808080' }}
                    />
                    <span className="text-gray-800 dark:text-gray-100">
                      {tag.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showForm && selectedStageId && (
          <AddTaskForm
            targetStageId={selectedStageId}
            onTaskAdded={handleTaskSuccessfullyAdded}
            onCancel={onClose}
            allProjects={allProjects}
            allVers={allVers}
            workspaceId={workspaceId}
            selectedTagIds={Array.from(selectedTagIds)}
          />
        )}
      </div>
    </div>
  );
};

export default CentralizedAddModal;
