// app/components/AddTaskForm.tsx

'use client';

import React, { useState, useEffect, useMemo } from "react";
import supabase from "../../lib/supabaseClient";
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from "../contexts/AuthContext";
import { ProjectForSelect, VerForSelect } from '../components/KanbanBoard'; // Import necessary types

interface AddTaskFormProps {
  targetStageId: string | null;
  onTaskAdded: () => void;
  onCancel?: () => void;
  allProjects?: ProjectForSelect[];
  allVers?: VerForSelect[];
  workspaceId: string;
  selectedTagIds: string[];
}

const AddTaskForm: React.FC<AddTaskFormProps> = ({
  targetStageId,
  onTaskAdded,
  onCancel,
  allProjects = [],
  allVers = [],
  workspaceId,
  selectedTagIds,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedVerId, setSelectedVerId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Filter vers based on selected project
  const relevantVers = useMemo(() => {
    if (!allVers || allVers.length === 0) return [];
    const currentProjectScope = selectedProjectId || null;

    return allVers.filter(ver => {
      // Include if ver is global (no project_id)
      if (!ver.project_id) {
        return true;
      }
      // Include if ver's project matches selected project
      if (currentProjectScope && ver.project_id === currentProjectScope) {
        return true;
      }
      return false;
    });
  }, [allVers, selectedProjectId]);

  // Reset selectedVerId if the selected project changes and the current ver is no longer relevant
  useEffect(() => {
    if (selectedVerId) {
      const isCurrentVerRelevant = relevantVers.some(v => v.id === selectedVerId);
      if (!isCurrentVerRelevant) {
        setSelectedVerId(""); // Reset if not relevant
      }
    }
  }, [selectedProjectId, selectedVerId, relevantVers]);


  useEffect(() => {
    if (targetStageId === null) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setSelectedProjectId("");
      setSelectedVerId("");
      setError(null);
    }
  }, [targetStageId]);

  const internalHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof targetStageId !== 'string' || !targetStageId.trim()) {
      setError("A valid target stage has not been selected. Please close this form and select a stage.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    if (!title.trim()) {
      setError("Title cannot be empty.");
      setLoading(false);
      return;
    }

    let newOrder = 0;
    const { data: existingTasks, error: orderError } = await supabase
      .from("tasks")
      .select("order")
      .eq("stage_id", targetStageId)
      .order("order", { ascending: false })
      .limit(1);

    if (!orderError && existingTasks && existingTasks.length > 0) {
      newOrder = existingTasks[0].order + 1;
    }

    const taskPayload = {
      title: title.trim(),
      description: description.trim() || null,
      stage_id: targetStageId,
      order: newOrder,
      due_date: dueDate || null,
      project_id: selectedProjectId || null,
      ver_id: selectedVerId || null,
      workspace_id: workspaceId,
    };

    const { data: insertedData, error: insertError } = await supabase
      .from("tasks")
      .insert([taskPayload])
      .select();

    if (insertError || !insertedData || insertedData.length === 0) {
      console.error("Error adding task:", insertError);
      setError(`Failed to add task: ${insertError?.message ?? "Unknown error"}`);
      setLoading(false);
      return;
    }

    const newTask = insertedData[0];

    if (selectedTagIds.length > 0) {
      const mappingRows = selectedTagIds.map(tag_id => ({
        task_id: newTask.id,
        tag_id,
      }));
      const { error: tagError } = await supabase
        .from("task_tags")
        .insert(mappingRows);
      if (tagError) {
        console.error("Error assigning tags to new task:", tagError);
      }
    }

    // Set localStorage flag for first task created
    if (user && user.id) {
      const firstTaskCreatedKey = `kanban_first_task_created_${user.id}`;
      try {
        if (!localStorage.getItem(firstTaskCreatedKey)) {
          localStorage.setItem(firstTaskCreatedKey, 'true');
          console.log(`Flag set: ${firstTaskCreatedKey}`);
        }
      } catch (e) {
        console.error("Error accessing localStorage for first task flag:", e);
      }
    }

    setTitle("");
    setDescription("");
    setDueDate("");
    setSelectedProjectId("");
    setSelectedVerId("");
    onTaskAdded();
    setLoading(false);
  };

  return (
    <form onSubmit={internalHandleSubmit} className="w-full">
      {error && (
        <p className="text-red-500 text-sm mb-3">{error}</p>
      )}

      <div className="mb-4">
        <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title:
        </label>
        <input
          id="task-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={loading}
          placeholder="Enter task title..."
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description (Optional):
        </label>
        <div data-color-mode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'}>
          <MDEditor
            value={description}
            onChange={val => setDescription(val || '')}
            preview="edit"
            height={150}
            textareaProps={{
              placeholder: "Task Description (supports Markdown with to-do lists)",
              disabled: loading
            }}
            className="mt-1 block w-full text-sm"
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="task-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Due Date (Optional):
        </label>
        <input
          id="task-due-date"
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          disabled={loading}
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="task-project-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Project (Optional):
        </label>
        <select
          id="task-project-select"
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          disabled={loading}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">None</option>
          {allProjects.map(project => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="task-ver-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Ver (Optional):
        </label>
        <select
          id="task-ver-select"
          value={selectedVerId}
          onChange={e => setSelectedVerId(e.target.value)}
          disabled={loading}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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

      <div className="flex items-center justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading || typeof targetStageId !== 'string' || !targetStageId.trim()}
          className={`w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
            loading || typeof targetStageId !== 'string' || !targetStageId.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? "Adding…" : "Add Task"}
        </button>
      </div>
    </form>
  );
};

export default AddTaskForm;
