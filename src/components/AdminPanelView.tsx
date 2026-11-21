import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Clock,
  CreditCard,
  Edit3,
  Plus,
  Save,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { OWNER_ADMIN_EMAIL } from '../firebase';
import type {
  AdminUser,
  BillingSettings,
  SubscriptionPlan,
  SubscriptionRequest,
  SubscriptionStatus,
  UserProfile,
  UserSubscription,
} from '../types/subscription';
import {
  addAdminUser,
  approveRequestAndActivate,
  deletePlanById,
  formatDurationLabel,
  formatPriceBrl,
  getRemainingDays,
  isSubscriptionCurrentlyActive,
  rejectRequestByAdmin,
  removeAdminUser,
  saveBillingSettings,
  savePlan,
  seedInitialAdminDefaultsIfEmpty,
  subscribeAdminsList,
  subscribeAllRequests,
  subscribeAllSubscriptions,
  subscribeAllUsers,
  upsertSubscriptionByAdmin,
  type PlanDraftInput,
} from '../utils/subscriptionService';

interface AdminPanelViewProps {
  currentUser: User;
  plans: SubscriptionPlan[];
  billingSettings: BillingSettings;
}

type AdminSection = 'plans' | 'subscribers' | 'settings';

const DURATION_PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias (Mensal)', days: 30 },
  { label: '90 dias (Trimestral)', days: 90 },
  { label: '180 dias (Semestral)', days: 180 },
  { label: '365 dias (Anual)', days: 365 },
];

