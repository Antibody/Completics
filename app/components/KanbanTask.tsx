// components/KanbanTask.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from 'react-dom';
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import MoveToMenu from "./MoveToMenu";
import TagBadge, { TagBadgeProps } from './TagBadge';
import TagsManagerPopup from './TagsManagerPopup';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DeleteTaskModal from './DeleteTaskModal';

// Pencil SVG Icon
const PencilIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>
);

// Bin/Trash SVG Icon
const BinIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

import { TaskData, StageData } from './KanbanBoard'; // Import TaskData, StageData

interface KanbanTaskProps {
  id: string;
  title: string;
  description?: string | null;
  stage_id: string;
  order: number;
  due_date?: string | null;
  project_id?: string | null;
  ver_id?: string | null;
  is_archived: boolean; // Changed to non-optional boolean
  tags?: TagBadgeProps[]; // Changed from assigned_tags
  // Props to provide lists of available projects and vers for dropdowns
  allProjects?: { id: string; name: string; color?: string | null }[];
  allVers?: import('./KanbanBoard').VerForSelect[];
  onUpdateTask: (
    id: string,
    updates: Partial<TaskData> // Use Partial<TaskData>
  ) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  isMobile?: boolean;
  allStages?: StageData[];
  onMoveTask?: (taskId: string, targetStageId: string) => void;
  highlightColor?: string;
  doneStageId?: string | undefined;
  onArchiveTask?: (taskId: string) => Promise<void>;
  isReadOnly?: boolean;
  // Archive Onboarding Props
  showArchiveOnboarding?: boolean;
  onDismissArchiveOnboarding?: () => void;
  // Drag Task Onboarding Props
  showDragTaskOnboarding?: boolean;
  dismissDragTaskOnboarding?: () => void;
  onRegisterOnboardingTaskPosition?: (taskId: string, rect: DOMRect) => void;
  workspaceId: string;
}

