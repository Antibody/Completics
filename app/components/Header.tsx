// components/Header.tsx
'use client';

import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSearch } from '../contexts/SearchContext';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';
import supabase from '../../lib/supabaseClient';
import DeleteAccountModal from './DeleteAccountModal';
import ToastNotification from './ToastNotification';
import { useIsMobile } from '../hooks/useIsMobile';

interface ToastInfo {
  message: string;
  type: 'success' | 'error' | 'info';
}

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20" height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const navItems: { label: string; href: string; title: string }[] = [
  { label: 'Workspace', href: '/', title: 'Main Kanban workspace view' },
  { label: 'Calendar', href: '/calendar', title: 'Calendar view of tasks with due dates' },
  { label: 'Projects', href: '/projects', title: 'Manage your larger projects or features' },
  { label: 'Versions', href: '/vers', title: 'Manage software versions or sprints' },
  { label: 'Archive', href: '/archive', title: 'View and manage archived tasks' },
];

const Header: React.FC = () => {
  const pathname = usePathname();
  const { searchTerm, setSearchTerm } = useSearch();
  const { user, session } = useAuth();
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [toastInfo, setToastInfo] = useState<ToastInfo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isVerDropdownOpen, setIsVerDropdownOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const initialTheme = (storedTheme === 'light' || storedTheme === 'dark') ? storedTheme : 'dark';
    setTheme(initialTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(initialTheme);
    if (localStorage.getItem('theme') !== initialTheme) {
      localStorage.setItem('theme', initialTheme);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = (): void => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error);
  };

  const handleDeleteAccountClick = () => {
    setIsUserMenuOpen(false);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAccount = async (password: string) => {
    setIsDeletingAccount(true);
    setToastInfo(null);
    setDeleteError(null);
    try {
      const response = await fetch('/api/user/remove-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setDeleteError(result.message || `HTTP error! status: ${response.status}`);
        if (response.status !== 403 && response.status !== 400) {
          setToastInfo({ message: result.message || `HTTP error! status: ${response.status}`, type: 'error' });
        }
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      setToastInfo({ message: result.message || 'Account successfully deleted. You will be logged out.', type: 'success' });
      setIsDeleteModalOpen(false);
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error deleting account:', error);
      if (!deleteError) {
        const msg = error instanceof Error ? error.message : 'An unknown error occurred.';
        setToastInfo({ message: `Error: ${msg}`, type: 'error' });
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const userMenuTriggerStyle: React.CSSProperties = {
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: isUserMenuOpen ? 'var(--background-hover)' : 'transparent',
    transition: 'background-color 0.2s ease',
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.95rem',
    color: 'var(--foreground)',
    transition: 'background-color 0.15s ease-out',
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        height: '56px',
        backgroundColor: 'var(--header-bg)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <nav style={{
        display: 'flex',
        gap: isMobile ? '8px' : '16px',
        overflowX: isMobile ? 'auto' : 'visible',
        flexShrink: isMobile ? 1 : 0,
      }}>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            style={{
              textDecoration: 'none',
              fontWeight: pathname === item.href ? 600 : 400,
              color: pathname === item.href ? 'var(--link-active)' : 'var(--link-inactive)',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ flexGrow: 1 }} />

      {session && (
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search tasks…"
          style={{
            padding: '6px 12px',
            border: '1px solid var(--input-border)',
            borderRadius: '4px',
            fontSize: '0.9em',
            width: isMobile ? '120px' : '200px',
            maxWidth: isMobile ? '40vw' : '30vw',
            marginRight: isMobile ? '8px' : '16px',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--input-text)',
          }}
        />
      )}

      {!isMobile && pathname === '/' && session && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '16px' }}>
          {/* Project Filter Icon */}
          <div className="onboarding-text-container" style={{ position: 'relative' }}>
            <button
              title="Filter tasks by project"
              onClick={() => {
                setIsProjectDropdownOpen(open => !open);
                setIsVerDropdownOpen(false);
                setIsTagDropdownOpen(false);
              }}
              className={selectedProjectFilterId != null ? 'pulsate-plus-btn' : undefined}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}
            >
              💼
            </button>
            {selectedProjectFilterId != null && (
              <div className="onboarding-floating-text">Project filter active</div>
            )}
            {isProjectDropdownOpen && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 200,
                  minWidth: '160px',
                }}
              >
                <div
                  onClick={() => { onProjectFilterChange(null); setIsProjectDropdownOpen(false); }}
                  style={{ padding: '8px', cursor: 'pointer', whiteSpace: 'nowrap', pointerEvents: 'auto' }}
                >
                  All Projects
                </div>
                {allProjects.map(proj => (
                  <div
                    key={proj.id}
                    onClick={() => { onProjectFilterChange(proj.id); setIsProjectDropdownOpen(false); }}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      backgroundColor: selectedProjectFilterId === proj.id ? 'var(--background-selected)' : 'transparent',
                      pointerEvents: 'auto',
                    }}
                  >
                    {proj.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Ver Filter Icon */}
          <div className="onboarding-text-container" style={{ position: 'relative' }}>
            <button
              title="Filter tasks by ver"
              onClick={() => {
                setIsVerDropdownOpen(open => !open);
                setIsProjectDropdownOpen(false);
                setIsTagDropdownOpen(false);
              }}
              className={selectedVerFilterId != null ? 'pulsate-plus-btn' : undefined}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}
            >
              🗃️
            </button>
            {selectedVerFilterId != null && (
              <div className="onboarding-floating-text">Ver filter active</div>
            )}
            {isVerDropdownOpen && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 200,
                  minWidth: '160px',
                }}
              >
                <div
                  onClick={() => { onVerFilterChange(null); setIsVerDropdownOpen(false); }}
                  style={{ padding: '8px', cursor: 'pointer', whiteSpace: 'nowrap', pointerEvents: 'auto' }}
                >
                  All Vers
                </div>
                {allVers.map(ver => (
                  <div
                    key={ver.id}
                    onClick={() => { onVerFilterChange(ver.id); setIsVerDropdownOpen(false); }}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      backgroundColor: selectedVerFilterId === ver.id ? 'var(--background-selected)' : 'transparent',
                      pointerEvents: 'auto',
                    }}
                  >
                    {ver.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Tag Filter Icon */}
          <div className="onboarding-text-container" style={{ position: 'relative' }}>
            <button
              title="Filter tasks by tag"
              onClick={() => {
                setIsTagDropdownOpen(open => !open);
                setIsProjectDropdownOpen(false);
                setIsVerDropdownOpen(false);
              }}
              className={selectedTagIds.length > 0 ? 'pulsate-plus-btn' : undefined}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}
            >
              🏷️
            </button>
            {selectedTagIds.length > 0 && (
              <div className="onboarding-floating-text">Tag filter active</div>
            )}
            {isTagDropdownOpen && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 200,
                  minWidth: '160px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                }}
              >
                <div
                  onClick={() => { onTagFilterChange([]); setIsTagDropdownOpen(false); }}
                  style={{ padding: '8px', cursor: 'pointer', whiteSpace: 'nowrap', pointerEvents: 'auto' }}
                >
                  All Tags
                </div>
                {allTags.map(tag => (
                  <div
                    key={tag.id}
                    onClick={() => { onTagFilterChange([tag.id]); setIsTagDropdownOpen(false); }}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: selectedTagIds.includes(tag.id) ? 'var(--background-selected)' : 'transparent',
                      pointerEvents: 'auto',
                    }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: tag.color || '#888',
                      marginRight: '6px',
                    }} />
                    {tag.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}



    {user && user.email && (
      <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
        <button
          onClick={() => setIsUserMenuOpen(open => !open)}
          onMouseEnter={() => setIsUserMenuOpen(true)}
          style={userMenuTriggerStyle}
          aria-expanded={isUserMenuOpen}
          aria-haspopup="true"
        >
          {isMobile ? <UserIcon /> : user.email}
          {!isMobile && <span style={{ fontSize: '0.7em', marginLeft: '4px' }}>▼</span>}
        </button>
        {isUserMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 200,
              minWidth: '180px',
              padding: '4px 0',
            }}
            onMouseLeave={() => setIsUserMenuOpen(false)}
          >
            <button onClick={handleLogout} style={menuItemStyle}>
              Logout
            </button>
            <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--border-color-subtle)' }} />
            <button onClick={handleDeleteAccountClick} style={{ ...menuItemStyle, color: 'var(--text-error)' }}>
              Delete Account
            </button>
          </div>
        )}
      </div>
    )}


      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.2em',
          marginLeft: '8px',
        }}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setDeleteError(null); }}
        onConfirmDelete={confirmDeleteAccount}
        isDeleting={isDeletingAccount}
        errorMessage={deleteError}
      />
      {toastInfo && (
        <ToastNotification
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}
    </header>
  );
};

export default Header;
