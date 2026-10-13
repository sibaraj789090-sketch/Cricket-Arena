import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { DEMO_USER_PROFILE, DEMO_ADMIN_PROFILE } from '../lib/initialData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  loginAsGuest: () => void;
  loginAsAdmin: (passcode?: string) => boolean;
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

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync with Supabase Auth if configured
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    // Check existing session
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
        avatarUrl: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
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

  const loginAsAdmin = (passcode: string = 'arena2026') => {
    if (passcode === 'arena2026' || passcode === 'admin') {
      saveUserSession(DEMO_ADMIN_PROFILE);
      return true;
    }
    return false;
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
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

      // Offline / Local simulation
      if (email.toLowerCase().includes('admin')) {
        saveUserSession(DEMO_ADMIN_PROFILE);
      } else {
        const customUser: UserProfile = {
          id: `usr-${Date.now()}`,
          email,
          name: email.split('@')[0].toUpperCase(),
          role: 'user',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
          joinedTournamentsCount: 1,
          totalFantasyPoints: 120,
          createdTeamsCount: 1,
        };
        saveUserSession(customUser);
      }
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Login failed' };
    }
  };

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
            data: { name },
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

      // Local / Offline fallback
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        role: 'user',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
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

  const logout = async () => {
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
        isAdmin: user?.role === 'admin',
        isLoading,
        loginAsGuest,
        loginAsAdmin,
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
