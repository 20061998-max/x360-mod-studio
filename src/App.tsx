import React, { useEffect, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileUp,
  LogIn,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import firebaseConfig from '../firebase-applet-config.json';
import { AdminPanelView } from './components/AdminPanelView';
import { AutoOrganizerView } from './components/AutoOrganizerView';
import { BinaryPatcherView } from './components/BinaryPatcherView';
import { CreatorSignature } from './components/CreatorSignature';
import { DashLaunchView } from './components/DashLaunchView';
import { EditGameView } from './components/EditGameView';
import { HexEditorView } from './components/HexEditorView';
import { ManualView } from './components/ManualView';
import { ModPackageView } from './components/ModPackageView';
import { ModTesterView } from './components/ModTesterView';
import { PlansView } from './components/PlansView';
import { ShowcaseView } from './components/ShowcaseView';
import { Sidebar } from './components/Sidebar';
import { SkinCreatorView } from './components/SkinCreatorView';
import { SubscriptionGate } from './components/SubscriptionGate';
import { TexturePrepView } from './components/TexturePrepView';
import { auth, googleProvider } from './firebase';
import { ModProject, WorkspaceTab } from './types/modding';
import type {
  BillingSettings,
  SubscriptionPlan,
  SubscriptionRequest,
  UserSubscription,
} from './types/subscription';
import { triggerBinaryDownload } from './utils/binaryPatch';
import { DEFAULT_DASHLAUNCH_CONFIG } from './utils/dashLaunch';
import { loadModProjects, saveModProjects } from './utils/projectStorage';
import {
  DEFAULT_BILLING_SETTINGS,
  isBootstrappedOwner,
  isSubscriptionCurrentlyActive,
  saveCreatorPhotoSetting,
  seedInitialAdminDefaultsIfEmpty,
  subscribeAdminStatus,
  subscribeBillingSettings,
  subscribeMyRequests,
  subscribeMySubscription,
  subscribePlans,
  upsertUserProfile,
} from './utils/subscriptionService';

const TAB_TITLES: Record<WorkspaceTab, string> = {
  organizer: 'Auto-Organizador (.ZIP)',
  editgame: 'Edit Game (Substituir)',
  binary: 'Patch Binário (IPS)',
  hex: 'Editor Hex PowerPC',
  modpack: 'Pacote de Mod',
  textures: 'Capas, Homebrew & Texturas',
  skins: 'Criar Skins (Aurora / FSD)',
  dashlaunch: 'DashLaunch (INI)',
  tester: 'Testar Modificações',
  showcase: 'Vitrine de Produtos',
  manual: 'Manual de Uso',
  plans: 'Planos e Assinatura',
  admin: 'Painel Administrador',
};

interface AuthErrorState {
  code: string;
  title: string;
  message: string;
  domain?: string;
}

function parseFirebaseAuthError(error: unknown): AuthErrorState {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? 'auth/unknown')
      : 'auth/unknown';
  const currentHost =
    typeof window !== 'undefined'
      ? window.location.hostname || window.location.origin
      : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        code,
        title: 'Domínio não autorizado no Firebase',
        message:
          'O login com Google foi bloqueado porque este endereço ainda não está na lista de domínios autorizados do seu projeto Firebase.',
        domain: currentHost,
      };
    case 'auth/popup-blocked':
      return {
        code,
        title: 'Pop-up de login bloqueado pelo navegador',
        message:
          'Libere pop-ups para este site nas configurações do navegador ou abra o endereço diretamente no Chrome/Safari (fora de navegadores internos como WhatsApp/Instagram).',
      };
    case 'auth/popup-closed-by-user':
      return {
        code,
        title: 'Login cancelado',
        message:
          'A janela do Google foi fechada antes de terminar o login. Toque em "Entrar com Google" novamente e selecione sua conta.',
      };
    case 'auth/cancelled-popup-request':
      return {
        code,
        title: 'Janela de login já estava em andamento',
        message:
          'A solicitação anterior foi cancelada por um novo toque. Aguarde 1 segundo e toque em "Entrar com Google" apenas uma vez.',
      };
    case 'auth/operation-not-supported-in-this-environment':
      return {
        code,
        title: 'Navegador incompatível com pop-up do Google',
        message:
          'Este ambiente ou navegador interno não suporta a janela do Google. Abra o site diretamente no Google Chrome ou Safari.',
      };
    case 'auth/network-request-failed':
      return {
        code,
        title: 'Falha de conexão ao autenticar',
        message:
          'Não foi possível conectar ao servidor do Google/Firebase. Verifique sua conexão com a internet e tente novamente.',
      };
    case 'auth/web-storage-unsupported':
      return {
        code,
        title: 'Armazenamento/cookies bloqueados',
        message:
          'Seu navegador bloqueou cookies ou armazenamento local necessários para o login. Desative o bloqueio de cookies de terceiros ou saia da guia anônima.',
      };
    default:
      return {
        code,
        title: 'Não foi possível concluir o login com Google',
        message:
          'Tente novamente em alguns instantes. Se estiver acessando pelo link público, verifique se o domínio está autorizado no Firebase.',
      };
  }
}

