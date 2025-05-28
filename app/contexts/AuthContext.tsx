'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import supabase from '../../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean; // Auth loading state
  isAdmin: boolean;
  dbSetupAttempted: boolean; 
  isDbSetupInProgress: boolean; // New state for DB setup in progress
  triggerDbSetup: () => Promise<void>; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Auth loading
  const [isAdmin, setIsAdmin] = useState(false);
  const [dbSetupAttempted, setDbSetupAttempted] = useState(false);
  const [isDbSetupInProgress, setIsDbSetupInProgress] = useState(false); // Initialize new state

  // IMPORTANT: Ensure ADMIN_ALLOWED_EMAIL is set in your .env.local file
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL; // Removed incorrect default

  useEffect(() => {
    const getSession = async () => {
      console.log('[AuthContext] getSession: Fetching current session...');
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('[AuthContext] getSession: Current session user email:', currentSession?.user?.email);
      console.log('[AuthContext] getSession: ADMIN_EMAIL from env:', ADMIN_EMAIL);
      const isAdminCheck = currentSession?.user?.email === ADMIN_EMAIL;
      console.log('[AuthContext] getSession: isAdmin check result:', isAdminCheck);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsAdmin(isAdminCheck);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log('[AuthContext] onAuthStateChange: Event:', _event);
      console.log('[AuthContext] onAuthStateChange: Current session user email:', currentSession?.user?.email);
      console.log('[AuthContext] onAuthStateChange: ADMIN_EMAIL from env:', ADMIN_EMAIL);
      const isAdminCheck = currentSession?.user?.email === ADMIN_EMAIL;
      console.log('[AuthContext] onAuthStateChange: isAdmin check result:', isAdminCheck);

      // Only update state if session or user data has actually changed
      const hasSessionChanged = session?.access_token !== currentSession?.access_token || session?.user?.id !== currentSession?.user?.id;
      const hasUserChanged = user?.id !== currentSession?.user?.id || user?.email !== currentSession?.user?.email;

      if (hasSessionChanged || hasUserChanged || (session === null && currentSession !== null) || (session !== null && currentSession === null)) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsAdmin(isAdminCheck);
        if (_event === 'SIGNED_IN' && isAdminCheck && !dbSetupAttempted) {
          console.log('[AuthContext] Admin SIGNED_IN, triggering DB setup via API...');
          triggerDbSetupApiCall(); 
        }
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ADMIN_EMAIL, dbSetupAttempted]); // Added dbSetupAttempted

  const triggerDbSetupApiCall = async () => {
    if (dbSetupAttempted) {
      console.log('[AuthContext] DB setup already attempted this session.');
      return;
    }
    
    console.log('[AuthContext] Calling /api/admin/initialize-schema...');
    setDbSetupAttempted(true); 
    setIsDbSetupInProgress(true); // Set setup in progress to true
    try {
      const response = await fetch('/api/admin/initialize-schema', { method: 'POST' });
      const result = await response.json();
      if (response.ok && result.success) {
        console.log('[AuthContext] /api/admin/initialize-schema call successful:', result.message);
      } else {
        console.error('[AuthContext] /api/admin/initialize-schema call failed:', result.message || response.statusText);
        // Potentially set an error state here for the UI to consume
      }
    } catch (error) {
      console.error('[AuthContext] Error calling /api/admin/initialize-schema:', error);
        // Potentially set an error state here
    } finally {
      setIsDbSetupInProgress(false); // Set setup in progress to false when done
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, isAdmin, dbSetupAttempted, isDbSetupInProgress, triggerDbSetup: triggerDbSetupApiCall }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => { // Use full AuthContextType
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
