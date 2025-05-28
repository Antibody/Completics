// app/components/VersionsManager.tsx
'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';
import ToastNotification from './ToastNotification';

import { VerForSelect as VersionForSelect, ProjectForSelect } from './KanbanBoard'; 
interface Version extends VersionForSelect { 
  description: string | null;
  status: string | null;
  start_date: string | null;
  release_date: string | null;
  created_at: string;
  
}

interface VersionEditable extends Version { 
  _isEditing?: boolean;
}

const VersionsManager: React.FC = () => {
  const { session, user } = useAuth();
  const [versions, setVersions] = useState<VersionEditable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; key: number } | null>(null);

  // State for new version form
  const [newVersionName, setNewVersionName] = useState<string>('');
  const [newVersionDescription, setNewVersionDescription] = useState<string>('');
  const [newVersionStatus, setNewVersionStatus] = useState<string>('');
  const [newVersionStartDate, setNewVersionStartDate] = useState<string>('');
  const [newVersionReleaseDate, setNewVersionReleaseDate] = useState<string>('');
  const [newVersionProjectId, setNewVersionProjectId] = useState<string>('');
  const [newVersionStartDateError, setNewVersionStartDateError] = useState<string | null>(null);
  const [newVersionReleaseDateError, setNewVersionReleaseDateError] = useState<string | null>(null);
  const [editVersionStartDateError, setEditVersionStartDateError] = useState<string | null>(null);
  const [editVersionReleaseDateError, setEditVersionReleaseDateError] = useState<string | null>(null);


  const { refetchFilterData, allProjectsForFilter } = useFilters();
  const [availableProjects, setAvailableProjects] = useState<ProjectForSelect[]>([]);

  const API_BASE_URL = '/api/vers'; 

 
  useEffect(() => {
    if (allProjectsForFilter) {
      setAvailableProjects(allProjectsForFilter.map(p => ({ id: p.id, name: p.name })));
    }
  }, [allProjectsForFilter]);

  const fetchVersions = useCallback(async () => {
    if (!session || !user) {
      setIsLoading(false);
      setError("You must be logged in to manage versions.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch versions: ${response.statusText}`);
      }
      const data: Version[] = await response.json();
      setVersions(data.map(v => ({ ...v, _isEditing: false })));
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while fetching versions.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [session, user]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const validateDates = (start: string | null | undefined, finish: string | null | undefined): string | null => {
    if (start && finish) {
      const startDate = new Date(start);
      const finishDate = new Date(finish);
      if (startDate >= finishDate) {
        return "Start date must be before release date.";
      }
    }
    return null;
  };

  const handleInputChange = (id: string, field: keyof VersionEditable, value: string | null) => {
    setVersions(prevVersions =>
      prevVersions.map(v => {
        if (v.id === id) {
          const updatedVersion = { ...v, [field]: value };
          if (field === 'start_date' || field === 'release_date') {
            setEditVersionStartDateError(null);
            setEditVersionReleaseDateError(null);
            if (updatedVersion.start_date && updatedVersion.release_date) {
                const validationError = validateDates(updatedVersion.start_date, updatedVersion.release_date);
                if (validationError) setEditVersionReleaseDateError(validationError);
            }
          }
          return updatedVersion;
        }
        return v;
      })
    );
  };

  const toggleEditMode = (id: string) => {
    setEditVersionStartDateError(null);
    setEditVersionReleaseDateError(null);
    setVersions(prevVersions =>
      prevVersions.map(v => (v.id === id ? { ...v, _isEditing: !v._isEditing } : { ...v, _isEditing: false }))
    );
  };

  const handleSaveVersion = async (id: string) => {
    const versionToSave = versions.find(v => v.id === id);
    if (!versionToSave || !versionToSave.name?.trim()) {
      setError("Version name cannot be empty.");
      return;
    }

    setEditVersionStartDateError(null);
    setEditVersionReleaseDateError(null);
    const dateValidationError = validateDates(versionToSave.start_date, versionToSave.release_date);
    if (dateValidationError) {
      setEditVersionReleaseDateError(dateValidationError);
      setError(null);
      return;
    }
    setError(null);

    try {
      const body = {
        name: versionToSave.name.trim(),
        description: versionToSave.description,
        status: versionToSave.status,
        start_date: versionToSave.start_date ? new Date(versionToSave.start_date).toISOString() : null,
        release_date: versionToSave.release_date ? new Date(versionToSave.release_date).toISOString() : null,
        project_id: versionToSave.project_id || null,
      };

      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to update version: ${response.statusText}`);
      }
      const updatedVersion: Version = await response.json();
      setVersions(prevVersions =>
        prevVersions.map(v => (v.id === id ? { ...updatedVersion, _isEditing: false } : v))
      );
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while updating the version.");
      }
    }
  };

  const handleDeleteVersion = async (id: string) => {
    if (!id) {
      setError("Cannot delete version: ID is missing.");
      console.error("handleDeleteVersion called with no ID");
      return;
    }
    if (!window.confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 204) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to delete version: ${response.statusText}`);
      }
      setVersions(prevVersions => prevVersions.filter(v => v.id !== id));
      setToast({ message: 'Version deleted successfully!', type: 'success', key: Date.now() });
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while deleting the version.");
      }
    }
  };

  const handleCreateNewVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) {
      setError("New version name cannot be empty.");
      return;
    }

    setNewVersionStartDateError(null);
    setNewVersionReleaseDateError(null);
    const dateValidationError = validateDates(newVersionStartDate, newVersionReleaseDate);
    if (dateValidationError) {
      setNewVersionReleaseDateError(dateValidationError);
      setError(null);
      return;
    }
    setError(null);

    try {
      const body = {
        name: newVersionName.trim(),
        description: newVersionDescription.trim() || null,
        status: newVersionStatus.trim() || null,
        start_date: newVersionStartDate ? new Date(newVersionStartDate).toISOString() : null,
        release_date: newVersionReleaseDate ? new Date(newVersionReleaseDate).toISOString() : null,
        project_id: newVersionProjectId || null,
      };
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to create version: ${response.statusText}`);
      }
      const createdVersion: Version = await response.json();
      setVersions(prevVersions => [{ ...createdVersion, _isEditing: false }, ...prevVersions]);
      setNewVersionName('');
      setNewVersionDescription('');
      setNewVersionStatus('');
      setNewVersionStartDate('');
      setNewVersionReleaseDate('');
      setNewVersionProjectId('');
      setNewVersionStartDateError(null);
      setNewVersionReleaseDateError(null);
      await refetchFilterData();
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while creating the version.");
      }
    }
  };
  
  const styles = {
    container: { padding: '20px', maxWidth: '800px', margin: '0 auto', color: 'var(--foreground)', backgroundColor: 'var(--background)' },
    formSection: { marginBottom: '30px', padding: '20px', border: '1px solid var(--input-border)', borderRadius: '8px', backgroundColor: 'var(--card-bg)' },
    inputGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--foreground)' },
    input: { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--input-border)', boxSizing: 'border-box', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)'  },
    button: { padding: '10px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--button-primary-bg)', color: 'var(--button-primary-text)', marginRight: '10px' },
    buttonSecondary: { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--button-secondary-border)' },
    listItem: { listStyle: 'none', padding: '15px', border: '1px solid var(--input-border)', borderRadius: '8px', marginBottom: '10px', backgroundColor: 'var(--card-bg)' },
    error: { color: 'var(--text-error)', marginBottom: '15px' },
    loading: { textAlign: 'center', padding: '20px', color: 'var(--foreground)' }
  } as const;

  if (!session || !user) {
    if (isLoading) return <p style={styles.loading}>Loading authentication...</p>;
    return <p style={styles.error}>Error: {error || "You must be logged in to view this page."}</p>;
  }

  if (isLoading) {
    return <p style={styles.loading}>Loading versions...</p>;
  }

  return (
    <div style={styles.container}>
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          key={toast.key}
        />
      )}
      <h1>Manage Versions</h1>
      {error && <p style={styles.error}>Error: {error}</p>}

      <section style={styles.formSection}>
        <h2>Create New Version</h2>
        <form onSubmit={handleCreateNewVersion}>
          <div style={styles.inputGroup}>
            <label htmlFor="newVersionName" style={styles.label}>Name*:</label>
            <input type="text" id="newVersionName" value={newVersionName} onChange={e => setNewVersionName(e.target.value)} required style={styles.input} />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="newVersionDescription" style={styles.label}>Description:</label>
            <textarea id="newVersionDescription" value={newVersionDescription} onChange={e => setNewVersionDescription(e.target.value)} rows={3} style={styles.input}></textarea>
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="newVersionStatus" style={styles.label}>Status:</label>
            <input type="text" id="newVersionStatus" value={newVersionStatus} onChange={e => setNewVersionStatus(e.target.value)} style={styles.input} placeholder="e.g., Unreleased, In Progress, Released"/>
          </div>
          <div style={{...styles.inputGroup, position: 'relative' }}>
            <label htmlFor="newVersionStartDate" style={styles.label}>Start Date:</label>
            <input type="date" id="newVersionStartDate" value={newVersionStartDate} onChange={e => {
              setNewVersionStartDate(e.target.value);
              setNewVersionStartDateError(null);
              setNewVersionReleaseDateError(null);
            }} style={styles.input} />
            {newVersionStartDateError && <div className="date-validation-hint">{newVersionStartDateError}</div>}
          </div>
          <div style={{...styles.inputGroup, position: 'relative' }}>
            <label htmlFor="newVersionReleaseDate" style={styles.label}>Release Date:</label>
            <input type="date" id="newVersionReleaseDate" value={newVersionReleaseDate} onChange={e => {
              setNewVersionReleaseDate(e.target.value);
              setNewVersionReleaseDateError(null);
               if (newVersionStartDate) {
                    const validationError = validateDates(newVersionStartDate, e.target.value);
                    if (validationError) setNewVersionReleaseDateError(validationError);
                }
            }} style={styles.input} />
            {newVersionReleaseDateError && <div className="date-validation-hint">{newVersionReleaseDateError}</div>}
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="newVersionProjectId" style={styles.label}>Project (Optional):</label>
            <select
              id="newVersionProjectId"
              value={newVersionProjectId}
              onChange={e => setNewVersionProjectId(e.target.value)}
              style={styles.input}
            >
              <option value="">-- Select a Project --</option>
              {availableProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" style={styles.button}>Create Version</button>
        </form>
      </section>

      <section>
        <h2>Existing Versions</h2>
        {versions.length === 0 && !isLoading && <p>No versions found.</p>}
        <ul style={{ padding: 0 }}>
          {versions.map(version => (
            <li key={version.id} style={styles.listItem}>
              {version._isEditing ? (
                <div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Name*:</label>
                    <input type="text" value={version.name || ''} onChange={e => handleInputChange(version.id!, 'name', e.target.value)} required style={styles.input} />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Description:</label>
                    <textarea value={version.description || ''} onChange={e => handleInputChange(version.id!, 'description', e.target.value)} rows={2} style={styles.input}></textarea>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Status:</label>
                    <input type="text" value={version.status || ''} onChange={e => handleInputChange(version.id!, 'status', e.target.value)} style={styles.input} />
                  </div>
                  <div style={{...styles.inputGroup, position: 'relative' }}>
                    <label style={styles.label}>Start Date:</label>
                    <input type="date" value={version.start_date?.split('T')[0] || ''} onChange={e => handleInputChange(version.id!, 'start_date', e.target.value)} style={styles.input} />
                    {editVersionStartDateError && version.id === versions.find(v => v._isEditing)?.id && <div className="date-validation-hint">{editVersionStartDateError}</div>}
                  </div>
                  <div style={{...styles.inputGroup, position: 'relative' }}>
                    <label style={styles.label}>Release Date:</label>
                    <input type="date" value={version.release_date?.split('T')[0] || ''} onChange={e => handleInputChange(version.id!, 'release_date', e.target.value)} style={styles.input} />
                    {editVersionReleaseDateError && version.id === versions.find(v => v._isEditing)?.id && <div className="date-validation-hint">{editVersionReleaseDateError}</div>}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Project (Optional):</label>
                    <select
                        value={version.project_id || ''}
                        onChange={e => handleInputChange(version.id!, 'project_id', e.target.value || null)}
                        style={styles.input}
                    >
                        <option value="">-- Select a Project --</option>
                        {availableProjects.map(project => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                        ))}
                    </select>
                  </div>
                  <button onClick={() => handleSaveVersion(version.id!)} style={styles.button}>Save</button>
                  <button onClick={() => toggleEditMode(version.id!)} style={{...styles.button, ...styles.buttonSecondary}}>Cancel</button>
                </div>
              ) : (
                <div>
                  <h3>{version.name}</h3>
                  {version.description && <p><strong>Description:</strong> {version.description}</p>}
                  {version.status && <p><strong>Status:</strong> {version.status}</p>}
                  {version.start_date && <p><strong>Start:</strong> {new Date(version.start_date!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                  {version.release_date && <p><strong>Release:</strong> {new Date(version.release_date!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                  {version.project_id && (
                    <p><strong>Project:</strong> {availableProjects.find(p => p.id === version.project_id)?.name || 'Unknown/Loading...'}</p>
                  )}
                  <p style={{fontSize: '0.8em', color: 'var(--text-subtle)'}}>Created: {new Date(version.created_at!).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <button onClick={() => toggleEditMode(version.id!)} style={{...styles.button, ...styles.buttonSecondary, marginRight: '10px'}}>Edit</button>
                  <button onClick={() => handleDeleteVersion(version.id!)} style={{...styles.button, backgroundColor: 'var(--text-error)'}}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default VersionsManager;