export default function App() {
  const [projects, setProjects] = useState<ModProject[]>(() => loadModProjects());
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const initial = loadModProjects();
    return initial[0]?.id ?? '';
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('organizer');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Firebase Auth & Subscription State
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingSettings, setBillingSettings] = useState<BillingSettings>(
    DEFAULT_BILLING_SETTINGS
  );
  const [mySubscription, setMySubscription] = useState<UserSubscription | null>(null);
  const [myRequests, setMyRequests] = useState<SubscriptionRequest[]>([]);
  const ownerSeededRef = useRef(false);

  useEffect(() => {
    saveModProjects(projects);
  }, [projects]);

  useEffect(() => {
    const unsubPlans = subscribePlans(setPlans);
    const unsubBilling = subscribeBillingSettings((settings) => {
      setBillingSettings(settings);
    });
    return () => {
      unsubPlans();
      unsubBilling();
    };
  }, []);

  useEffect(() => {
    let unsubAdmin: (() => void) | null = null;
    let unsubSub: (() => void) | null = null;
    let unsubReqs: (() => void) | null = null;

    let active = true;

    void getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          setAuthError(null);
        }
      })
      .catch((error) => {
        if (!active) return;
        setAuthError(parseFirebaseAuthError(error));
      });

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubAdmin?.();
      unsubSub?.();
      unsubReqs?.();
      unsubAdmin = null;
      unsubSub = null;
      unsubReqs = null;

      setCurrentUser(user);
      setAuthReady(true);

      if (!user) {
        setIsAdmin(false);
        setMySubscription(null);
        setMyRequests([]);
        return;
      }

      setAuthError(null);

      void upsertUserProfile(user).catch(() => {
        // Handled & logged by handleFirestoreError inside upsertUserProfile
      });

      if (isBootstrappedOwner(user) && !ownerSeededRef.current) {
        ownerSeededRef.current = true;
        void seedInitialAdminDefaultsIfEmpty().catch(() => {
          // Logged by handleFirestoreError
        });
      }

      unsubAdmin = subscribeAdminStatus(user, setIsAdmin);
      unsubSub = subscribeMySubscription(user.uid, setMySubscription);
      unsubReqs = subscribeMyRequests(user.uid, setMyRequests);
    });

    return () => {
      active = false;
      unsubAuth();
      unsubAdmin?.();
      unsubSub?.();
      unsubReqs?.();
    };
  }, []);

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
      let isTopLevel = false;
      try {
        isTopLevel = window.self === window.top;
      } catch {
        isTopLevel = false;
      }

      if (
        isTopLevel &&
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment')
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          setAuthError(parseFirebaseAuthError(redirectError));
          return;
        }
      }

      setAuthError(parseFirebaseAuthError(error));
    } finally {
      setSigningIn(false);
    }
  };

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // Clipboard may be restricted
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    if (activeTab === 'admin') {
      setActiveTab('plans');
    }
  };

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const handleUpdateActiveProject = (updated: ModProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const handleCreateProject = (
    name: string,
    gameTitle: string,
    titleId: string,
    genre: ModProject['genre']
  ) => {
    const created: ModProject = {
      id: `proj-${Date.now()}`,
      name,
      gameTitle,
      titleId,
      mediaId: '00000001',
      patchVersion: 'v1.0.0',
      author: 'Josuel Roque',
      genre,
      installTarget: `Hdd1:\\Games\\${name.replace(/[^a-zA-Z0-9_-]+/g, '_')}\\`,
      description: '',
      updatedAt: new Date().toISOString(),
      hexRules: [],
      modAssets: [],
      rosterUpdates: [],
      vehicleMods: [],
      weaponMods: [],
      dashLaunch: DEFAULT_DASHLAUNCH_CONFIG,
    };
    setProjects((prev) => [created, ...prev]);
    setActiveProjectId(created.id);
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length > 0 && activeProjectId === id) {
        setActiveProjectId(next[0].id);
      }
      return next;
    });
  };

  const handleExportProjectJson = () => {
    if (!activeProject) return;
    const slug = activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'projeto';
    triggerBinaryDownload(
      JSON.stringify(activeProject, null, 2),
      `${slug}.x360project.json`,
      'application/json'
    );
  };

  const handleImportProjectJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportNotice(null);
    try {
      const raw = await f.text();
      const parsed = JSON.parse(raw) as Partial<ModProject>;
      if (!parsed.name || !Array.isArray(parsed.hexRules) || !Array.isArray(parsed.modAssets)) {
        throw new Error('Estrutura de projeto inválida.');
      }
      const imported: ModProject = {
        ...activeProject,
        ...parsed,
        id: `proj-${Date.now()}`,
        vehicleMods: Array.isArray(parsed.vehicleMods) ? parsed.vehicleMods : [],
        weaponMods: Array.isArray(parsed.weaponMods) ? parsed.weaponMods : [],
        rosterUpdates: Array.isArray(parsed.rosterUpdates) ? parsed.rosterUpdates : [],
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => [imported, ...prev]);
      setActiveProjectId(imported.id);
      setImportNotice(`Projeto "${imported.name}" importado.`);
      setTimeout(() => setImportNotice(null), 3000);
    } catch {
      setImportNotice('Erro ao importar arquivo JSON de projeto.');
      setTimeout(() => setImportNotice(null), 3500);
    }
  };

  if (!activeProject) return null;

  const subActive = isSubscriptionCurrentlyActive(mySubscription);
  const hasToolAccess = isAdmin || !billingSettings.paywallEnabled || subActive;
  const isToolTab =
    activeTab !== 'plans' &&
    activeTab !== 'admin' &&
    activeTab !== 'manual' &&
    activeTab !== 'showcase';

  return (
    <div className="min-h-screen flex bg-[#0B111E] text-slate-100">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        projects={projects}
        activeProjectId={activeProject.id}
        onSelectProject={setActiveProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        user={currentUser}
        isAdmin={isAdmin}
        hasToolAccess={hasToolAccess}
        paywallEnabled={billingSettings.paywallEnabled}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        signingIn={signingIn}
        creatorPhotoUrl={billingSettings.creatorPhotoUrl}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800 bg-[#0E1525] sticky top-0 z-30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Abrir navegação"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap shrink-0">
                Projetos
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="text-slate-300 font-medium truncate max-w-[140px] sm:max-w-[220px]">
                {activeProject.name}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                /
              </span>
              <span className="text-white font-semibold whitespace-nowrap shrink-0">
                {TAB_TITLES[activeTab]}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {importNotice && (
              <span className="hidden xl:inline text-xs text-emerald-400 whitespace-nowrap">
                {importNotice}
              </span>
            )}
            {isAdmin && activeTab !== 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Admin</span>
              </button>
            )}
            {!currentUser ? (
              <button
                type="button"
                disabled={signingIn}
                onClick={() => void handleSignIn()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {signingIn ? 'Entrando...' : 'Entrar'}
                </span>
              </button>
            ) : (
              !isAdmin &&
              !subActive && (
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Assinar</span>
                </button>
              )
            )}
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
              <FileUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Importar</span>
              <input
                type="file"
                accept=".json,.x360project.json"
                className="hidden"
                onChange={handleImportProjectJson}
              />
            </label>
            <button
              type="button"
              onClick={handleExportProjectJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {importNotice && (
            <div className="mb-4 px-4 py-2.5 rounded-md border border-emerald-700/60 bg-emerald-950/50 text-emerald-200 text-xs sm:text-sm flex items-center justify-between gap-3 xl:hidden">
              <span>{importNotice}</span>
              <button
                type="button"
                onClick={() => setImportNotice(null)}
                className="p-1 text-emerald-300 hover:text-white shrink-0"
                aria-label="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-100 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-white">
                      {authError.title}
                    </div>
                    <p className="text-xs sm:text-sm text-red-200 leading-relaxed">
                      {authError.message}
                    </p>
                    <p className="text-[11px] font-mono text-red-300/80">
                      Código: {authError.code}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="p-1 text-red-300 hover:text-white shrink-0"
                  aria-label="Fechar alerta de login"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {authError.domain && (
                <div className="rounded-md bg-[#0B111E] border border-red-500/30 p-3 space-y-2.5 text-xs">
                  <div className="text-slate-300">
                    Para liberar o login neste endereço, adicione o domínio abaixo em{' '}
                    <strong className="text-white">
                      Firebase Console → Authentication → Settings → Authorized domains
                    </strong>
                    :
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-mono">
                      {authError.domain}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyDomain(authError.domain!)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar domínio
                        </>
                      )}
                    </button>
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir Firebase Auth
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'plans' && (
            <PlansView
              user={currentUser}
              isAdmin={isAdmin}
              plans={plans}
              billingSettings={billingSettings}
              mySubscription={mySubscription}
              myRequests={myRequests}
              onSignIn={handleSignIn}
              signingIn={signingIn}
              onOpenAdmin={() => setActiveTab('admin')}
            />
          )}

          {activeTab === 'admin' &&
            (isAdmin && currentUser ? (
              <AdminPanelView
                currentUser={currentUser}
                plans={plans}
                billingSettings={billingSettings}
              />
            ) : (
              <PlansView
                user={currentUser}
                isAdmin={false}
                plans={plans}
                billingSettings={billingSettings}
                mySubscription={mySubscription}
                myRequests={myRequests}
                onSignIn={handleSignIn}
                signingIn={signingIn}
              />
            ))}

          {activeTab === 'showcase' && (
            <ShowcaseView
              isAdmin={isAdmin}
              onGoPlans={() => setActiveTab('plans')}
            />
          )}

          {activeTab === 'manual' && <ManualView onNavigateTab={setActiveTab} />}

          {isToolTab && !authReady && (
            <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-8 text-center text-sm text-slate-400">
              Verificando sessão e assinatura...
            </div>
          )}

          {isToolTab && authReady && !hasToolAccess && (
            <SubscriptionGate
              user={currentUser}
              plans={plans}
              mySubscription={mySubscription}
              onSignIn={handleSignIn}
              signingIn={signingIn}
              onGoPlans={() => setActiveTab('plans')}
              onGoManual={() => setActiveTab('manual')}
              onGoShowcase={() => setActiveTab('showcase')}
            />
          )}

          {isToolTab && authReady && hasToolAccess && (
            <>
              {activeTab === 'organizer' && (
                <AutoOrganizerView
                  project={activeProject}
                  onSyncAssetsToProject={(modAssets) =>
                    handleUpdateActiveProject({
                      ...activeProject,
                      modAssets,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              )}

              {activeTab === 'editgame' && <EditGameView project={activeProject} />}

              {activeTab === 'binary' && <BinaryPatcherView project={activeProject} />}

              {activeTab === 'hex' && (
                <HexEditorView
                  project={activeProject}
                  onUpdateRules={(hexRules) =>
                    handleUpdateActiveProject({
                      ...activeProject,
                      hexRules,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              )}

              {activeTab === 'modpack' && (
                <ModPackageView
                  project={activeProject}
                  onUpdateProject={handleUpdateActiveProject}
                />
              )}

              {activeTab === 'textures' && <TexturePrepView defaultTitleId={activeProject.titleId} />}

              {activeTab === 'skins' && <SkinCreatorView />}

              {activeTab === 'dashlaunch' && (
                <DashLaunchView
                  config={activeProject.dashLaunch}
                  onChange={(dashLaunch) =>
                    handleUpdateActiveProject({
                      ...activeProject,
                      dashLaunch,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              )}

              {activeTab === 'tester' && <ModTesterView project={activeProject} />}
            </>
          )}

          <CreatorSignature
            variant="footer"
            photoUrl={billingSettings.creatorPhotoUrl}
            isAdmin={isAdmin}
            onSavePhotoUrl={(nextUrl) =>
              saveCreatorPhotoSetting(billingSettings, nextUrl)
            }
          />
        </main>
      </div>
    </div>
  );
}
