'use client';

import React from 'react';
import { Workspace } from '../page'; // Assuming Workspace type is exported from page.tsx
import { useFilters } from '../contexts/FilterContext'; // Import useFilters

// Share Icon SVG (copied from page.tsx for now, consider moving to a shared icons file)
const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18" height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
    <polyline points="16 6 12 2 8 6"></polyline>
    <line x1="12" y1="2" x2="12" y2="15"></line>
  </svg>
);

interface WorkspaceControlsBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onWorkspaceChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onNewWorkspaceClick: () => void;
  onShareWorkspaceClick: () => void;
  isMobile: boolean;
  onWorkspaceDeleted: (deletedWorkspaceId: string) => void; // Add new prop for handling deletion in parent
  onAddStageClick: () => void; // New prop for adding a stage
}

const BoardControlsBar: React.FC<WorkspaceControlsBarProps> = ({
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
  onNewWorkspaceClick,
  onShareWorkspaceClick,
  isMobile,
  onWorkspaceDeleted, // Destructure new prop
  onAddStageClick, // Destructure new prop
}) => {
  const [isMobileModalOpen, setIsMobileModalOpen] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false); // State for confirmation modal
  const [workspaceToDeleteId, setWorkspaceToDeleteId] = React.useState<string | null>(null); // State to hold the ID of the workspace to delete

  const {
    allProjectsForFilter: allProjects,
    allVersForFilter: allVers,
    allTagsForFilter: allTags,
    selectedProjectFilterId,
    setSelectedProjectFilterId: onProjectFilterChange,
    selectedVerFilterId,
    setSelectedVerFilterId: onVerFilterChange,
    selectedTagIds,
    setSelectedTagIds: onTagFilterChange,
  } = useFilters();

  // Basic button style, can be refined with CSS variables from globals.css
  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'var(--primary-button-background)',
    color: 'var(--primary-button-foreground)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--button-danger-bg)',
    color: 'var(--button-danger-text)',
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--background-input)',
    color: 'var(--foreground-input)',
    fontSize: '0.9rem',
    minWidth: '150px', // Give selects some base width
  };

  // Desktop Layout
  if (!isMobile) {
    return (
      <> {/* Wrap in fragment to allow rendering modal outside the main div */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between', // Pushes "+ New Workspace" to the right
          padding: '12px 24px',
          backgroundColor: 'var(--header-background)', // Or a slightly different background for this bar
          borderBottom: '1px solid var(--border-color)',
          gap: '16px', // Gap between control groups
          flexWrap: 'wrap', // Allow wrapping on smaller desktop screens if necessary
        }}>
          {/* Left Group: Workspace Selection & Share */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
            <label htmlFor="workspace-select-bar" style={{ marginRight: '8px', fontSize: '0.9rem', color: 'var(--foreground)' }}>
              Active Workspace:
            </label>
            <select
              id="workspace-select-bar"
              value={activeWorkspaceId || ''}
              onChange={onWorkspaceChange}
              style={selectStyle}
              disabled={workspaces.length === 0}
            >
              {workspaces.length === 0 && <option value="">No workspaces available</option>}
              {workspaces.map(workspace => (
                <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
              ))}
            </select>
            {/* Moved "+ New Workspace" button here */}
            <button
              onClick={onNewWorkspaceClick}
              style={{ ...buttonStyle, padding: '8px 12px' }} // Adjusted padding slightly
            >
              + New Workspace
            </button>
            {activeWorkspaceId && (
              <>
                <button
                  onClick={onShareWorkspaceClick}
                  style={{ ...buttonStyle, padding: '8px 10px', backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}
                  title="Share this workspace"
                >
                  <ShareIcon />
                </button>
                <button
                  onClick={() => {
                    setWorkspaceToDeleteId(activeWorkspaceId);
                    setShowDeleteConfirm(true);
                  }}
                  style={{ ...dangerButtonStyle, padding: '8px 12px' }}
                  title="Delete this workspace"
                >
                  Delete Workspace
                </button>
                <button
                  onClick={onAddStageClick}
                  style={{ ...buttonStyle, padding: '8px 12px' }}
                  title="Add a new stage to this workspace"
                >
                  + Stage
                </button>
              </>
            )}
          </div>

          {/* Center Group: Filters - REMOVED as functionality moved to Header.tsx */}

          {/* Right Group: New Workspace Button (will be pushed by justify-content: space-between) */}
          {/* To ensure it's on the far right, we might need an empty div with flex-grow: 1 if space-between isn't enough */}
          <div style={{ flexGrow: 1, minWidth: '16px' }}></div> {/* Spacer to push filters to center if needed, or allow them to be left-aligned next to workspace controls */}

          {/* Removed "+ New Workspace" button from here as it's moved */}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && workspaceToDeleteId && (
          <div style={{ // Full screen modal overlay
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 3000, // Higher z-index than mobile modal
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ // Modal content
              backgroundColor: 'var(--card-bg)',
              color: 'var(--foreground-modal)',
              padding: '20px',
              borderRadius: '8px',
              width: '90vw',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color-subtle)', paddingBottom: '10px' }}>Confirm Deletion</h3>
              <p>Are you sure you want to delete this workspace? This action cannot be undone.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setWorkspaceToDeleteId(null);
                  }}
                  style={{ ...buttonStyle, backgroundColor: 'var(--button-tertiary-bg)', color: 'var(--button-tertiary-text)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (workspaceToDeleteId) {
                      try {
                        const response = await fetch(`/api/workspaces/${workspaceToDeleteId}`, {
                          method: 'DELETE',
                        });
                        const result = await response.json();
                        if (result.success) {
                          console.log('Workspace deleted successfully:', workspaceToDeleteId);
                          onWorkspaceDeleted(workspaceToDeleteId); // Notify parent component
                        } else {
                          console.error('Failed to delete workspace:', result.message);
                          // TODO: Show a toast notification or error message to the user
                        }
                      } catch (error) {
                        console.error('Error deleting workspace:', error);
                        // TODO: Show a toast notification or error message to the user
                      } finally {
                        setShowDeleteConfirm(false);
                        setWorkspaceToDeleteId(null);
                      }
                    }
                  }}
                  style={dangerButtonStyle}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Mobile Layout
  const activeWorkspaceName = workspaces.find(w => w.id === activeWorkspaceId)?.name || "No Workspace Selected";
  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: 'var(--header-background)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '10px' }}>
          {activeWorkspaceName}
        </span>
        <button
          onClick={() => setIsMobileModalOpen(true)}
          style={{...buttonStyle, padding: '6px 12px', fontSize: '0.85rem'}}
        >
          Manage & Filter
        </button>
      </div>

      {isMobileModalOpen && (
        <div style={{ // Full screen modal overlay
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 2000, // High z-index
          display: 'flex',
          alignItems: 'center', // Center vertically
          justifyContent: 'center', // Center horizontally
        }}>
          <div
            className="mobile-manage-filter-modal-content" // Added class for specific styling
            style={{ // Modal content
            // backgroundColor: 'var(--card-bg)', // Will be handled by class
            // color: 'var(--foreground-modal)', // Will be handled by class
            padding: '20px',
            borderRadius: '8px',
            width: '90vw',
            maxWidth: '500px',
            maxHeight: '85vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color-subtle)', paddingBottom: '10px' }}>Workspace Options</h3>

            {/* Workspace Selection */}
            <div>
              <label htmlFor="workspace-select-mobile" style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Active Workspace:</label>
              <select
                id="workspace-select-mobile"
                value={activeWorkspaceId || ''}
                onChange={(e) => { onWorkspaceChange(e); /* Consider not closing modal on workspace change if filters are present */ }}
                style={{...selectStyle, width: '100%'}}
                disabled={workspaces.length === 0}
              >
                {workspaces.map(workspace => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
            </div>

            {/* Project Filter */}
            <div>
              <label htmlFor="project-filter-mobile" style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Filter by Project:</label>
              <select
                id="project-filter-mobile"
                value={selectedProjectFilterId || ''}
                onChange={(e) => onProjectFilterChange(e.target.value || null)}
                style={{...selectStyle, width: '100%'}}
              >
                <option value="">All Projects</option>
                {allProjects.map(proj => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
            </div>

            {/* Ver Filter */}
            <div>
              <label htmlFor="ver-filter-mobile" style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Filter by Ver:</label>
              <select
                id="ver-filter-mobile"
                value={selectedVerFilterId || ''}
                onChange={(e) => onVerFilterChange(e.target.value || null)}
                style={{...selectStyle, width: '100%'}}
              >
                <option value="">All Vers</option>
                {allVers.map(ver => (
                  <option key={ver.id} value={ver.id}>{ver.name}</option>
                ))}
              </select>
            </div>

            {/* Tag Filter (Simplified to single select for now, like Header) */}
            <div>
              <label htmlFor="tag-filter-mobile" style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Filter by Tag:</label>
              <select
                id="tag-filter-mobile"
                value={selectedTagIds[0] || ''} // Assuming single tag selection for simplicity
                onChange={(e) => onTagFilterChange(e.target.value ? [e.target.value] : [])}
                style={{...selectStyle, width: '100%'}}
              >
                <option value="">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color-subtle)', paddingTop: '20px', marginTop: '10px'}}>
              {activeWorkspaceId && (
                <button
                  onClick={() => { onShareWorkspaceClick(); setIsMobileModalOpen(false); }}
                  style={{ ...buttonStyle, width: '100%', justifyContent: 'center', backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}
                >
                  <ShareIcon /> Share Workspace
                </button>
              )}
                <button
                  onClick={() => { onNewWorkspaceClick(); setIsMobileModalOpen(false); }}
                  style={{ ...buttonStyle, width: '100%', justifyContent: 'center' }}
                >
                  + New Workspace
                </button>
                {/* Add Stage Button for Mobile Modal */}
                {activeWorkspaceId && (
                  <button
                    onClick={() => { onAddStageClick(); setIsMobileModalOpen(false); }}
                    style={{ ...buttonStyle, width: '100%', justifyContent: 'center' }}
                  >
                    + Add Stage
                  </button>
                )}
              {activeWorkspaceId && (
                <button
                  onClick={() => {
                    setWorkspaceToDeleteId(activeWorkspaceId);
                    setShowDeleteConfirm(true);
                    setIsMobileModalOpen(false); // Close mobile modal when opening delete confirm
                  }}
                  style={{ ...dangerButtonStyle, width: '100%', justifyContent: 'center' }}
                >
                  Delete Workspace
                </button>
              )}
            </div>

            <button
              onClick={() => setIsMobileModalOpen(false)}
              style={{ ...buttonStyle, marginTop: '10px', backgroundColor: 'var(--button-tertiary-bg)', color: 'var(--button-tertiary-text)', width: '100%', justifyContent: 'center' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal (also needed for mobile) */}
      {showDeleteConfirm && workspaceToDeleteId && (
        <div style={{ // Full screen modal overlay
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 3000, // Higher z-index than mobile modal
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ // Modal content
            backgroundColor: 'var(--card-bg)',
            color: 'var(--foreground-modal)',
            padding: '20px',
            borderRadius: '8px',
            width: '90vw',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color-subtle)', paddingBottom: '10px' }}>Confirm Deletion</h3>
            <p>Are you sure you want to delete this workspace? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setWorkspaceToDeleteId(null);
                }}
                style={{ ...buttonStyle, backgroundColor: 'var(--button-tertiary-bg)', color: 'var(--button-tertiary-text)' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (workspaceToDeleteId) {
                    try {
                      const response = await fetch(`/api/workspaces/${workspaceToDeleteId}`, {
                        method: 'DELETE',
                      });
                      const result = await response.json();
                      if (result.success) {
                        console.log('Workspace deleted successfully:', workspaceToDeleteId);
                        onWorkspaceDeleted(workspaceToDeleteId); // Notify parent component
                      } else {
                        console.error('Failed to delete workspace:', result.message);
                        // TODO: Show a toast notification or error message to the user
                      }
                    } catch (error) {
                      console.error('Error deleting workspace:', error);
                      // TODO: Show a toast notification or error message to the user
                    } finally {
                      setShowDeleteConfirm(false);
                      setWorkspaceToDeleteId(null);
                    }
                  }
                }}
                style={dangerButtonStyle}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BoardControlsBar;
