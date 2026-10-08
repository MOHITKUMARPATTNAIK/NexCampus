import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext(null);

const STORAGE_KEY = 'nexcampus_sidebar_collapsed';
const MOBILE_BREAKPOINT = 1024; // lg breakpoint in Tailwind
const NARROW_DESKTOP_BREAKPOINT = 1280; // xl breakpoint

export const SidebarProvider = ({ children }) => {
  const location = useLocation();

  // Initialize collapsed state from localStorage or viewport width
  const [isCollapsed, setIsCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    // Smart default: on smaller laptops/landscape tablets (< 1280px), collapse by default to free content space
    return window.innerWidth < NARROW_DESKTOP_BREAKPOINT;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  const isMobile = windowWidth < MOBILE_BREAKPOINT;

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);

      // Auto close mobile drawer if resized to desktop size
      if (width >= MOBILE_BREAKPOINT) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto close mobile drawer on route change
  useEffect(() => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  }, [location.pathname]);

  // Keyboard shortcut listener (ESC to close mobile drawer, Ctrl+B / Cmd+B to toggle sidebar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC closes mobile drawer
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
      // Ctrl+B / Cmd+B toggles sidebar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (isMobile) {
          setIsMobileOpen((prev) => !prev);
        } else {
          toggleCollapse();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, isMobile]);

  // Persist collapse state
  const setIsCollapsed = useCallback((value) => {
    setIsCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openMobileSidebar = useCallback(() => setIsMobileOpen(true), []);
  const closeMobileSidebar = useCallback(() => setIsMobileOpen(false), []);

  const toggleSidebar = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setIsMobileOpen((prev) => !prev);
    } else {
      toggleCollapse();
    }
  }, [toggleCollapse]);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        isMobile,
        windowWidth,
        toggleSidebar,
        toggleCollapse,
        setIsCollapsed,
        openMobileSidebar,
        closeMobileSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export default SidebarContext;
