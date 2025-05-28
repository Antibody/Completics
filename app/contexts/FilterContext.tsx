'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext'; // To check session for fetching data
import { TagBadgeProps } from '../components/TagBadge'; // Corrected path from LabelBadge
import { ProjectForSelect, VerForSelect } from '../components/KanbanBoard'; // Assuming this path

interface FilterContextType {
  allProjectsForFilter: ProjectForSelect[];
  allVersForFilter: VerForSelect[];
  allTagsForFilter: TagBadgeProps[];
  selectedProjectFilterId: string | null;
  setSelectedProjectFilterId: (id: string | null) => void;
  selectedVerFilterId: string | null;
  setSelectedVerFilterId: (id: string | null) => void;
  selectedTagIds: string[];
  setSelectedTagIds: (ids: string[]) => void;
  isLoadingFilterData: boolean;
  refetchFilterData: () => Promise<void>; // Added for manual refetch
  filterDataVersion: number; // Added version counter to context type
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session, user } = useAuth();
  const [allProjectsForFilter, setAllProjectsForFilter] = useState<ProjectForSelect[]>([]);
  const [allVersForFilter, setAllVersForFilter] = useState<VerForSelect[]>([]);
  const [allTagsForFilter, setAllTagsForFilter] = useState<TagBadgeProps[]>([]);
  
  const [selectedProjectFilterId, setSelectedProjectFilterId] = useState<string | null>(null);
  const [selectedVerFilterId, setSelectedVerFilterId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isLoadingFilterData, setIsLoadingFilterData] = useState<boolean>(false);
  const [filterDataVersion, setFilterDataVersion] = useState<number>(0); // Added state for version counter

  const fetchFilterData = useCallback(async () => {
    if (!session) {
      setAllProjectsForFilter([]);
      setAllVersForFilter([]);
      setAllTagsForFilter([]);
      return;
    }
    setIsLoadingFilterData(true);
    try {
      const [pjRes, vRes, tagRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/vers', { cache: 'no-store' }),
        fetch('/api/tags', { cache: 'no-store' }),
      ]);
      const projectsData = await pjRes.json();
      const versData = await vRes.json();
      const tagsData = await tagRes.json();

      setAllProjectsForFilter(pjRes.ok && Array.isArray(projectsData) ? projectsData : []);
      setAllVersForFilter(vRes.ok && Array.isArray(versData) ? versData : []);
      setAllTagsForFilter(tagRes.ok && Array.isArray(tagsData) ? tagsData : []);
      setFilterDataVersion(prev => prev + 1); // Increment version counter on successful fetch
    } catch (err) {
      console.error("FilterContext: Error fetching filter data", err);
      setAllProjectsForFilter([]);
      setAllVersForFilter([]);
      setAllTagsForFilter([]);
    } finally {
      setIsLoadingFilterData(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && user) {
      fetchFilterData();
    } else {
      setAllProjectsForFilter([]);
      setAllVersForFilter([]);
      setAllTagsForFilter([]);
      setSelectedProjectFilterId(null);
      setSelectedVerFilterId(null);
      setSelectedTagIds([]);
    }
  }, [session, user, fetchFilterData]);

  return (
    <FilterContext.Provider value={{
      allProjectsForFilter,
      allVersForFilter,
      allTagsForFilter,
      selectedProjectFilterId,
      setSelectedProjectFilterId,
      selectedVerFilterId,
      setSelectedVerFilterId,
      selectedTagIds,
      setSelectedTagIds,
      isLoadingFilterData,
      refetchFilterData: fetchFilterData, // Expose fetchFilterData as refetchFilterData
      filterDataVersion // Expose filterDataVersion
    }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};
