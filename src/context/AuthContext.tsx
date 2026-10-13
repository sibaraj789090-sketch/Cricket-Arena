import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { DEMO_USER_PROFILE } from '../lib/initialData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  setAdminSession,
  clearAdminSession,
  verifyAdminSession,
  getAdminHeaders,
} from '../lib/adminAuth';

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  loginAsGuest: () => void;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfileName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'cricket_arena_active_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return DEMO_USER_PROFILE;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEMO_USER_PROFILE;
    } catch {
      return DEMO_USER_PROFILE;
    }
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate admin token on mount
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      const result = await verifyAdminSession();
      if (isMounted) {
        setIsAdmin(result.authenticated);
        setIsLoading(false);
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync with Supabase Auth if configured (for normal players)
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncSupabaseProfile(session.user);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await syncSupabaseProfile(session.user);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const syncSupabaseProfile = async (sbUser: any) => {
    try {
      if (!supabase) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      const mappedUser: UserProfile = {
        id: sbUser.id,
        email: sbUser.email || 'user@cricketarena.app',
        name: profile?.name || sbUser.user_metadata?.name || 'Cricket Fan',
        role: profile?.role === 'admin' ? 'admin' : 'user',
        avatarUrl:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
        joinedTournamentsCount: 2,
        totalFantasyPoints: 450,
        createdTeamsCount: 2,
      };

      setUser(mappedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mappedUser));
    } catch (err) {
      console.warn('Error fetching Supabase profile, using metadata', err);
    }
  };

  const saveUserSession = (userProfile: UserProfile | null) => {
    setUser(userProfile);
    if (typeof window !== 'undefined') {
      if (userProfile) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  };

  const loginAsGuest = () => {
    saveUserSession(DEMO_USER_PROFILE);
  };

  // Secure Administrator Authentication
  const loginAdmin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      let supabaseToken: string | undefined;

      // If Supabase is configured, authenticate with Supabase Auth first
      if (isSupabaseConfigured && supabase) {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (sbError) {
          setIsLoading(false);
          return { success: false, error: sbError.message };
        }

        if (sbData?.session?.access_token) {
          supabaseToken = sbData.session.access_token;
        }
      }

      // Authoritative server-side verification: enforces single authorized admin email
      const verifyRes = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          supabaseToken,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        // If Supabase session was opened for an unauthorized email, sign out immediately
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signOut();
        }
        setIsLoading(false);
        return {
          success: false,
          error:
            verifyData.error ||
            'Access Denied: Invalid credentials or account is not authorized as an administrator.',
        };
      }

      // Store server admin session
      setAdminSession(verifyData.token, email.toLowerCase());
      setIsAdmin(true);

      const adminProfile: UserProfile = {
        id: 'admin-master',
        email: email.toLowerCase(),
        name: 'Administrator',
        role: 'admin',
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        joinedTournamentsCount: 14,
        totalFantasyPoints: 4890,
        createdTeamsCount: 14,
      };

      saveUserSession(adminProfile);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err?.message || 'Administrator authentication request failed.',
      };
    }
  };

  // Secure Administrator Logout
  const logoutAdmin = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
    } catch {}

    clearAdminSession();
    setIsAdmin(false);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    saveUserSession(DEMO_USER_PROFILE);
  };

  // Normal Player Login (Never grants admin role)
  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }
        if (data.user) {
          await syncSupabaseProfile(data.user);
        }
        setIsLoading(false);
        return { success: true };
      }

      // Standard user login (Always role: 'user')
      const customUser: UserProfile = {
        id: `usr-${Date.now()}`,
        email,
        name: email.split('@')[0].toUpperCase(),
        role: 'user',
        avatarUrl:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
        joinedTournamentsCount: 1,
        totalFantasyPoints: 120,
        createdTeamsCount: 1,
      };
      saveUserSession(customUser);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Login failed' };
    }
  };

  // Normal Player Registration (Always role: 'user')
  const signUpWithEmail = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, role: 'user' },
          },
        });
        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }
        if (data.user) {
          await syncSupabaseProfile(data.user);
        }
        setIsLoading(false);
        return { success: true };
      }

      // Local fallback
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        role: 'user',
        avatarUrl:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
        joinedTournamentsCount: 0,
        totalFantasyPoints: 0,
        createdTeamsCount: 0,
      };
      saveUserSession(newUser);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Sign up failed' };
    }
  };

  // General Logout
  const logout = async () => {
    if (isAdmin) {
      await logoutAdmin();
      return;
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    saveUserSession(DEMO_USER_PROFILE);
  };

  const updateProfileName = (name: string) => {
    if (!user) return;
    const updated = { ...user, name };
    saveUserSession(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        loginAsGuest,
        loginAdmin,
        logoutAdmin,
        loginWithEmail,
        signUpWithEmail,
        logout,
        updateProfileName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