const KanbanTask: React.FC<KanbanTaskProps> = ({
  id,
  title,
  description,
  stage_id,
  order,
  due_date,
  project_id,
  ver_id,
  is_archived,
  tags, // Changed from assigned_tags
  allProjects = [],
  allVers = [],
  onUpdateTask,
  onDeleteTask,
  isMobile = false,
  allStages = [],
  onMoveTask,
  highlightColor,
  doneStageId,
  onArchiveTask,
  isReadOnly = false,
  showArchiveOnboarding = false,
  onDismissArchiveOnboarding,
  showDragTaskOnboarding = false,
  dismissDragTaskOnboarding,
  onRegisterOnboardingTaskPosition,
  workspaceId,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isTagsPopupOpen, setIsTagsPopupOpen] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>(title);
  const [editDescription, setEditDescription] = useState<string>(description || "");
  const [editDueDate, setEditDueDate] = useState<string>(due_date || "");
  const [editProjectId, setEditProjectId] = useState<string>(project_id || "");
  const [editVerId, setEditVerId] = useState<string>(ver_id || "");
  const [currentTags, setCurrentTags] = useState<TagBadgeProps[]>(tags || []); // Changed from currentAssignedTags
  const archiveButtonRef = React.useRef<HTMLButtonElement>(null);
  const taskRef = React.useRef<HTMLDivElement>(null);
  const [hasAnimatedThisInstance, setHasAnimatedThisInstance] = useState<boolean>(false);
  const [archiveHintPosition, setArchiveHintPosition] = useState<{ top: number; left: number } | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [showDragHintText, setShowDragHintText] = useState<boolean>(false);

  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState<boolean>(false);
  const [isDeletingTask, setIsDeletingTask] = useState<boolean>(false);
  const [deleteTaskError, setDeleteTaskError] = useState<string | null>(null);

  useEffect(() => {
    setPortalContainer(document.getElementById('hint-portal-root'));
  }, []);

  const relevantVers = useMemo(() => {
    if (!allVers || allVers.length === 0) return [];
    const taskProjectScope = editProjectId || null;

    return allVers.filter(ver => {
      if (!ver.project_id) {
        return true;
      }
      if (taskProjectScope && ver.project_id === taskProjectScope) {
        return true;
      }
      return false;
    });
  }, [allVers, editProjectId]);

  useEffect(() => {
    if (
      showArchiveOnboarding &&
      stage_id === doneStageId &&
      archiveButtonRef.current &&
      onDismissArchiveOnboarding &&
      !hasAnimatedThisInstance
    ) {
      archiveButtonRef.current.classList.add('pulse-animation');
      setHasAnimatedThisInstance(true);

      const rect = archiveButtonRef.current.getBoundingClientRect();
      setArchiveHintPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });

      setTimeout(() => {
        archiveButtonRef.current?.classList.remove('pulse-animation');
        setArchiveHintPosition(null);
        onDismissArchiveOnboarding();
      }, 2400);
    } else {
      if (stage_id === doneStageId && showArchiveOnboarding && !hasAnimatedThisInstance) {
        setArchiveHintPosition(null);
      }
    }
  }, [showArchiveOnboarding, stage_id, doneStageId, onDismissArchiveOnboarding, hasAnimatedThisInstance, id]);

  useEffect(() => {
    setEditTitle(title);
    setEditDescription(description || "");
    setEditDueDate(due_date || "");
    setEditProjectId(project_id || "");
    setEditVerId(ver_id || "");
    setCurrentTags(tags || []); // Changed from assigned_tags
  }, [title, description, due_date, project_id, ver_id, is_archived, tags]); // Changed from assigned_tags

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    data: { type: "task", taskId: id, title, stage_id, order, project_id, ver_id, is_archived, tags: currentTags }, // Changed from assigned_tags
    disabled: isEditing || isReadOnly || isTagsPopupOpen || showDragTaskOnboarding,
  });

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node);
      (taskRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node && onRegisterOnboardingTaskPosition && showDragTaskOnboarding) {
        onRegisterOnboardingTaskPosition(id, node.getBoundingClientRect());
      }
    },
    [setDraggableNodeRef, onRegisterOnboardingTaskPosition, showDragTaskOnboarding, id]
  );

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showDragTaskOnboarding && taskRef.current && dismissDragTaskOnboarding) {
      taskRef.current.classList.add('drag-onboarding-pulse');
      setShowDragHintText(true);

      timer = setTimeout(() => {
        taskRef.current?.classList.remove('drag-onboarding-pulse');
        setShowDragHintText(false);
        dismissDragTaskOnboarding();
      }, 2000);
    }
    return () => clearTimeout(timer);
  }, [showDragTaskOnboarding, dismissDragTaskOnboarding, id]);

  useEffect(() => {
    if (isDragging && showDragTaskOnboarding && dismissDragTaskOnboarding) {
      taskRef.current?.classList.remove('drag-onboarding-pulse');
      setShowDragHintText(false);
      dismissDragTaskOnboarding();
    }
  }, [isDragging, showDragTaskOnboarding, dismissDragTaskOnboarding, id]);

  const cardStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.75 : (is_archived ? 0.6 : 1),
    padding: "12px",
    paddingBottom: "40px",
    margin: "8px 0",
    border: `1px solid var(--card-border)`,
    borderLeft: highlightColor ? `5px solid ${highlightColor}` : (is_archived ? `5px solid var(--archived-border-color)` : `1px solid var(--card-border)`),
    borderRadius: "6px",
    cursor: isEditing || isReadOnly ? "default" : "grab",
    backgroundColor: isDragging ? "var(--card-bg-dragging)" : (is_archived ? "var(--card-bg-archived)" : "var(--card-bg)"),
    boxShadow: isDragging
      ? "0 8px 16px var(--card-shadow)"
      : "0 1px 3px var(--card-shadow)",
    zIndex: isDragging ? 1000 : isEditing ? 50 : "auto",
    position: "relative",
    color: "var(--card-text-secondary)",
  };

  const iconButtonStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    color: "var(--card-icon-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const handleEditPointerDown = (e: React.PointerEvent): void => {
    if (isReadOnly) return;
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleDeletePointerDown = (e: React.PointerEvent): void => {
    if (isReadOnly) return;
    e.stopPropagation();
    setShowDeleteTaskModal(true);
  };

  const handleConfirmDeleteTask = async (): Promise<void> => {
    if (isReadOnly) return;
    setIsDeletingTask(true);
    setDeleteTaskError(null);

    try {
      await onDeleteTask(id);
      setShowDeleteTaskModal(false);
    } catch (error) {
      console.error("Error deleting task:", error);
      setDeleteTaskError("Failed to delete task. Please try again.");
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setIsEditing(false);
    setEditTitle(title);
    setEditDescription(description || "");
    setEditDueDate(due_date || "");
    setEditProjectId(project_id || "");
    setEditVerId(ver_id || "");
  };

  const handleSaveEdit = async (e: React.MouseEvent): Promise<void> => {
    if (isReadOnly) return;
    e.stopPropagation();
    if (editTitle.trim() === "") {
      alert("Title cannot be empty.");
      return;
    }
    await onUpdateTask(id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      due_date: editDueDate || null,
      project_id: editProjectId || null,
      ver_id: editVerId || null,
    });
    setIsEditing(false);
  };

  const handleArchiveClick = async (e: React.PointerEvent): Promise<void> => {
    if (isReadOnly) return;
    e.stopPropagation();
    if (onArchiveTask) {
      await onArchiveTask(id);
    }
  };

  const handleTagAssignmentsChange = useCallback(async (newTagIds: string[]) => { // Changed parameter name
    if (isReadOnly) return;
    const currentIds = new Set(currentTags.map(t => t.id)); // Changed from currentAssignedTags
    const newIds = new Set(newTagIds); // Changed from newAssignedTagIds

    const tagsToAdd = newTagIds.filter(tagId => !currentIds.has(tagId)); // Changed from newAssignedTagIds
    const tagsToRemove = currentTags.filter(tag => !newIds.has(tag.id)).map(t => t.id); // Changed from currentAssignedTags

    try {
      for (const tagId of tagsToAdd) {
        if (typeof id !== 'string' || id.length === 0) {
          throw new Error('Client-side error: taskId is invalid.');
        }
        if (typeof tagId !== 'string' || tagId.length === 0) {
          throw new Error('Client-side error: tagId to add is invalid.');
        }
        const response = await fetch(`/api/tasks/${id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_id: tagId }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Failed to assign tag ${tagId}`);
        }
      }

      for (const tagId of tagsToRemove) {
        if (typeof id !== 'string' || id.length === 0) {
          throw new Error('Client-side error: taskId is invalid.');
        }
        if (typeof tagId !== 'string' || tagId.length === 0) {
          throw new Error('Client-side error: tagId to remove is invalid.');
        }
        const response = await fetch(`/api/tasks/${id}/tags/${tagId}`, {
          method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
          const errData = await response.json();
          throw new Error(errData.error || `Failed to remove tag ${tagId}`);
        }
      }
      await onUpdateTask(id, {}); // Trigger a re-fetch in KanbanBoard to get updated tags
      setIsTagsPopupOpen(false);
    } catch (error) {
      console.error("Error updating tag assignments:", error);
    }
  }, [id, currentTags, onUpdateTask, isReadOnly]); // Changed from currentAssignedTags

  if (isEditing && !isReadOnly) {
    return (
      <div style={cardStyle} ref={setNodeRef}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Task Title"
            style={{
              padding: "8px",
              border: "1px solid var(--input-border)",
              borderRadius: "4px",
              fontSize: "1em",
              backgroundColor: "var(--input-bg)",
              color: "var(--input-text)",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <div data-color-mode={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}>
            <MDEditor
              value={editDescription}
              onChange={(val) => setEditDescription(val || '')}
              preview="edit"
              height={150}
              style={{ fontSize: "0.9em" }}
              textareaProps={{
                placeholder: "Task Description (supports Markdown with to-do lists)",
                onPointerDown: (e) => e.stopPropagation(),
                onClick: (e) => e.stopPropagation()
              }}
            />
          </div>
          <div>
            <label htmlFor={`due-${id}`} style={{ fontSize: "0.9em", color: "var(--text-subtle)" }}>
              Due Date:
            </label>
            <input
              id={`due-${id}`}
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              style={{
                marginTop: "4px",
                padding: "6px",
                border: "1px solid var(--input-border)",
                borderRadius: "4px",
                width: "100%",
                boxSizing: "border-box",
                backgroundColor: "var(--input-bg)",
                color: "var(--input-text)",
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>

          <div>
            <label htmlFor={`project-${id}`} style={{ fontSize: "0.9em", color: "var(--text-subtle)" }}>
              Project:
            </label>
            <select
              id={`project-${id}`}
              value={editProjectId}
              onChange={(e) => setEditProjectId(e.target.value)}
              style={{
                marginTop: "4px", padding: "6px", border: "1px solid var(--input-border)",
                borderRadius: "4px", width: "100%", boxSizing: "border-box",
                backgroundColor: "var(--input-bg)", color: "var(--input-text)",
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <option value="">None</option>
              {allProjects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`ver-${id}`} style={{ fontSize: "0.9em", color: "var(--text-subtle)" }}>
              Ver:
            </label>
            <select
              id={`ver-${id}`}
              value={editVerId}
              onChange={(e) => setEditVerId(e.target.value)}
              style={{
                marginTop: "4px", padding: "6px", border: "1px solid var(--input-border)",
                borderRadius: "4px", width: "100%", boxSizing: "border-box",
                backgroundColor: "var(--input-bg)", color: "var(--input-text)",
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <option value="">None</option>
              {relevantVers.map(ver => {
                const projectForVer = ver.project_id ? allProjects.find(p => p.id === ver.project_id) : null;
                const displayName = projectForVer
                  ? `${ver.name} (${projectForVer.name})`
                  : ver.project_id
                  ? `${ver.name} (Project ID: ${ver.project_id.substring(0,6)}...)`
                  : `${ver.name} (Global)`;
                return (
                  <option key={ver.id} value={ver.id}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              onClick={handleCancelEdit}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid var(--button-secondary-border)",
                backgroundColor: "var(--button-secondary-bg)",
                color: "var(--button-secondary-text)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "var(--button-primary-bg)",
                color: "var(--button-primary-text)",
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={cardStyle} {...listeners} {...attributes}>
      {showDragTaskOnboarding && showDragHintText && (
        <div className="drag-onboarding-container">
          <div className="drag-onboarding-arrow"></div>
          <div className="drag-onboarding-text">
            You can drag task to another stage
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: "6px",
          right: "6px",
          display: "flex",
          gap: "4px",
          zIndex: 10,
        }}
      >
        {!isReadOnly && isMobile && allStages.length > 0 && onMoveTask && (
          <MoveToMenu
            taskId={id}
            currentStageId={stage_id}
            stages={allStages}
            onMove={onMoveTask}
          />
        )}
        {!isReadOnly && (
          <>
            <button onPointerDown={handleEditPointerDown} style={iconButtonStyle} aria-label="Edit task">
              <PencilIcon />
            </button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setIsTagsPopupOpen(true); }}
              style={iconButtonStyle}
              aria-label="Manage tags"
              title="Manage Tags"
            >
              🏷️
            </button>
            <button
              onPointerDown={handleDeletePointerDown}
              style={{ ...iconButtonStyle, color: "var(--card-icon-delete-color)" }}
              aria-label="Delete task"
            >
              <BinIcon />
            </button>
            {stage_id === doneStageId && onArchiveTask && !is_archived && (
              <div style={{ position: 'relative' }}>
                <button
                  ref={archiveButtonRef}
                  onPointerDown={handleArchiveClick}
                  style={{ ...iconButtonStyle, color: "var(--card-icon-archive-color)" }}
                  aria-label="Archive task"
                  title="Archive Task"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </button>
                {portalContainer && archiveHintPosition && showArchiveOnboarding && stage_id === doneStageId && ReactDOM.createPortal(
                  <div
                    className="archive-hint-text"
                    style={{
                      position: 'fixed',
                      top: `${archiveHintPosition.top}px`,
                      left: `${archiveHintPosition.left}px`,
                      transform: 'translateX(-50%)',
                      zIndex: 10000,
                    }}
                  >
                    You can archive this task
                  </div>,
                  portalContainer
                )}
              </div>
            )}
          </>
        )}
      </div>

      <h4 style={{ margin: "0 0 4px 0", fontSize: "1.1em", fontWeight: 600, color: "var(--card-text-primary)", paddingRight: isReadOnly ? "8px" : "70px" }}>
        {title}
      </h4>

      {description && (
        <div className="markdown-content" style={{ margin: "0 0 4px 0", fontSize: "0.95em", color: "var(--card-text-secondary)", lineHeight: 1.4, marginBottom: (project_id || ver_id || due_date || (currentTags && currentTags.length > 0)) ? '8px' : '4px' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
        </div>
      )}

      {currentTags && currentTags.length > 0 && (
        <div style={{ marginTop: '8px', marginBottom: (project_id || ver_id || due_date) ? '4px' : '0px' }}>
          {currentTags.map(tag => (
            <TagBadge key={tag.id} id={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        {project_id && allProjects.find(p => p.id === project_id) && (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8em', color: 'var(--text-subtle)', marginBottom: '4px' }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: allProjects.find(p => p.id === project_id)?.color || 'var(--text-subtle)',
              marginRight: '6px',
              border: '1px solid var(--card-border)'
            }}></span>
            Project: {allProjects.find(p => p.id === project_id)?.name}
          </div>
        )}
        {ver_id && allVers && allVers.find(v => v.id === ver_id) && (
          <div style={{ fontSize: '0.8em', color: 'var(--text-subtle)', marginBottom: due_date ? '24px' : '4px' }}>
            Ver: {
              (() => {
                const ver = allVers.find(v => v.id === ver_id);
                if (!ver) return 'Unknown';
                const projectForVer = ver.project_id ? allProjects.find(p => p.id === ver.project_id) : null;
                return projectForVer
                  ? `${ver.name} (${projectForVer.name})`
                  : ver.project_id
                  ? `${ver.name} (Project ID: ${ver.project_id.substring(0,6)}...)`
                  : `${ver.name} (Global)`;
              })()
            }
          </div>
        )}
      </div>

      {due_date && (
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            fontSize: "0.8em",
            color: "var(--text-subtle)",
            backgroundColor: "var(--column-bg)",
            padding: "2px 6px",
            borderRadius: "3px",
          }}
        >
          📅 {new Date(due_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      )}

      {isTagsPopupOpen && !isReadOnly && (
        <TagsManagerPopup
          isOpen={isTagsPopupOpen}
          onClose={() => setIsTagsPopupOpen(false)}
          assignedTagIds={currentTags.map(t => t.id)} // Changed from currentAssignedTags
          onAssignmentsChange={handleTagAssignmentsChange}
          workspaceId={workspaceId}
        />
      )}

      <DeleteTaskModal
        isOpen={showDeleteTaskModal}
        onClose={() => setShowDeleteTaskModal(false)}
        onConfirmDelete={handleConfirmDeleteTask}
        taskTitle={title}
        taskId={id}
        isDeleting={isDeletingTask}
        errorMessage={deleteTaskError}
      />
    </div>
  );
};

export default KanbanTask;
