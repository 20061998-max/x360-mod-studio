import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Binary,
  BookOpen,
  Cpu,
  CreditCard,
  FileCode2,
  FlaskConical,
  FolderKanban,
  Image as ImageIcon,
  Layers,
  Lock,
  LogIn,
  LogOut,
  PackageCheck,
  Palette,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { ModProject, WorkspaceTab } from '../types/modding';
import { CreatorSignature } from './CreatorSignature';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  projects: ModProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string, gameTitle: string, titleId: string, genre: ModProject['genre']) => void;
  onDeleteProject: (id: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: User | null;
  isAdmin: boolean;
  hasToolAccess: boolean;
  paywallEnabled: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  creatorPhotoUrl?: string;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresSubscription?: boolean;
}> = [
  { id: 'organizer', label: 'Auto-Organizador (.ZIP)', icon: PackageCheck, requiresSubscription: true },
  { id: 'editgame', label: 'Edit Game (Substituir)', icon: Layers, requiresSubscription: true },
  { id: 'modpack', label: 'Pacote de Mod', icon: FolderKanban, requiresSubscription: true },
  { id: 'binary', label: 'Patch Binário (IPS)', icon: Binary, requiresSubscription: true },
  { id: 'hex', label: 'Editor Hex PowerPC', icon: Cpu, requiresSubscription: true },
  { id: 'textures', label: 'Capas, Homebrew & Texturas', icon: ImageIcon, requiresSubscription: true },
  { id: 'skins', label: 'Criar Skins (Aurora/FSD)', icon: Palette, requiresSubscription: true },
  { id: 'dashlaunch', label: 'DashLaunch (INI)', icon: FileCode2, requiresSubscription: true },
  { id: 'tester', label: 'Testar Modificações', icon: FlaskConical, requiresSubscription: true },
  { id: 'manual', label: 'Manual de Uso', icon: BookOpen, requiresSubscription: false },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  mobileOpen,
  onCloseMobile,
  user,
  isAdmin,
  hasToolAccess,
  paywallEnabled,
  onSignIn,
  onSignOut,
  creatorPhotoUrl,
}: SidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGame, setNewGame] = useState('');
  const [newTitleId, setNewTitleId] = useState('4B4E084F');
  const [newGenre, setNewGenre] = useState<ModProject['genre']>('Futebol');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateProject(
      newName.trim(),
      newGame.trim() || 'Jogo Xbox 360',
      newTitleId.trim().toUpperCase().slice(0, 8) || '00000000',
      newGenre
    );
    setNewName('');
    setNewGame('');
    setCreating(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0E1525] border-r border-slate-800 text-slate-200">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800 shrink-0">
        <span className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          X360 Mod Studio
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Projeto Ativo</span>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-slate-800/80 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo
          </button>
        </div>

        {creating ? (
          <form onSubmit={handleCreate} className="space-y-2.5 pt-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do patch (ex: Mod Carros)"
              className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
            <input
              type="text"
              value={newGame}
              onChange={(e) => setNewGame(e.target.value)}
              placeholder="Jogo base (ex: CoD BO2 / Forza)"
              className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newTitleId}
                onChange={(e) => setNewTitleId(e.target.value)}
                placeholder="Title ID"
                maxLength={8}
                className="w-full px-2.5 py-2 text-xs font-mono uppercase bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <select
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value as ModProject['genre'])}
                className="w-full px-2 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="Futebol">Futebol</option>
                <option value="Corrida">Corrida</option>
                <option value="Tiro / FPS">Tiro / FPS</option>
                <option value="Ação / Mundo Aberto">Ação</option>
                <option value="Luta">Luta</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {projects.map((proj) => {
              const isSelected = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  className={`group flex items-center justify-between rounded-md transition-colors ${
                    isSelected ? 'bg-slate-800/90 text-white' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(proj.id);
                      onCloseMobile();
                    }}
                    className="flex-1 text-left px-3 py-2 min-w-0"
                  >
                    <div className="text-xs font-medium truncate">{proj.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
                      {proj.titleId} · {proj.genre}
                    </div>
                  </button>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      title="Excluir projeto"
                      className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Ferramentas de Modding">
        <div className="px-3 py-1.5 text-xs font-medium text-slate-500">Ferramentas</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const locked = Boolean(item.requiresSubscription && paywallEnabled && !hasToolAccess);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                active
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {locked && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            </button>
          );
        })}

        <div className="px-3 pt-4 pb-1.5 text-xs font-medium text-slate-500">
          Loja e Assinatura
        </div>
        <button
          type="button"
          onClick={() => {
            onSelectTab('showcase');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'showcase'
              ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
          }`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span className="truncate">Vitrine de Produtos</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onSelectTab('plans');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'plans'
              ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span className="truncate">Planos e Assinatura</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              onSelectTab('admin');
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
                : 'text-emerald-300 hover:bg-slate-800/60 hover:text-emerald-200 border border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Painel Admin</span>
          </button>
        )}
      </nav>

      {/* Creator Signature */}
      <CreatorSignature variant="sidebar" photoUrl={creatorPhotoUrl} />

      {/* Account Footer */}
      <div className="p-3.5 border-t border-slate-800 space-y-2.5 shrink-0">
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {user.displayName || user.email}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {isAdmin
                  ? 'Administrador'
                  : hasToolAccess
                  ? 'Acesso Liberado'
                  : 'Sem Assinatura'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onSignOut()}
              title="Sair da conta"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar com Google
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
