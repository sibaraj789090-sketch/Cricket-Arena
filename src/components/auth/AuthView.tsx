import React, { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  Lock,
  User,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  Gift,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthViewProps {
  initialMode?: 'login' | 'signup';
  onSuccess?: () => void;
  onCancel?: () => void;
  isEmbedded?: boolean;
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialMode = 'login',
  onSuccess,
  onCancel,
  isEmbedded = false,
}) => {
  const { loginUser, registerUser, capturedReferralCode, validateReferralCode } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(capturedReferralCode || '');
  const [showReferralInput, setShowReferralInput] = useState(Boolean(capturedReferralCode));
  const [validatingRef, setValidatingRef] = useState(false);
  const [refFeedback, setRefFeedback] = useState<{ valid: boolean; text: string } | null>(null);

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-sync captured referral code if present
  useEffect(() => {
    if (capturedReferralCode) {
      setReferralCode(capturedReferralCode);
      setShowReferralInput(true);
      setRefFeedback({
        valid: true,
        text: `Invite code ${capturedReferralCode} detected! You will receive +50 Bonus Coins!`,
      });
    }
  }, [capturedReferralCode]);

  const resetForm = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
  };

  const handleSwitchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'login') {
      // Login validation
      const identifier = loginMethod === 'email' ? email.trim() : phone.trim();
      if (!identifier) {
        setErrorMsg(
          loginMethod === 'email'
            ? 'Please enter your registered Gmail address.'
            : 'Please enter your registered 10-digit mobile number.'
        );
        return;
      }

      if (loginMethod === 'email' && !identifier.includes('@')) {
        setErrorMsg('Please enter a valid Gmail / Email address format.');
        return;
      }

      if (loginMethod === 'phone' && identifier.replace(/\D/g, '').length < 10) {
        setErrorMsg('Please enter a valid 10-digit mobile phone number.');
        return;
      }

      if (!password) {
        setErrorMsg('Please enter your account password.');
        return;
      }

      setIsSubmitting(true);
      const res = await loginUser({ identifier, password });
      setIsSubmitting(false);

      if (res.success) {
        setSuccessMsg(
          `Welcome back, ${res.user?.name || 'Player'}! Logged in successfully.`
        );
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 700);
      } else {
        setErrorMsg(res.error || 'Invalid credentials. Please verify your details.');
      }
    } else {
      // Sign Up validation
      if (!name.trim() || name.trim().length < 2) {
        setErrorMsg('Please enter your full name (at least 2 characters).');
        return;
      }

      const cleanEmail = email.trim();
      const cleanPhone = phone.trim();

      if (!cleanEmail && !cleanPhone) {
        setErrorMsg('Please provide either your Gmail address or Mobile Number to register.');
        return;
      }

      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setErrorMsg('Please enter a valid Gmail / Email address format.');
        return;
      }

      if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 10) {
        setErrorMsg('Please enter a valid 10-digit mobile phone number.');
        return;
      }

      if (!password || password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }

      setIsSubmitting(true);
      const res = await registerUser({
        name: name.trim(),
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
        password,
        referralCode: referralCode.trim() || undefined,
      });
      setIsSubmitting(false);

      if (res.success) {
        if (res.referralApplied) {
          setSuccessMsg(
            `Account created! Welcome to Cricket Arena, ${res.user?.name || 'Player'}. Referral applied from ${res.referrerName || 'your friend'}! +50 Bonus Coins added!`
          );
        } else {
          setSuccessMsg(
            `Account created successfully! Welcome to Cricket Arena, ${res.user?.name || 'Player'}.`
          );
        }
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 850);
      } else {
        setErrorMsg(res.error || 'Registration failed. Please check your details and try again.');
      }
    }
  };

  const containerClasses = isEmbedded
    ? 'w-full bg-[#0f172a] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 relative overflow-hidden'
    : 'w-full max-w-md mx-auto bg-gradient-to-b from-[#0f172a] to-[#070b14] border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 relative overflow-hidden my-4';

  return (
    <div className={containerClasses}>
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with back/cancel option */}
      <div className="flex items-center justify-between mb-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            No OTP • Instant Sign In
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {mode === 'login' ? 'Sign In to Cricket Arena' : 'Create Free Player Account'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {mode === 'login'
            ? 'Sign in using your Gmail address or registered Mobile number.'
            : 'Register with Gmail or Phone number. No OTP verification required!'}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex p-1 bg-slate-900/90 rounded-2xl border border-slate-800 mb-4">
        <button
          type="button"
          onClick={() => handleSwitchMode('login')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
            mode === 'login'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode('signup')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
            mode === 'signup'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Register Free
        </button>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* ==================== SIGN IN METHOD TOGGLE ==================== */}
        {mode === 'login' && (
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Sign In Method:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('email');
                  setErrorMsg('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                  loginMethod === 'email'
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Gmail Address</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginMethod('phone');
                  setErrorMsg('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                  loginMethod === 'phone'
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Phone Number</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== SIGN UP FULL NAME ==================== */}
        {mode === 'signup' && (
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohit Sharma"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* ==================== GMAIL ADDRESS FIELD ==================== */}
        {(mode === 'signup' || (mode === 'login' && loginMethod === 'email')) && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Gmail Address {mode === 'signup' && <span className="text-slate-500 font-normal">(or Mobile below)</span>}
              </label>
              {mode === 'signup' && (
                <span className="text-[10px] text-emerald-400 font-medium">No OTP Needed</span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@gmail.com"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* ==================== PHONE NUMBER FIELD ==================== */}
        {(mode === 'signup' || (mode === 'login' && loginMethod === 'phone')) && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Mobile Number {mode === 'signup' && <span className="text-slate-500 font-normal">(or Gmail above)</span>}
              </label>
              <span className="text-[10px] text-slate-400 font-mono">India (+91)</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-xs font-bold">
                +91
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-12 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition font-mono"
                autoComplete="tel"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* ==================== PASSWORD FIELD WITH SHOW/HIDE ==================== */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Password <span className="text-rose-400">*</span>
            </label>
            <span className="text-[10px] text-slate-500">Min 6 characters</span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ==================== REFERRAL CODE (SIGNUP ONLY) ==================== */}
        {mode === 'signup' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowReferralInput(!showReferralInput)}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span>{showReferralInput ? 'Referral / Invite Code' : 'Have an Invite Code?'}</span>
              </button>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                +₹50 Bonus
              </span>
            </div>

            {showReferralInput && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setReferralCode(val);
                        setRefFeedback(null);
                      }}
                      placeholder="e.g. ROHIT77 or CRIC101"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono tracking-wider placeholder:normal-case placeholder:font-sans placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  {referralCode.trim() && (
                    <button
                      type="button"
                      disabled={validatingRef}
                      onClick={async () => {
                        setValidatingRef(true);
                        const res = await validateReferralCode(referralCode);
                        setValidatingRef(false);
                        if (res.valid) {
                          setRefFeedback({
                            valid: true,
                            text: `Valid code! Invited by ${res.referrerName || 'a friend'}. Both of you get ₹50 bonus coins!`,
                          });
                        } else {
                          setRefFeedback({
                            valid: false,
                            text: res.error || 'Referral code not found. You can still register without it.',
                          });
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {validatingRef ? 'Checking...' : 'Apply'}
                    </button>
                  )}
                </div>

                {refFeedback && (
                  <p
                    className={`text-[11px] font-medium flex items-center gap-1 ${
                      refFeedback.valid ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {refFeedback.valid ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    )}
                    <span>{refFeedback.text}</span>
                  </p>
                )}

                <p className="text-[10px] text-slate-400 leading-tight">
                  Enter your friend&apos;s invite code to receive <strong>₹50 Welcome Bonus Coins</strong> credited to your wallet upon registration!
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== NO OTP DISCLOSURE ==================== */}
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 font-medium bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-2.5">
          <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Instant login without SMS or email verification codes.</span>
        </div>

        {/* ==================== ERROR ALERT ==================== */}
        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{errorMsg}</div>
          </div>
        )}

        {/* ==================== SUCCESS ALERT ==================== */}
        {successMsg && (
          <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-xl p-3 flex items-start gap-2.5 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{successMsg}</div>
          </div>
        )}

        {/* ==================== SUBMIT BUTTON ==================== */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Processing...</span>
          ) : mode === 'login' ? (
            <>
              <span>Sign In to Cricket Arena</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Create Free Account &amp; Play</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Switch Prompt */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 text-center text-xs text-slate-400">
        {mode === 'login' ? (
          <span>
            Don&apos;t have an account yet?{' '}
            <button
              type="button"
              onClick={() => handleSwitchMode('signup')}
              className="text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              Register Free Now
            </button>
          </span>
        ) : (
          <span>
            Already registered?{' '}
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className="text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              Sign In Here
            </button>
          </span>
        )}
      </div>
    </div>
  );
};
