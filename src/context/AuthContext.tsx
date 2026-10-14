import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, ReferralStats } from '../types';
import { DEMO_USER_PROFILE } from '../lib/initialData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WalletDataStore } from '../lib/walletStorage';
import {
  setAdminSession,
  clearAdminSession,
  verifyAdminSession,
  getAdminHeaders,
  isAuthorizedAdminEmail,
} from '../lib/adminAuth';

export interface RegisterParams {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  referralCode?: string;
}

export interface LoginParams {
  identifier: string;
  password: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  isGuest: boolean;
  capturedReferralCode: string;
  setCapturedReferralCode: (code: string) => void;
  loginAsGuest: () => void;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  registerUser: (params: RegisterParams) => Promise<{ success: boolean; error?: string; user?: UserProfile; referralApplied?: boolean; referrerName?: string }>;
  loginUser: (params: LoginParams) => Promise<{ success: boolean; error?: string; user?: UserProfile }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string, phone?: string, referralCode?: string) => Promise<{ success: boolean; error?: string }>;
  getReferralStats: (userId?: string) => Promise<ReferralStats | null>;
  validateReferralCode: (code: string) => Promise<{ valid: boolean; referrerName?: string; welcomeBonusCoins?: number; error?: string }>;
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
  const [capturedReferralCode, setCapturedReferralCode] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('cricket_arena_referral_code') || '';
  });

  // Capture referral code from URL if user arrived via invite link (?ref=CODE or ?referral=CODE)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('ref') || urlParams.get('referral');
      if (code) {
        const clean = code.trim().toUpperCase();
        localStorage.setItem('cricket_arena_referral_code', clean);
        setCapturedReferralCode(clean);
      }
    } catch (e) {
      console.warn('[AuthContext] Failed to parse referral URL param:', e);
    }
  }, []);

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

      // First check if email is an authorized administrator email
      if (!isAuthorizedAdminEmail(email)) {
        if (isSupabaseConfigured && supabase) {
          try { await supabase.auth.signOut(); } catch {}
        }
        setIsLoading(false);
        return {
          success: false,
          error: `Access Denied: The Gmail account "${email}" is not authorized as an administrator.`,
        };
      }

      // Try authoritative server-side verification safely
      let verifyData: any = null;
      let serverResponded = false;

      try {
        const verifyRes = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            supabaseToken,
          }),
        });

        const text = await verifyRes.text();
        if (text) {
          try {
            verifyData = JSON.parse(text);
            serverResponded = true;
          } catch {
            // Not JSON (e.g., static rewrite fallback)
          }
        }
      } catch (fetchErr) {
        console.warn('Server auth endpoint unreachable, using client session:', fetchErr);
      }

      if (serverResponded && verifyData) {
        if (!verifyData.success) {
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

        setAdminSession(verifyData.token, email.toLowerCase());
      } else {
        // Fallback for static hosts (e.g. Vercel SPA) or offline mode
        const localToken = `token-admin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        setAdminSession(localToken, email.toLowerCase());
      }

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

  const USER_TOKEN_KEY = 'cricket_arena_user_session_token';

  // Hydrate user session from token or cache
  useEffect(() => {
    let isMounted = true;
    async function restoreUserSession() {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem(USER_TOKEN_KEY);
      if (!token) return;

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-user-session-token': token,
          },
        });

        if (res.ok) {
          const text = await res.text();
          let data: any = null;
          try { data = text ? JSON.parse(text) : null; } catch {}
          if (data && data.success && data.user && isMounted) {
            saveUserSession(data.user);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Session restore notice:', err);
      }
    }
    restoreUserSession();
    return () => { isMounted = false; };
  }, []);

  // Register with Name, Email (optional if phone provided), Phone (optional if email provided), Password (No OTP)
  const registerUser = async (
    params: RegisterParams
  ): Promise<{ success: boolean; error?: string; user?: UserProfile; referralApplied?: boolean; referrerName?: string }> => {
    setIsLoading(true);
    try {
      const payload = {
        ...params,
        referralCode: params.referralCode || capturedReferralCode || undefined,
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      if (!res.ok || !data || !data.success) {
        setIsLoading(false);
        return {
          success: false,
          error: data?.error || 'Registration failed. Please check your details and try again.',
        };
      }

      if (data.token && typeof window !== 'undefined') {
        localStorage.setItem(USER_TOKEN_KEY, data.token);
      }

      // If registered with a referral code, credit bonus coins in wallet storage for referee
      if (data.referralApplied && data.user?.id) {
        WalletDataStore.creditReferralReward(
          data.user.id,
          data.referrerName ? `${data.referrerName}'s Referral Invite` : 'Welcome Bonus',
          50
        );
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cricket_arena_referral_code');
          setCapturedReferralCode('');
        }
      }

      saveUserSession(data.user);
      setIsLoading(false);
      return {
        success: true,
        user: data.user,
        referralApplied: data.referralApplied,
        referrerName: data.referrerName,
      };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err?.message || 'Network error during registration. Please verify your connection.',
      };
    }
  };

  // Login with Gmail or Phone Number + Password (No OTP)
  const loginUser = async (params: LoginParams): Promise<{ success: boolean; error?: string; user?: UserProfile }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      if (!res.ok || !data || !data.success) {
        setIsLoading(false);
        return {
          success: false,
          error: data?.error || 'Invalid credentials. Please verify your details and try again.',
        };
      }

      if (data.token && typeof window !== 'undefined') {
        localStorage.setItem(USER_TOKEN_KEY, data.token);
      }

      saveUserSession(data.user);
      setIsLoading(false);
      return { success: true, user: data.user };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err?.message || 'Network error during sign in. Please verify your connection.',
      };
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await loginUser({ identifier: email, password });
    return { success: res.success, error: res.error };
  };

  const loginWithPhone = async (
    phone: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await loginUser({ identifier: phone, password });
    return { success: res.success, error: res.error };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    name: string,
    phone?: string,
    referralCode?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await registerUser({ name, email, phone, password, referralCode });
    return { success: res.success, error: res.error };
  };

  const getReferralStats = async (targetUserId?: string): Promise<ReferralStats | null> => {
    try {
      const uid = targetUserId || user?.id;
      if (!uid || uid === 'user-demo-guest') return null;

      const token = typeof window !== 'undefined' ? localStorage.getItem(USER_TOKEN_KEY) : null;
      const res = await fetch(`/api/auth/referrals/${uid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success) {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cricketarena.app';
        return {
          ...data,
          inviteLink: `${origin}?ref=${data.referralCode}`,
        };
      }
      return null;
    } catch (err) {
      console.warn('[AuthContext] getReferralStats error:', err);
      return null;
    }
  };

  const validateReferralCode = async (
    code: string
  ): Promise<{ valid: boolean; referrerName?: string; welcomeBonusCoins?: number; error?: string }> => {
    try {
      const clean = code.trim().toUpperCase();
      if (!clean) return { valid: false, error: 'Code cannot be empty.' };
      const res = await fetch(`/api/auth/validate-referral/${encodeURIComponent(clean)}`);
      const data = await res.json();
      return data;
    } catch {
      return { valid: false, error: 'Failed to validate referral code.' };
    }
  };

  // General Logout
  const logout = async () => {
    if (isAdmin) {
      await logoutAdmin();
      return;
    }

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(USER_TOKEN_KEY);
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-user-session-token': token,
            },
          });
        } catch {}
        localStorage.removeItem(USER_TOKEN_KEY);
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    saveUserSession(DEMO_USER_PROFILE);
  };

  const updateProfileName = (name: string) => {
    if (!user) return;
    const updated = { ...user, name };
    saveUserSession(updated);
  };

  const isGuest = user?.id === 'user-demo-guest';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        isGuest,
        capturedReferralCode,
        setCapturedReferralCode,
        loginAsGuest,
        loginAdmin,
        logoutAdmin,
        registerUser,
        loginUser,
        loginWithEmail,
        loginWithPhone,
        signUpWithEmail,
        getReferralStats,
        validateReferralCode,
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