export function AdminPanelView({
  currentUser,
  plans,
  billingSettings,
}: AdminPanelViewProps) {
  const [section, setSection] = useState<AdminSection>('plans');
  const [allSubscriptions, setAllSubscriptions] = useState<UserSubscription[]>([]);
  const [allRequests, setAllRequests] = useState<SubscriptionRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Plan editor state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planBillingLabel, setPlanBillingLabel] = useState('Mensal');
  const [planDescription, setPlanDescription] = useState('');
  const [planPriceBrlInput, setPlanPriceBrlInput] = useState('19.90');
  const [planDurationDays, setPlanDurationDays] = useState(30);
  const [planSortOrder, setPlanSortOrder] = useState(1);
  const [planFeaturesText, setPlanFeaturesText] = useState('');
  const [planActive, setPlanActive] = useState(true);
  const [planHighlighted, setPlanHighlighted] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Billing settings form state
  const [paywallEnabled, setPaywallEnabled] = useState(billingSettings.paywallEnabled);
  const [pixKey, setPixKey] = useState(billingSettings.pixKey);
  const [paymentLink, setPaymentLink] = useState(billingSettings.paymentLink);
  const [paymentInstructions, setPaymentInstructions] = useState(
    billingSettings.paymentInstructions
  );
  const [supportContact, setSupportContact] = useState(billingSettings.supportContact);
  const [creatorPhotoUrl, setCreatorPhotoUrl] = useState(billingSettings.creatorPhotoUrl ?? '');
  const [savingSettings, setSavingSettings] = useState(false);

  // Subscribers filter & manual grant form
  const [searchTerm, setSearchTerm] = useState('');
  const [grantUserId, setGrantUserId] = useState('');
  const [grantUserEmail, setGrantUserEmail] = useState('');
  const [grantUserName, setGrantUserName] = useState('');
  const [grantPlanId, setGrantPlanId] = useState('manual');
  const [grantPlanName, setGrantPlanName] = useState('Acesso Mensal');
  const [grantPriceInput, setGrantPriceInput] = useState('19.90');
  const [grantDays, setGrantDays] = useState(30);
  const [grantStatus, setGrantStatus] = useState<SubscriptionStatus>('active');
  const [grantNotes, setGrantNotes] = useState('');
  const [savingGrant, setSavingGrant] = useState(false);

  // Request approval overrides
  const [requestNoteMap, setRequestNoteMap] = useState<Record<string, string>>({});
  const [requestDaysMap, setRequestDaysMap] = useState<Record<string, number>>({});

  // Add admin form
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  useEffect(() => {
    const unsubSubs = subscribeAllSubscriptions(setAllSubscriptions);
    const unsubReqs = subscribeAllRequests(setAllRequests);
    const unsubUsers = subscribeAllUsers(setAllUsers);
    const unsubAdmins = subscribeAdminsList(setAdmins);
    return () => {
      unsubSubs();
      unsubReqs();
      unsubUsers();
      unsubAdmins();
    };
  }, []);

  useEffect(() => {
    setPaywallEnabled(billingSettings.paywallEnabled);
    setPixKey(billingSettings.pixKey);
    setPaymentLink(billingSettings.paymentLink);
    setPaymentInstructions(billingSettings.paymentInstructions);
    setSupportContact(billingSettings.supportContact);
    setCreatorPhotoUrl(billingSettings.creatorPhotoUrl ?? '');
  }, [billingSettings]);

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4500);
  };

  const parsePriceInputToCents = (raw: string): number => {
    const normalized = raw.replace(/\s+/g, '').replace(',', '.');
    const num = Number.parseFloat(normalized);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.round(num * 100);
  };

  const openNewPlanForm = () => {
    setEditingPlanId(null);
    setPlanName('');
    setPlanBillingLabel('Mensal');
    setPlanDescription('');
    setPlanPriceBrlInput('19.90');
    setPlanDurationDays(30);
    setPlanSortOrder(plans.length + 1);
    setPlanFeaturesText(
      'Auto-Organizador de pastas e .ZIP\nEditor Hex PowerPC e Patch IPS\nPacotes de Carros, Armas e Futebol'
    );
    setPlanActive(true);
    setPlanHighlighted(false);
    setShowPlanForm(true);
  };

  const openEditPlanForm = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan.id);
    setPlanName(plan.name);
    setPlanBillingLabel(plan.billingLabel);
    setPlanDescription(plan.description);
    setPlanPriceBrlInput((plan.priceCents / 100).toFixed(2));
    setPlanDurationDays(plan.durationDays);
    setPlanSortOrder(plan.sortOrder);
    setPlanFeaturesText(plan.features.join('\n'));
    setPlanActive(plan.active);
    setPlanHighlighted(plan.highlighted);
    setShowPlanForm(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;
    setSavingPlan(true);
    try {
      const draft: PlanDraftInput = {
        id: editingPlanId ?? undefined,
        name: planName,
        billingLabel: planBillingLabel || 'Personalizado',
        description: planDescription,
        priceCents: parsePriceInputToCents(planPriceBrlInput),
        durationDays: Math.max(1, Math.round(Number(planDurationDays) || 30)),
        features: planFeaturesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10),
        active: planActive,
        highlighted: planHighlighted,
        sortOrder: Math.max(0, Math.round(Number(planSortOrder) || 0)),
      };
      await savePlan(draft, editingPlanId === null);
      setShowPlanForm(false);
      setEditingPlanId(null);
      showMsg('ok', 'Plano salvo com sucesso.');
    } catch {
      showMsg('err', 'Erro ao salvar plano. Verifique os campos e tente novamente.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleTogglePlanActive = async (plan: SubscriptionPlan) => {
    try {
      await savePlan(
        {
          id: plan.id,
          name: plan.name,
          billingLabel: plan.billingLabel,
          description: plan.description,
          priceCents: plan.priceCents,
          durationDays: plan.durationDays,
          features: plan.features,
          active: !plan.active,
          highlighted: plan.highlighted,
          sortOrder: plan.sortOrder,
        },
        false
      );
      showMsg('ok', `Plano "${plan.name}" ${!plan.active ? 'ativado' : 'ocultado'}.`);
    } catch {
      showMsg('err', 'Erro ao alterar visibilidade do plano.');
    }
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    try {
      await deletePlanById(plan.id);
      showMsg('ok', `Plano "${plan.name}" removido.`);
    } catch {
      showMsg('err', 'Erro ao remover plano.');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const seeded = await seedInitialAdminDefaultsIfEmpty();
      showMsg(
        'ok',
        seeded
          ? 'Planos padrão (Mensal, Trimestral e Anual) criados com sucesso.'
          : 'Já existem planos cadastrados.'
      );
    } catch {
      showMsg('err', 'Erro ao criar planos padrão.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveBillingSettings({
        paywallEnabled,
        pixKey,
        paymentLink,
        paymentInstructions,
        supportContact,
        creatorPhotoUrl,
      });
      showMsg('ok', 'Configurações de cobrança atualizadas.');
    } catch {
      showMsg('err', 'Erro ao salvar configurações de cobrança.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveRequest = async (req: SubscriptionRequest) => {
    try {
      const customDays = requestDaysMap[req.id] ?? req.durationDays;
      const note = requestNoteMap[req.id] ?? '';
      await approveRequestAndActivate(req, currentUser.uid, note, customDays);
      showMsg('ok', `Assinatura de ${req.userEmail} ativada por ${customDays} dia(s).`);
    } catch {
      showMsg('err', 'Erro ao aprovar solicitação.');
    }
  };

  const handleRejectRequest = async (req: SubscriptionRequest) => {
    try {
      const note = requestNoteMap[req.id] ?? 'Pagamento não identificado.';
      await rejectRequestByAdmin(req.id, note);
      showMsg('ok', `Solicitação de ${req.userEmail} recusada.`);
    } catch {
      showMsg('err', 'Erro ao recusar solicitação.');
    }
  };

  const handleSelectPlanForGrant = (selectedId: string) => {
    setGrantPlanId(selectedId);
    const found = plans.find((p) => p.id === selectedId);
    if (found) {
      setGrantPlanName(found.name);
      setGrantPriceInput((found.priceCents / 100).toFixed(2));
      setGrantDays(found.durationDays);
    }
  };

  const handleSelectUserForGrant = (u: UserProfile) => {
    setGrantUserId(u.uid);
    setGrantUserEmail(u.email);
    setGrantUserName(u.displayName);
  };

  const handleEditExistingSub = (sub: UserSubscription) => {
    setGrantUserId(sub.userId);
    setGrantUserEmail(sub.userEmail);
    setGrantUserName(sub.userName);
    setGrantPlanId(sub.planId || 'manual');
    setGrantPlanName(sub.planName);
    setGrantPriceInput((sub.priceCents / 100).toFixed(2));
    setGrantDays(sub.durationDays);
    setGrantStatus(sub.status);
    setGrantNotes(sub.notes);
    setSection('subscribers');
  };

  const handleSaveGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId.trim() || !grantUserEmail.trim()) {
      showMsg('err', 'Informe o UID e o e-mail do usuário.');
      return;
    }
    setSavingGrant(true);
    try {
      const now = new Date();
      const days = Math.max(1, Math.round(Number(grantDays) || 30));
      const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      await upsertSubscriptionByAdmin({
        userId: grantUserId.trim(),
        userEmail: grantUserEmail.trim(),
        userName: grantUserName.trim() || grantUserEmail.split('@')[0],
        planId: grantPlanId || 'manual',
        planName: grantPlanName.trim() || 'Plano Personalizado',
        priceCents: parsePriceInputToCents(grantPriceInput),
        durationDays: days,
        status: grantStatus,
        startsAt: now,
        expiresAt: expires,
        notes: grantNotes,
        adminUid: currentUser.uid,
      });
      showMsg('ok', `Assinatura de ${grantUserEmail} atualizada (${days} dias).`);
    } catch {
      showMsg('err', 'Erro ao atualizar assinatura do usuário.');
    } finally {
      setSavingGrant(false);
    }
  };

  const handleQuickExtend = async (sub: UserSubscription, extraDays: number) => {
    try {
      const nowMs = Date.now();
      const baseMs =
        sub.status === 'active' && sub.expiresAt && sub.expiresAt.toMillis() > nowMs
          ? sub.expiresAt.toMillis()
          : nowMs;
      const newExpires = new Date(baseMs + extraDays * 24 * 60 * 60 * 1000);
      await upsertSubscriptionByAdmin({
        userId: sub.userId,
        userEmail: sub.userEmail,
        userName: sub.userName,
        planId: sub.planId || 'manual',
        planName: sub.planName,
        priceCents: sub.priceCents,
        durationDays: sub.durationDays + extraDays,
        status: 'active',
        startsAt: sub.startsAt ? sub.startsAt.toDate() : new Date(nowMs),
        expiresAt: newExpires,
        notes: `Estendido +${extraDays} dias pelo admin`,
        adminUid: currentUser.uid,
      });
      showMsg('ok', `+${extraDays} dias adicionados para ${sub.userEmail}.`);
    } catch {
      showMsg('err', 'Erro ao estender assinatura.');
    }
  };

  const handleQuickStatusChange = async (
    sub: UserSubscription,
    newStatus: SubscriptionStatus
  ) => {
    try {
      await upsertSubscriptionByAdmin({
        userId: sub.userId,
        userEmail: sub.userEmail,
        userName: sub.userName,
        planId: sub.planId || 'manual',
        planName: sub.planName,
        priceCents: sub.priceCents,
        durationDays: sub.durationDays,
        status: newStatus,
        startsAt: sub.startsAt ? sub.startsAt.toDate() : new Date(),
        expiresAt: sub.expiresAt ? sub.expiresAt.toDate() : new Date(),
        notes: `Status alterado para ${newStatus}`,
        adminUid: currentUser.uid,
      });
      showMsg('ok', `Status de ${sub.userEmail} atualizado.`);
    } catch {
      showMsg('err', 'Erro ao atualizar status da assinatura.');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUid.trim() || !newAdminEmail.trim()) return;
    try {
      await addAdminUser(newAdminUid.trim(), newAdminEmail.trim(), currentUser.uid);
      setNewAdminUid('');
      setNewAdminEmail('');
      showMsg('ok', 'Administrador adicionado.');
    } catch {
      showMsg('err', 'Erro ao adicionar administrador.');
    }
  };

  const handleRemoveAdmin = async (uid: string) => {
    try {
      await removeAdminUser(uid);
      showMsg('ok', 'Administrador removido.');
    } catch {
      showMsg('err', 'Erro ao remover administrador.');
    }
  };

  const activeSubsCount = allSubscriptions.filter(isSubscriptionCurrentlyActive).length;
  const pendingRequests = allRequests.filter((r) => r.status === 'pending');
  const activePlansCount = plans.filter((p) => p.active).length;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSubs = allSubscriptions.filter(
    (s) =>
      !normalizedSearch ||
      s.userEmail.toLowerCase().includes(normalizedSearch) ||
      s.userName.toLowerCase().includes(normalizedSearch) ||
      s.userId.toLowerCase().includes(normalizedSearch)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Painel Administrador
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure valores, tempos de assinatura, regras de acesso e gerencie assinantes.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#141D2F] border border-slate-800 p-1 rounded-md self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSection('plans')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              section === 'plans'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Planos e Valores
          </button>
          <button
            type="button"
            onClick={() => setSection('subscribers')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              section === 'subscribers'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Assinantes
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 rounded-sm tabular-nums">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSection('settings')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              section === 'settings'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Cobrança e Acesso
          </button>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-md border text-sm ${
            notice.type === 'ok'
              ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
              : 'bg-red-950/50 border-red-700/60 text-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Assinaturas Ativas</div>
          <div className="text-2xl font-bold text-white mt-1 tabular-nums">
            {activeSubsCount}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Solicitações Pendentes</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
            {pendingRequests.length}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Planos Ativos</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
            {activePlansCount} / {plans.length}
          </div>
        </div>
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400">Modo do Site</div>
          <div className="text-sm font-semibold text-white mt-2">
            {billingSettings.paywallEnabled ? 'Assinatura Obrigatória' : 'Acesso Aberto (Gratuito)'}
          </div>
        </div>
      </div>

      {/* SECTION 1: PLANS & PRICING */}
      {section === 'plans' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Catálogo de Planos, Valores e Durações
              </h2>
              <p className="text-xs text-slate-400">
                Altere preços, prazos (em dias) e benefícios a qualquer momento. As mudanças são refletidas na hora para todos os visitantes.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {plans.length === 0 && (
                <button
                  type="button"
                  onClick={() => void handleSeedDefaults()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Criar Planos Padrão
                </button>
              )}
              <button
                type="button"
                onClick={openNewPlanForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Plano
              </button>
            </div>
          </div>

          {/* Plan Form */}
          {showPlanForm && (
            <form
              onSubmit={handleSavePlan}
              className="bg-[#141D2F] border border-emerald-500/40 rounded-lg p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">
                  {editingPlanId ? 'Editar Plano Existente' : 'Criar Novo Plano'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPlanForm(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nome do Plano
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Ex: Acesso Mensal Pro"
                    className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Rótulo do Período
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={planBillingLabel}
                    onChange={(e) => setPlanBillingLabel(e.target.value)}
                    placeholder="Ex: Mensal, Anual, Semanal"
                    className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={planPriceBrlInput}
                    onChange={(e) => setPlanPriceBrlInput(e.target.value)}
                    placeholder="19.90"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Tempo de Assinatura (Dias)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={36500}
                    value={planDurationDays}
                    onChange={(e) => setPlanDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Duration Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Atalhos de duração:</span>
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => {
                      setPlanDurationDays(preset.days);
                      if (preset.days === 30) setPlanBillingLabel('Mensal');
                      else if (preset.days === 90) setPlanBillingLabel('Trimestral');
                      else if (preset.days === 180) setPlanBillingLabel('Semestral');
                      else if (preset.days === 365) setPlanBillingLabel('Anual');
                      else if (preset.days === 7) setPlanBillingLabel('Semanal');
                      else setPlanBillingLabel(`${preset.days} dias`);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      planDurationDays === preset.days
                        ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-[#0B111E] border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Descrição
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    placeholder="Breve descrição do que está incluído neste plano"
                    className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={planSortOrder}
                    onChange={(e) => setPlanSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Benefícios (1 por linha, até 10 itens)
                </label>
                <textarea
                  rows={3}
                  value={planFeaturesText}
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planActive}
                    onChange={(e) => setPlanActive(e.target.checked)}
                    className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
                  />
                  Plano ativo e visível para venda
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planHighlighted}
                    onChange={(e) => setPlanHighlighted(e.target.checked)}
                    className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
                  />
                  Destacar como Recomendado
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPlanForm(false)}
                  className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingPlan ? 'Salvando...' : 'Salvar Plano'}
                </button>
              </div>
            </form>
          )}

          {/* Plans List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-400 uppercase">
                      {plan.billingLabel}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {plan.highlighted && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-sm">
                          Destaque
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-sm border ${
                          plan.active
                            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {plan.active ? 'Ativo' : 'Oculto'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white tabular-nums">
                      {formatPriceBrl(plan.priceCents)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono tabular-nums">
                      / {formatDurationLabel(plan.durationDays)}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{plan.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => openEditPlanForm(plan)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Valor / Tempo
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleTogglePlanActive(plan)}
                      className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md"
                    >
                      {plan.active ? 'Ocultar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePlan(plan)}
                      title="Excluir plano"
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: SUBSCRIBERS & REQUESTS */}
      {section === 'subscribers' && (
        <div className="space-y-6">
          {/* Pending Requests */}
          <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-semibold text-white">
                  Solicitações de Assinatura ({allRequests.length})
                </h2>
              </div>
            </div>

            {allRequests.length === 0 ? (
              <p className="text-xs text-slate-400">
                Nenhuma solicitação registrada até o momento.
              </p>
            ) : (
              <div className="space-y-3">
                {allRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-[#0B111E] border border-slate-800 rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {req.userName}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {req.userEmail}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-sm border ${
                            req.status === 'approved'
                              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                              : req.status === 'rejected'
                              ? 'bg-red-600/20 text-red-300 border-red-500/30'
                              : 'bg-amber-600/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {req.status === 'approved'
                            ? 'Aprovada'
                            : req.status === 'rejected'
                            ? 'Recusada'
                            : 'Pendente'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 tabular-nums">
                        Plano: <strong>{req.planName}</strong> ·{' '}
                        <span className="text-emerald-400 font-mono">
                          {formatPriceBrl(req.priceCents)}
                        </span>{' '}
                        · {req.durationDays} dia(s)
                      </div>
                      <div className="text-xs text-slate-400 break-all">
                        Comprovante / Ref: <span className="text-slate-200">{req.paymentReference || 'Não informado'}</span>
                      </div>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={36500}
                          value={requestDaysMap[req.id] ?? req.durationDays}
                          onChange={(e) =>
                            setRequestDaysMap((prev) => ({
                              ...prev,
                              [req.id]: Number(e.target.value),
                            }))
                          }
                          title="Dias a conceder"
                          className="w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#141D2F] border border-slate-700 rounded-md text-white"
                        />
                        <input
                          type="text"
                          placeholder="Nota (opcional)"
                          value={requestNoteMap[req.id] ?? ''}
                          onChange={(e) =>
                            setRequestNoteMap((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          className="w-40 px-2.5 py-1.5 text-xs bg-[#141D2F] border border-slate-700 rounded-md text-white placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => void handleApproveRequest(req)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Aprovar e Ativar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectRequest(req)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-red-900/60 text-slate-200 border border-slate-700 rounded-md"
                        >
                          <X className="w-3.5 h-3.5" />
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Manual Grant / Edit Subscription */}
          <form
            onSubmit={handleSaveGrant}
            className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  Conceder ou Editar Assinatura Manualmente
                </h2>
              </div>
              {allUsers.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const u = allUsers.find((item) => item.uid === e.target.value);
                    if (u) handleSelectUserForGrant(u);
                  }}
                  className="px-3 py-1.5 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-200"
                >
                  <option value="">Selecionar usuário cadastrado...</option>
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">UID do Usuário</label>
                <input
                  type="text"
                  required
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  placeholder="UID do Firebase Auth"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={grantUserEmail}
                  onChange={(e) => setGrantUserEmail(e.target.value)}
                  placeholder="cliente@gmail.com"
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={grantUserName}
                  onChange={(e) => setGrantUserName(e.target.value)}
                  placeholder="Nome do assinante"
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Basear no Plano</label>
                <select
                  value={grantPlanId}
                  onChange={(e) => handleSelectPlanForGrant(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                >
                  <option value="manual">Personalizado (Manual)</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatPriceBrl(p.priceCents)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Rótulo do Plano</label>
                <input
                  type="text"
                  required
                  value={grantPlanName}
                  onChange={(e) => setGrantPlanName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Valor (R$)</label>
                <input
                  type="text"
                  value={grantPriceInput}
                  onChange={(e) => setGrantPriceInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tempo (Dias)</label>
                <input
                  type="number"
                  min={1}
                  max={36500}
                  value={grantDays}
                  onChange={(e) => setGrantDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select
                  value={grantStatus}
                  onChange={(e) => setGrantStatus(e.target.value as SubscriptionStatus)}
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                >
                  <option value="active">Ativo</option>
                  <option value="suspended">Suspenso</option>
                  <option value="expired">Expirado</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="text"
                value={grantNotes}
                onChange={(e) => setGrantNotes(e.target.value)}
                placeholder="Observação interna (opcional)"
                className="flex-1 px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
              <button
                type="submit"
                disabled={savingGrant}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                {savingGrant ? 'Aplicando...' : 'Salvar Assinatura'}
              </button>
            </div>
          </form>

          {/* Active & Historical Subscribers Table */}
          <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-semibold text-white">
                Todos os Assinantes ({filteredSubs.length})
              </h2>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, e-mail ou UID..."
                className="w-full sm:w-64 px-3 py-1.5 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500"
              />
            </div>

            {filteredSubs.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum assinante encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-4 font-medium">Assinante</th>
                      <th className="py-2 pr-4 font-medium">Plano</th>
                      <th className="py-2 pr-4 font-medium">Validade</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium text-right">Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredSubs.map((sub) => {
                      const activeNow = isSubscriptionCurrentlyActive(sub);
                      const rem = getRemainingDays(sub.expiresAt);
                      return (
                        <tr key={sub.userId} className="text-slate-200">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-white">{sub.userName}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {sub.userEmail}
                            </div>
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            <div>{sub.planName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {formatPriceBrl(sub.priceCents)} · {sub.durationDays}d
                            </div>
                          </td>
                          <td className="py-3 pr-4 tabular-nums font-mono text-slate-300">
                            {sub.expiresAt
                              ? sub.expiresAt.toDate().toLocaleDateString('pt-BR')
                              : '—'}
                            {activeNow && (
                              <div className="text-[11px] text-emerald-400">
                                {rem} dia(s)
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-sm border ${
                                activeNow
                                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                                  : sub.status === 'suspended'
                                  ? 'bg-red-600/20 text-red-300 border-red-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {activeNow
                                ? 'Ativo'
                                : sub.status === 'suspended'
                                ? 'Suspenso'
                                : 'Expirado'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleQuickExtend(sub, 30)}
                                className="px-2 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded"
                              >
                                +30d
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleQuickExtend(sub, 365)}
                                className="px-2 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded"
                              >
                                +1a
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditExistingSub(sub)}
                                className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
                              >
                                Editar
                              </button>
                              {sub.status === 'active' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleQuickStatusChange(sub, 'suspended')}
                                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-red-900/60 text-red-300 rounded"
                                >
                                  Suspender
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleQuickStatusChange(sub, 'active')}
                                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-emerald-900/60 text-emerald-300 rounded"
                                >
                                  Reativar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION 3: BILLING SETTINGS & ADMINS */}
      {section === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveSettings}
            className="bg-[#141D2F] border border-slate-800 rounded-lg p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-white">
              Cobrança e Controle de Acesso (Paywall)
            </h2>

            <label className="flex items-start gap-3 p-3.5 bg-[#0B111E] border border-slate-800 rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={paywallEnabled}
                onChange={(e) => setPaywallEnabled(e.target.checked)}
                className="mt-1 rounded border-slate-600 bg-[#0B111E] text-emerald-500"
              />
              <div>
                <div className="text-sm font-medium text-white">
                  Exigir assinatura ativa para usar o estúdio
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Quando ativado, visitantes sem assinatura ativa só acessam as abas Planos e Manual. Quando desativado, o site fica liberado gratuitamente.
                </div>
              </div>
            </label>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Chave Pix para Recebimento
              </label>
              <input
                type="text"
                maxLength={180}
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Ex: seuemail@pix.com ou CPF/CNPJ/Aleatória"
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Link de Checkout Externo (opcional)
              </label>
              <input
                type="url"
                maxLength={300}
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contato de Suporte / Envio de Comprovante
              </label>
              <input
                type="text"
                maxLength={180}
                value={supportContact}
                onChange={(e) => setSupportContact(e.target.value)}
                placeholder="WhatsApp, Discord ou E-mail"
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Foto ao Lado da Assinatura (URL HTTPS ou ./creator-photo.jpg)
              </label>
              <input
                type="text"
                maxLength={500}
                value={creatorPhotoUrl}
                onChange={(e) => setCreatorPhotoUrl(e.target.value)}
                placeholder="https://... ou ./creator-photo.jpg"
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Instruções Exibidas ao Assinante
              </label>
              <textarea
                rows={4}
                maxLength={800}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </form>

          {/* Admins Management */}
          <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">
                Administradores Autorizados
              </h2>
            </div>

            <div className="bg-[#0B111E] border border-slate-800 rounded-md p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Proprietário Principal</div>
                <div className="text-xs font-mono text-emerald-400">{OWNER_ADMIN_EMAIL}</div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-sm">
                Permanente
              </span>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-3 pt-2 border-t border-slate-800">
              <div className="text-xs font-medium text-slate-300">
                Conceder Acesso Administrativo Adicional
              </div>
              {allUsers.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const u = allUsers.find((item) => item.uid === e.target.value);
                    if (u) {
                      setNewAdminUid(u.uid);
                      setNewAdminEmail(u.email);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-200"
                >
                  <option value="">Preencher a partir de usuário cadastrado...</option>
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.email})
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="UID do usuário"
                  className="px-3 py-2 text-xs font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="E-mail do usuário"
                  className="px-3 py-2 text-xs bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-md"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Adicionar Administrador
              </button>
            </form>

            {admins.length > 0 && (
              <div className="space-y-2 pt-2">
                {admins.map((adm) => (
                  <div
                    key={adm.uid}
                    className="flex items-center justify-between gap-2 bg-[#0B111E] border border-slate-800 rounded-md px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-slate-200 truncate">{adm.email}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">{adm.uid}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveAdmin(adm.uid)}
                      className="text-xs text-slate-400 hover:text-red-400 shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
