"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Menu, X, LogOut, User, Settings, ChevronDown, 
  LayoutDashboard, Users, FileSpreadsheet, UserCheck, 
  Kanban, Clock, FileText, CheckSquare, GraduationCap, Award, Globe
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type Props = {
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  roleLabel: string;
  navItems: NavItem[];
  logoutAction: () => void;
  children: React.ReactNode;
};

const iconMap: Record<string, React.ComponentType<any>> = {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  UserCheck,
  Kanban,
  Clock,
  FileText,
  CheckSquare,
  GraduationCap,
  Award,
  Globe
};

export function DashboardShell({ 
  userName, 
  userEmail, 
  avatarUrl, 
  roleLabel, 
  navItems, 
  logoutAction, 
  children 
}: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Branding header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
          <Link href="/" className="flex items-center gap-2 font-black tracking-wider text-teal-400">
            <GraduationCap size={24} />
            <span>UTERO ACADEMY</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const IconComponent = iconMap[item.icon] || LayoutDashboard;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                  isActive 
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/10" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <IconComponent size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick User summary in Sidebar bottom */}
        <div className="border-t border-slate-800 p-4 bg-slate-950/40 flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-800 border border-slate-700">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-teal-800 text-teal-200 font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{roleLabel}</p>
          </div>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          {/* Hamburger toggle */}
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb title placeholder */}
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 font-semibold">
            <span>Utero Academy Platform</span>
            <span>/</span>
            <span className="text-teal-700 font-bold">{roleLabel} Panel</span>
          </div>

          {/* User Settings Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 rounded-full p-1.5 hover:bg-slate-100 transition-all focus:outline-none"
            >
              <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-teal-50 text-teal-700 font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="hidden sm:inline text-sm font-bold text-slate-700">{userName}</span>
              <ChevronDown size={14} className="text-slate-500" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 text-left mb-1">
                    <p className="text-xs text-slate-400 font-semibold">Login sebagai</p>
                    <p className="text-sm font-black text-slate-800 truncate">{userName}</p>
                  </div>
                  <Link 
                    href="/dashboard/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 font-bold transition-all"
                  >
                    <User size={16} />
                    <span>Edit Profil</span>
                  </Link>
                  <form action={logoutAction}>
                    <button 
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 font-bold transition-all"
                    >
                      <LogOut size={16} />
                      <span>Log Out</span>
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Dashboard Main Content area */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </div>
      </div>
    </div>
  );
}
