// app/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Script from 'next/script';
import KanbanBoard from "./components/KanbanBoard";
import Login from "./components/Login";
import { useAuth } from "./contexts/AuthContext";
import { useFilters } from './contexts/FilterContext';
import BoardControlsBar from './components/BoardControlsBar';
import { useIsMobile } from './hooks/useIsMobile';

// Define a type for the workspace object
export interface Workspace {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  share_token?: string | null;
  is_shared_publicly?: boolean;
  public_share_mode?: string | null;
}

export default function Home() {
  
  const forceDark = (
    <Script id="force-dark" strategy="beforeInteractive">
      {`document.documentElement.classList.add('dark')`}
    </Script>
  );

  const {
    session,
    loading: authLoading,
    isAdmin,
    dbSetupAttempted,
    isDbSetupInProgress,
    triggerDbSetup,
    user
  } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState<boolean>(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState<boolean>(false);
   const newWorkspaceInputRef = useRef<HTMLInputElement>(null);
   const isCreateWorkspaceModalVisible =
    showCreateWorkspaceModal ||
    (session && workspaces.length === 0 && !isLoadingWorkspaces && !activeWorkspaceId);

  const hasFetchedWorkspaces = useRef<boolean>(false);

  const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState<boolean>(false);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [workspaceToShare, setWorkspaceToShare] = useState<Workspace | null>(null);
  const [currentShareLink, setCurrentShareLink] = useState<string | null>(null);
  const [isProcessingShare, setIsProcessingShare] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [selectedShareMode, setSelectedShareMode] = useState<'read-only' | 'editable'>('read-only');

  // State for onboarding effect
  const [showOnboardingEffect, setShowOnboardingEffect] = useState<boolean>(false);

  // State for AddStageModal
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState<boolean>(false);

  // State for first task created onboarding
  const [hasUserCreatedFirstTaskEver, setHasUserCreatedFirstTaskEver] = useState<boolean>(true); // Default to true to avoid showing if flag is missing

  const isMobile = useIsMobile();
  const boardControlsRef = useRef<HTMLDivElement>(null);

  // Get filter states and setters from FilterContext
  const {
    allProjectsForFilter,
    allVersForFilter,
    allTagsForFilter,
    selectedProjectFilterId,
    selectedVerFilterId,
    selectedTagIds,
    filterDataVersion,
  } = useFilters();

  console.log('app/page.tsx rendering with filters:', {
    project: selectedProjectFilterId,
    ver: selectedVerFilterId,
    tags: selectedTagIds,
    allProjectsCount: allProjectsForFilter.length,
    allVersCount: allVersForFilter.length,
    allTagsCount: allTagsForFilter.length,
    filterDataVer: filterDataVersion,
  });

  // Admin-triggered DB setup
  useEffect(() => {
    if (isAdmin && session && !dbSetupAttempted && !isDbSetupInProgress) {
      triggerDbSetup();
    }
  }, [isAdmin, session, dbSetupAttempted, isDbSetupInProgress, triggerDbSetup]);

    // focus the create-workspace input whenever the modal opens
   useEffect(() => {
    if (isCreateWorkspaceModalVisible && newWorkspaceInputRef.current) {
      newWorkspaceInputRef.current.focus();
    }
  }, [isCreateWorkspaceModalVisible]);

  const fetchWorkspaces = useCallback(async () => {
    if (!session || !user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setShowOnboardingEffect(false);
      return;
    }
    setIsLoadingWorkspaces(true);
    setWorkspaceError(null);
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (data.success && Array.isArray(data.workspaces)) {
        setWorkspaces(data.workspaces);
        if (data.workspaces.length > 0) {
          const last = localStorage.getItem(`lastActiveWorkspace-${user.id}`);
          setActiveWorkspaceId(
            last && data.workspaces.find((w: Workspace) => w.id === last)
              ? last
              : data.workspaces[0].id
          );
        } else {
          setActiveWorkspaceId(null);
          setShowCreateWorkspaceModal(true);
        }
      } else {
        setWorkspaceError(data.message || 'Failed to fetch workspaces.');
        setWorkspaces([]);
        setActiveWorkspaceId(null);
      }
    } catch (err) {
      console.error(err);
      setWorkspaceError('An error occurred while fetching workspaces.');
      setWorkspaces([]);
      setActiveWorkspaceId(null);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [session, user]);

  useEffect(() => {
    if (session && user && !hasFetchedWorkspaces.current) {
      hasFetchedWorkspaces.current = true;
      void fetchWorkspaces();
    } else if (!session || !user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setShowOnboardingEffect(false);
      hasFetchedWorkspaces.current = false;
    }
  }, [session, user, fetchWorkspaces]);

  // Onboarding effect logic
  useEffect(() => {
    if (user && user.id && workspaces.length > 0 && activeWorkspaceId && !isLoadingWorkspaces) {
      const onboardingKey = `kanban_onboarding_shown_${user.id}`;
      try {
        const hasBeenShown = localStorage.getItem(onboardingKey);
        if (!hasBeenShown) {
          setShowOnboardingEffect(true);
        }
      } catch (e) {
        console.error("Error accessing localStorage for onboarding:", e);
      }
    }
  }, [user, workspaces, activeWorkspaceId, isLoadingWorkspaces]);

  const dismissOnboardingEffect = useCallback(() => {
    setShowOnboardingEffect(false);
    if (user && user.id) {
      try {
        localStorage.setItem(`kanban_onboarding_shown_${user.id}`, 'true');
      } catch (e) {
        console.error("Error setting localStorage for onboarding:", e);
      }
    }
  }, [user]);

  // Create workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || !session) return;
    setIsCreatingWorkspace(true);
    setWorkspaceError(null);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });
      const data = await res.json();
      if (data.success && data.workspace) {
        setNewWorkspaceName('');
        setShowCreateWorkspaceModal(false);
        await fetchWorkspaces();
        setActiveWorkspaceId(data.workspace.id);
      } else {
        setWorkspaceError(data.message || 'Failed to create workspace.');
      }
    } catch (err) {
      console.error(err);
      setWorkspaceError('An error occurred while creating the workspace.');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  // Workspace selection
  const handleWorkspaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveWorkspaceId(id);
    if (user?.id) {
      localStorage.setItem(`lastActiveWorkspace-${user.id}`, id);
    }
  };

  // Handle workspace deletion
  const handleWorkspaceDeleted = useCallback((deletedWorkspaceId: string) => {
    setWorkspaces(prevWorkspaces => prevWorkspaces.filter(workspace => workspace.id !== deletedWorkspaceId));
    if (activeWorkspaceId === deletedWorkspaceId) {
      const remainingWorkspaces = workspaces.filter(workspace => workspace.id !== deletedWorkspaceId);
      if (remainingWorkspaces.length > 0) {
        const newActiveWorkspaceId = remainingWorkspaces[0].id;
        setActiveWorkspaceId(newActiveWorkspaceId);
        if (user?.id) {
          localStorage.setItem(`lastActiveWorkspace-${user.id}`, newActiveWorkspaceId);
        }
      } else {
        setActiveWorkspaceId(null);
        if (user?.id) {
          localStorage.removeItem(`lastActiveWorkspace-${user.id}`);
        }
        setShowCreateWorkspaceModal(true);
      }
    }
  }, [activeWorkspaceId, workspaces, user?.id]);


  // Share link generation
  const openShareModal = (workspace: Workspace) => {
    setWorkspaceToShare(workspace);
    setCurrentShareLink(
      workspace.is_shared_publicly && workspace.share_token
        ? `${window.location.origin}/shared-workspace/${workspace.share_token}`
        : null
    );
    setSelectedShareMode(
      workspace.public_share_mode === 'editable' ? 'editable' : 'read-only'
    );
    setShareError(null);
    setShowShareModal(true);
  };

  const handleGenerateShareLink = async () => {
    if (!workspaceToShare) return;
    setIsProcessingShare(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceToShare.id}/sharing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareMode: selectedShareMode }),
      });
      const data = await res.json();
      if (data.success && data.shareableLink) {
        setCurrentShareLink(data.shareableLink);
        fetchWorkspaces();
      } else {
        setShareError(data.message || 'Failed to generate share link.');
      }
    } catch (err) {
      console.error(err);
      setShareError('An error occurred while generating the link.');
    } finally {
      setIsProcessingShare(false);
    }
  };

  const handleRevokeShareLink = async () => {
    if (!workspaceToShare) return;
    setIsProcessingShare(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceToShare.id}/sharing`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCurrentShareLink(null);
        fetchWorkspaces();
      } else {
        const data = await res.json().catch(() => ({}));
        setShareError(data.message || 'Failed to revoke share link.');
      }
    } catch (err) {
      console.error(err);
      setShareError('An error occurred while revoking the link.');
    } finally {
      setIsProcessingShare(false);
    }
  };

  // Scroll to BoardControlsBar when active workspace is loaded
  useEffect(() => {
    if (activeWorkspaceId && !isLoadingWorkspaces && boardControlsRef.current) {
      const timer = setTimeout(() => {
        if (boardControlsRef.current) {
          boardControlsRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeWorkspaceId, isLoadingWorkspaces]);

  useEffect(() => {
    if (
      showCreateWorkspaceModal &&
      workspaces.length === 0 &&
      newWorkspaceInputRef.current
    ) {
      newWorkspaceInputRef.current.focus();
    }
  }, [showCreateWorkspaceModal, workspaces.length]);

  // Check for first task created flag
  useEffect(() => {
    if (user && user.id) {
      const firstTaskCreatedKey = `kanban_first_task_created_${user.id}`;
      try {
        const flag = localStorage.getItem(firstTaskCreatedKey);
        if (flag === 'true') {
          setHasUserCreatedFirstTaskEver(true);
        } else {
          setHasUserCreatedFirstTaskEver(false);
        }
      } catch (e) {
        console.error("Error accessing localStorage for first task created flag:", e);
        setHasUserCreatedFirstTaskEver(true);
      }
    } else {
      setHasUserCreatedFirstTaskEver(true);
    }
  }, [user]);


  // Styles
  const baseMainStyle: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    backgroundColor: 'var(--background)',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    color: 'var(--foreground)',
    overflow: 'hidden',
  };
  const centeredMessageStyle: React.CSSProperties = {
    ...baseMainStyle,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '20px',
  };
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10, 10, 20, 0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(3px)',
  };
  const modalContentStyle: React.CSSProperties = {
    backgroundColor: 'var(--background-modal)',
    padding: '32px 40px',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
    color: 'var(--foreground-modal)',
    width: '90%',
    maxWidth: '550px',
    display: 'flex', flexDirection: 'column',
  };
  const modalHeaderStyle: React.CSSProperties = {
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-color-subtle)',
  };
  const inputStyle: React.CSSProperties = {
    width: 'calc(100% - 20px)',
    padding: '10px',
    marginBottom: '15px',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--background-input)',
    color: 'var(--foreground-input)',
  };
  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'var(--primary-button-background)',
    color: 'var(--primary-button-foreground)',
    cursor: 'pointer',
    fontSize: '1rem',
    marginRight: '10px',
  };
  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--secondary-button-background)',
    color: 'var(--secondary-button-foreground)',
  };

  // Handlers for AddStageModal, to be passed down
  const openAddStageModal = () => {
    if (activeWorkspaceId) {
      setIsAddStageModalOpen(true);
    } else {
      console.warn("Cannot add stage: No active workspace selected.");
      setWorkspaceError("Please select or create a workspace before adding stages.");
    }
  };
  const closeAddStageModal = () => setIsAddStageModalOpen(false);

  // Render logic
  if (authLoading) {
    return (
      <>
        {forceDark}
        <main style={centeredMessageStyle}>
          <div>Loading authentication state...</div>
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        {forceDark}
        <Login />
      </>
    );
  }

  if (isDbSetupInProgress && isAdmin) {
    return (
      <>
        {forceDark}
        <main style={centeredMessageStyle}>
          <div>Setting up database... Please wait.</div>
        </main>
      </>
    );
  }

 if (isCreateWorkspaceModalVisible) {
  const isFirstWorkspace = workspaces.length === 0;
  return (
    <>
      {forceDark}
      <main style={baseMainStyle}>
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600 }}>
                {isFirstWorkspace ? 'Create Your First Workspace' : 'Create New Workspace'}
              </h2>
            </div>
            {/* Create Workspace Form */}
            <form onSubmit={handleCreateWorkspace} style={{ width: '100%' }}>
              <label
                htmlFor="newWorkspaceNameInput"
                style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: 'var(--foreground-secondary)'
                }}
              >
                Workspace Name
              </label>
              <input
                id="newWorkspaceNameInput"
                ref={newWorkspaceInputRef}
                autoFocus
                type="text"
                value={newWorkspaceName}
                onChange={e => setNewWorkspaceName(e.target.value)}
                placeholder={
                  isFirstWorkspace
                    ? 'e.g., My First Project'
                    : 'e.g., Paper on relativity'
                }
                style={{
                  ...inputStyle,
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 15px',
                  fontSize: '1rem',
                  marginBottom: '24px'
                }}
                disabled={isCreatingWorkspace}
              />
              {workspaceError && (
                <p style={{ color: 'var(--text-error)', fontSize: '0.9em', marginBottom: '16px', textAlign: 'center' }}>
                  {workspaceError}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                {workspaces.length > 0 && (
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onClick={() => setShowCreateWorkspaceModal(false)}
                    disabled={isCreatingWorkspace}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  style={buttonStyle}
                  disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                >
                  {isCreatingWorkspace ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

  return (
  <>
    {forceDark}
    <main style={baseMainStyle}>
      {isLoadingWorkspaces && (
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading workspaces...</div>
      )}
      {workspaceError && !isLoadingWorkspaces && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-error)' }}>
          Error: {workspaceError} <button onClick={fetchWorkspaces}>Retry</button>
        </div>
      )}

      {!isLoadingWorkspaces && !workspaceError && workspaces.length > 0 && activeWorkspaceId && (
        <>
          <div ref={boardControlsRef} style={{ flexShrink: 0 }}>
            <BoardControlsBar
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onWorkspaceChange={handleWorkspaceChange}
              onNewWorkspaceClick={() => {
                setNewWorkspaceName('');
                setWorkspaceError(null);
                setShowCreateWorkspaceModal(true);
              }}
              onShareWorkspaceClick={() => {
                const w = workspaces.find(w => w.id === activeWorkspaceId);
                if (w) openShareModal(w);
              }}
              isMobile={isMobile}
              onWorkspaceDeleted={handleWorkspaceDeleted}
              onAddStageClick={openAddStageModal}
            />
          </div>
          <div style={{ flexGrow: 1, overflowY: 'hidden', overflowX: 'auto', display: 'flex' }}>
            <KanbanBoard
              key={activeWorkspaceId}
              workspaceId={activeWorkspaceId}
              selectedProjectFilterId={selectedProjectFilterId}
              selectedVerFilterId={selectedVerFilterId}
              selectedTagIds={selectedTagIds}
              showOnboardingEffect={showOnboardingEffect}
              onDismissOnboardingEffect={dismissOnboardingEffect}
              hasUserCreatedFirstTaskEver={hasUserCreatedFirstTaskEver}
              isAddStageModalOpen={isAddStageModalOpen}
              onCloseAddStageModal={closeAddStageModal}
            />
          </div>
          {showOnboardingEffect && (
            <button
              onClick={dismissOnboardingEffect}
              style={{
                position: 'fixed',
                top: '120px',
                left: '400px',
                zIndex: 2000,
                padding: '8px 12px',
                backgroundColor: 'var(--button-secondary-bg)',
                color: 'var(--button-secondary-text)',
                border: '1px solid var(--button-secondary-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}
              title="Dismiss onboarding hint"
            >
              Got it!
            </button>
          )}
        </>
      )}

        {showShareModal && workspaceToShare && (
          <div style={modalOverlayStyle}>
            <div style={{ ...modalContentStyle, maxWidth: '600px' }}>
              <div style={modalHeaderStyle}>
                <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600 }}>
                  Share Workspace: {workspaceToShare.name}
                </h2>
              </div>
              <div style={{ margin: '16px 0' }}>
                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 500, color: 'var(--foreground-secondary)', marginBottom: '8px' }}>
                  Sharing Mode:
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="shareMode"
                      value="read-only"
                      checked={selectedShareMode === 'read-only'}
                      onChange={() => setSelectedShareMode('read-only')}
                      style={{ marginRight: '6px', accentColor: 'var(--primary-button-background)' }}
                      disabled={isProcessingShare}
                    />
                    Read-Only (anyone with the link can view)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="shareMode"
                      value="editable"
                      checked={selectedShareMode === 'editable'}
                      onChange={() => setSelectedShareMode('editable')}
                      style={{ marginRight: '6px', accentColor: 'var(--primary-button-background)' }}
                      disabled={isProcessingShare}
                    />
                    Editable (signed-in users with the link can edit)
                  </label>
                </div>
              </div>

              {shareError && (
                <p style={{ color: 'var(--text-error)', fontSize: '0.9em', marginBottom: '16px', textAlign: 'center', background: 'var(--error-background-subtle)', padding: '8px', borderRadius: '4px' }}>
                  {shareError}
                </p>
              )}

              {currentShareLink ? (
                <div style={{ marginBottom: '16px', background: 'var(--background-offset)', padding: '16px', borderRadius: '8px' }}>
                  <label htmlFor="shareLinkInput" style={{ display: 'block', fontSize: '0.9em', fontWeight: 500, color: 'var(--foreground-secondary)', marginBottom: '8px' }}>
                    Your shareable link ({selectedShareMode}):
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="shareLinkInput"
                      type="text"
                      value={currentShareLink}
                      readOnly
                      style={{ ...inputStyle, flexGrow: 1, marginBottom: 0, padding: '10px 12px', fontSize: '0.95rem', backgroundColor: 'var(--background-input-disabled)', cursor: 'text' }}
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(currentShareLink)}
                      style={{ ...buttonStyle, fontSize: '0.9rem', padding: '10px 15px', marginRight: 0, flexShrink: 0, backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                      title="Copy link to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={handleGenerateShareLink}
                    style={{ ...buttonStyle, width: 'auto', marginTop: '12px', padding: '8px 16px', fontSize: '0.9rem', backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}
                    disabled={isProcessingShare}
                  >
                    {isProcessingShare ? 'Updating...' : 'Update Share Settings'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateShareLink}
                  style={{ ...buttonStyle, width: '100%', marginBottom: '16px', marginRight: 0, padding: '12px 20px', fontSize: '1rem', backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                  disabled={isProcessingShare}
                >
                  {isProcessingShare ? 'Generating Link...' : `Generate ${selectedShareMode === 'editable' ? 'Editable' : 'Read-Only'} Link`}
                </button>
              )}

              {(currentShareLink || workspaceToShare.is_shared_publicly) && (
                <button
                  onClick={handleRevokeShareLink}
                  style={{ ...buttonStyle, width: '100%', backgroundColor: 'var(--destructive-background)', color: 'var(--destructive-foreground)', marginRight: 0, padding: '12px 20px', fontSize: '1rem', marginBottom: '24px' }}
                  disabled={isProcessingShare}
                >
                  {isProcessingShare ? 'Revoking Link...' : 'Revoke Share Link & Disable Sharing'}
                </button>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color-subtle)', paddingTop: '20px' }}>
                <button type="button" style={{ ...secondaryButtonStyle, padding: '10px 20px', fontSize: '1rem' }} onClick={() => setShowShareModal(false)} disabled={isProcessingShare}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {!isLoadingWorkspaces && !activeWorkspaceId && workspaces.length === 0 && !showCreateWorkspaceModal && (
        <div style={centeredMessageStyle}>
          <p>You don’t have any workspaces yet.</p>
          <button
            style={buttonStyle}
            onClick={() => {
              setNewWorkspaceName('');
              setWorkspaceError(null);
              setShowCreateWorkspaceModal(true);
            }}
          >
            Create Your First Workspace
          </button>
        </div>
      )}
    </main>
  </>
)};
