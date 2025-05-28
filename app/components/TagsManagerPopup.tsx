// app/components/TagsManagerPopup.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TagBadgeProps } from './TagBadge';
import { createBrowserClient } from '@supabase/ssr';
import { Session } from '@supabase/supabase-js';

interface Tag extends TagBadgeProps {
  user_id?: string;
  is_global?: boolean;
}

interface TagsManagerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  assignedTagIds: string[];
  onAssignmentsChange: (newAssignedTagIds: string[]) => Promise<void>;
  workspaceId: string;
}

const TagsManagerPopup: React.FC<TagsManagerPopupProps> = ({
  isOpen,
  onClose,
  assignedTagIds,
  onAssignmentsChange,
  workspaceId,
}) => {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [session, setSession] = useState<Session | null>(null);
  const [userTags, setUserTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set(assignedTagIds));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreatingNewTag, setIsCreatingNewTag] = useState<boolean>(false);
  const [newTagName, setNewTagName] = useState<string>('');
  const [newTagColor, setNewTagColor] = useState<string>('#808080');

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: nextSession } } = await supabase.auth.getSession();
      setSession(nextSession);
    };
    getSession();
  }, [supabase]);

  const currentUserId = session?.user?.id;

  const fetchUserTags = useCallback(
    async (currentWorkspaceId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const tagsResponse = await fetch('/api/tags');
        if (!tagsResponse.ok) {
          const errData = await tagsResponse.json();
          throw new Error(errData.error || 'Failed to fetch tags.');
        }
        const allAccessibleTags: Tag[] = await tagsResponse.json();

        let workspaceSpecificSharedTagIds: string[] = [];
        if (currentWorkspaceId) {
          const sharedTagsResponse = await fetch(`/api/workspaces/${currentWorkspaceId}/shared-tags`);
          if (!sharedTagsResponse.ok) {
            const errData = await sharedTagsResponse.json();
            throw new Error(errData.error || 'Failed to fetch shared tags for workspace.');
          }
          workspaceSpecificSharedTagIds = await sharedTagsResponse.json();
        }

        const filteredTags = allAccessibleTags.filter(tag => {
          const isOwnedByCurrentUser = tag.user_id === currentUserId;
          const isSharedWithCurrentWorkspace = workspaceSpecificSharedTagIds.includes(tag.id);
          return tag.is_global || isOwnedByCurrentUser || isSharedWithCurrentWorkspace;
        });

        setUserTags(filteredTags.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error fetching user tags:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchUserTags(workspaceId);
      setSelectedTagIds(new Set(assignedTagIds));
    } else if (isOpen && !currentUserId) {
      setError('Authentication required to manage tags.');
      setIsLoading(false);
    }
  }, [isOpen, fetchUserTags, assignedTagIds, workspaceId, currentUserId]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onAssignmentsChange(Array.from(selectedTagIds));
      onClose();
    } catch (err) {
      console.error('Error saving tag assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewTag = async () => {
    if (!newTagName.trim()) {
      alert('Tag name cannot be empty.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create tag.');
      }
      const newTag: Tag = await response.json();
      setUserTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTagIds(prev => new Set(prev).add(newTag.id));
      setNewTagName('');
      setNewTagColor('#808080');
      setIsCreatingNewTag(false);

      if (workspaceId) {
        await shareTagWithWorkspace(newTag.id, workspaceId);
      }
    } catch (err) {
      console.error('Error creating new tag:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while creating tag.');
    } finally {
      setIsLoading(false);
    }
  };

  const shareTagWithWorkspace = async (tagIdToShare: string, targetWorkspaceId: string) => {
    try {
      const response = await fetch(`/api/tags/${tagIdToShare}/share-with-workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: targetWorkspaceId }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to share tag with workspace.');
      }
      await fetchUserTags(workspaceId);
    } catch (err) {
      console.error(`Error sharing tag ${tagIdToShare} with workspace ${targetWorkspaceId}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while sharing tag.');
    }
  };

  const unshareTagFromWorkspace = async (tagIdToUnshare: string, targetWorkspaceId: string) => {
    try {
      const response = await fetch(`/api/tags/${tagIdToUnshare}/share-with-workspace/${targetWorkspaceId}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 204) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to unshare tag from workspace.');
      }
      await fetchUserTags(workspaceId);
    } catch (err) {
      console.error(`Error unsharing tag ${tagIdToUnshare} from workspace ${targetWorkspaceId}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while unsharing tag.');
    }
  };

  const handleDeleteTag = async (
    tagIdToDelete: string,
    e: React.MouseEvent,
    isGlobal: boolean | undefined,
    isOwnedByCurrentUser: boolean
  ) => {
    e.stopPropagation();
    if (isGlobal) {
      alert('Global tags cannot be deleted from here.');
      return;
    }
    if (!isOwnedByCurrentUser) {
      alert('You can only delete tags you own.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this tag? It will be removed from all tasks and unshared from any workspaces.')) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tags/${tagIdToDelete}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete tag.');
      }
      setUserTags(prev => prev.filter(t => t.id !== tagIdToDelete));
      setSelectedTagIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagIdToDelete);
        return newSet;
      });
    } catch (err) {
      console.error('Error deleting tag:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while deleting tag.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const tagsToShow = userTags.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Tags for Task</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {isCreatingNewTag ? (
          <div className="mb-4 p-3 border border-gray-300 dark:border-gray-600 rounded">
            <h4 className="text-md font-medium mb-2 text-gray-100 dark:text-white">Create New Tag</h4>
            <input
              type="text"
              placeholder="Tag name"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="flex items-center mb-3">
              <label htmlFor="newTagColor" className="mr-2 text-sm text-gray-700 dark:text-gray-300">Color:</label>
              <input
                type="color"
                id="newTagColor"
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
                className="h-8 w-16 p-0 border-none rounded"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreatingNewTag(false)}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-800 dark:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewTag}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        ) : (
          <button
            id="create-new-tag-button"
            onClick={() => setIsCreatingNewTag(true)}
            className="mb-3 w-full px-3 py-2 text-sm bg-green-500 hover:bg-green-600 rounded"
          >
            Create New Tag
          </button>
        )}

        <div className="overflow-y-auto flex-grow mb-4 border-t border-b border-gray-200 dark:border-gray-700 py-2">
          <h4 className="text-md font-medium mb-2 text-gray-800 dark:text-gray-100">Available Tags:</h4>
          {isLoading && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading tags…</p>
          )}
          {!isLoading && tagsToShow.map(tag => {
            const isOwnedByCurrentUser = tag.user_id === currentUserId;
            const isSharedByOthers = !isOwnedByCurrentUser && !tag.is_global && tag.user_id;
            return (
              <div
                key={tag.id}
                role="button"
                tabIndex={0}
                onClick={() => handleToggleTag(tag.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleToggleTag(tag.id); }}
                className={`flex items-center justify-between p-2 mb-1 rounded cursor-pointer
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  ${selectedTagIds.has(tag.id)
                    ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-offset-2 ring-white'
                    : 'bg-transparent'}`}
              >
                <div className="flex items-center">
                  <span
                    style={{ backgroundColor: tag.color ?? undefined }}
                    className="inline-block w-3 h-3 rounded-full mr-2"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    {tag.name}
                    {tag.is_global && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Global)</span>}
                    {isSharedByOthers && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Shared)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {workspaceId && isOwnedByCurrentUser && !tag.is_global && (
                    <button
                      onClick={async e => {
                        e.stopPropagation();
                        const isCurrentlyShared = await supabase.from('shared_tag_access')
                          .select('*')
                          .eq('tag_id', tag.id)
                          .eq('workspace_id', workspaceId)
                          .single();
                        if (isCurrentlyShared.data) {
                          await unshareTagFromWorkspace(tag.id, workspaceId);
                        } else {
                          await shareTagWithWorkspace(tag.id, workspaceId);
                        }
                      }}
                      className="text-blue-500 hover:text-blue-700 text-xs p-1"
                      title="Toggle sharing with this workspace"
                      disabled={isLoading}
                    >
                      🔗
                    </button>
                  )}
                  <button
                    onClick={e => handleDeleteTag(tag.id, e, tag.is_global, isOwnedByCurrentUser)}
                    className={`text-red-500 hover:text-red-700 text-xs p-1 ${(!isOwnedByCurrentUser || tag.is_global) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={(!isOwnedByCurrentUser || tag.is_global) ? 'You can only delete tags you own, and global tags cannot be deleted.' : 'Delete tag'}
                    disabled={isLoading || !isOwnedByCurrentUser || tag.is_global}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-auto">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-800 dark:text-gray-100">Cancel</button>
          <button onClick={handleSaveChanges} disabled={isLoading} className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50">
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagsManagerPopup;
