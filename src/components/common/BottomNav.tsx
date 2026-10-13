import React from 'react';
import { Home, Trophy, Users, BarChart3, User, Shield, Dices, Gamepad2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'home'
  | 'tournaments'
  | 'my-teams'
  | 'rankings'
  | 'profile'
  | 'admin'
  | 'ludo-match'
  | 'ludo-tournaments'
  | 'ludo-lobby';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  myTeamsCount: number;
  activeGameMode?: 'cricket' | 'ludo';
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  myTeamsCount,
  activeGameMode = 'cricket',
}) => {
  const { isAdmin } = useAuth();

  const cricketTabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'my-teams', label: 'My Teams', icon: Users, badge: myTeamsCount > 0 ? myTeamsCount : undefined },
    { id: 'rankings', label: 'Rankings', icon: BarChart3 },
    { id: isAdmin ? 'admin' : 'profile', label: isAdmin ? 'Admin' : 'Profile', icon: isAdmin ? Shield : User },
  ];

  const ludoTabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'ludo-match', label: 'Cash Tables', icon: Dices },
    { id: 'ludo-tournaments', label: 'Tournaments', icon: Trophy },
    { id: isAdmin ? 'admin' : 'profile', label: isAdmin ? 'Admin' : 'Profile', icon: isAdmin ? Shield : User },
  ];

  const tabs = activeGameMode === 'ludo' ? ludoTabs : cricketTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1d]/98 backdrop-blur-lg border-t border-slate-800 pb-safe shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-emerald-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-emerald-500 text-slate-950 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
