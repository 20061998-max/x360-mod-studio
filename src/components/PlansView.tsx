import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  LogIn,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  BillingSettings,
  SubscriptionPlan,
  SubscriptionRequest,
  UserSubscription,
} from '../types/subscription';
import {
  cancelPendingRequest,
  createSubscriptionRequest,
  formatDurationLabel,
  formatPriceBrl,
  getRemainingDays,
  isSubscriptionCurrentlyActive,
} from '../utils/subscriptionService';

interface PlansViewProps {
  user: User | null;
  isAdmin: boolean;
  plans: SubscriptionPlan[];
  billingSettings: BillingSettings;
  mySubscription: UserSubscription | null;
  myRequests: SubscriptionRequest[];
  onSignIn: () => Promise<void>;
  onOpenAdmin?: () => void;
}

export function PlansView({
  user,
  isAdmin,
  plans,
  billingSettings,
  mySubscription,
  myRequests,
  onSignIn,
  onOpenAdmin,
}: PlansViewProps) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const activePlans = plans.filter((p) => p.active);
  const subActive = isSubscriptionCurrentlyActive(mySubscription);
  const remainingDays = getRemainingDays(mySubscription?.expiresAt ?? null);

  const handleCopyPix = async () => {
    if (!billingSettings.pixKey) return;
    try {
      await navigator.clipboard.writeText(billingSettings.pixKey);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPlan) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await createSubscriptionRequest(user, selectedPlan, paymentReference);
      setPaymentReference('');
      setSelectedPlan(null);
      setFeedback({
        type: 'ok',
        text: 'Solicitação enviada! Assim que o administrador confirmar o pagamento, seu acesso será ativado.',
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'Não foi possível enviar a solicitação. Verifique sua conta e tente novamente.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    setFeedback(null);
    try {
      await cancelPendingRequest(reqId);
      setFeedback({ type: 'ok', text: 'Solicitação pendente cancelada.' });
    } catch {
      setFeedback({ type: 'err', text: 'Erro ao cancelar a solicitação.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Planos e Assinatura
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Escolha o plano ideal para desbloquear todas as ferramentas do X360 Mod Studio.
          </p>
        </div>
        {isAdmin && onOpenAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-md transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            Gerenciar Preços no Painel Admin
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-md border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
              : 'bg-red-950/50 border-red-700/60 text-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Account & Current Subscription Status */}
      <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-medium text-slate-400">Status da Conta</span>
            {isAdmin ? (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-sm">
                Administrador
              </span>
            ) : subActive ? (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-sm">
                Assinatura Ativa
              </span>
            ) : !billingSettings.paywallEnabled ? (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-sky-600/20 text-sky-300 border border-sky-500/30 rounded-sm">
                Acesso Liberado pelo Admin
              </span>
            ) : user ? (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-sm">
                Sem Assinatura Ativa
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-sm">
                Visitante
              </span>
            )}
          </div>

          {user ? (
            <div className="text-sm text-slate-200">
              Conectado como <span className="font-semibold text-white">{user.displayName || user.email}</span>{' '}
              <span className="text-slate-400 font-mono text-xs">({user.email})</span>
            </div>
          ) : (
            <div className="text-sm text-slate-300">
              Faça login com sua conta Google para contratar um plano ou acompanhar sua assinatura.
            </div>
          )}

          {mySubscription && (
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 tabular-nums">
              <span>
                Plano: <strong className="text-slate-200">{mySubscription.planName}</strong>
              </span>
              {mySubscription.expiresAt && (
                <span>
                  Validade:{' '}
                  <strong className="text-slate-200">
                    {mySubscription.expiresAt.toDate().toLocaleDateString('pt-BR')}
                  </strong>{' '}
                  ({subActive ? `${remainingDays} dia(s) restantes` : 'Expirado'})
                </span>
              )}
              <span>
                Situação:{' '}
                <strong className="text-slate-200">
                  {mySubscription.status === 'active'
                    ? subActive
                      ? 'Ativo'
                      : 'Expirado'
                    : mySubscription.status === 'suspended'
                    ? 'Suspenso'
                    : 'Expirado'}
                </strong>
              </span>
            </div>
          )}
        </div>

        {!user && (
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <LogIn className="w-4 h-4" />
            Entrar com Google
          </button>
        )}
      </section>

      {/* Plans Grid */}
      {activePlans.length === 0 ? (
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-8 text-center space-y-2">
          <CreditCard className="w-8 h-8 text-slate-500 mx-auto" />
          <h2 className="text-base font-semibold text-white">
            Nenhum plano disponível no momento
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            O administrador ainda está configurando os valores e períodos de assinatura.
            {isAdmin ? ' Acesse o Painel Admin para criar ou ativar planos.' : ''}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activePlans.map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;
            return (
              <div
                key={plan.id}
                className={`flex flex-col justify-between rounded-lg p-6 border transition-colors ${
                  plan.highlighted
                    ? 'bg-[#162136] border-emerald-500/60'
                    : 'bg-[#141D2F] border-slate-800'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      {plan.billingLabel}
                    </span>
                    {plan.highlighted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-sm">
                        <Sparkles className="w-3 h-3" />
                        Recomendado
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white tabular-nums">
                        {formatPriceBrl(plan.priceCents)}
                      </span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        / {formatDurationLabel(plan.durationDays)}
                      </span>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-slate-300 leading-relaxed">{plan.description}</p>
                  )}

                  {plan.features.length > 0 && (
                    <ul className="space-y-2 pt-2 border-t border-slate-800/80">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full py-2.5 px-4 text-sm font-semibold rounded-md transition-colors ${
                      isSelected
                        ? 'bg-slate-700 text-white border border-slate-600'
                        : plan.highlighted
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {isSelected ? 'Selecionado abaixo' : subActive ? 'Renovar com este plano' : 'Assinar este plano'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout / Activation Request Form */}
      {selectedPlan && (
        <section className="bg-[#141D2F] border border-emerald-500/40 rounded-lg p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Solicitar Ativação — {selectedPlan.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                Valor: <strong className="text-emerald-400">{formatPriceBrl(selectedPlan.priceCents)}</strong> · Duração:{' '}
                <strong className="text-slate-200">{formatDurationLabel(selectedPlan.durationDays)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlan(null)}
              className="text-xs text-slate-400 hover:text-white self-start sm:self-auto"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Info */}
            <div className="space-y-4">
              <div className="text-sm font-semibold text-white">Instruções de Pagamento</div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {billingSettings.paymentInstructions}
              </p>

              {billingSettings.pixKey && (
                <div className="bg-[#0B111E] border border-slate-800 rounded-md p-3.5 space-y-1.5">
                  <div className="text-xs font-medium text-slate-400">Chave Pix</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono text-emerald-300 break-all">
                      {billingSettings.pixKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyPix()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedPix ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {billingSettings.paymentLink && (
                <div>
                  <a
                    href={billingSettings.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-md transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir Link de Pagamento Externo
                  </a>
                </div>
              )}

              {billingSettings.supportContact && (
                <div className="text-xs text-slate-400">
                  Suporte / Comprovantes:{' '}
                  <span className="text-slate-200 font-medium">{billingSettings.supportContact}</span>
                </div>
              )}
            </div>

            {/* Request Form */}
            <div className="space-y-4">
              {!user ? (
                <div className="bg-[#0B111E] border border-slate-800 rounded-md p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    Entre com sua conta para continuar
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    É necessário estar conectado com sua conta Google para vincular a assinatura ao seu e-mail.
                  </p>
                  <button
                    type="button"
                    onClick={() => void onSignIn()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Entrar com Google
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div>
                    <label
                      htmlFor="payment-ref"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Identificação do pagamento / Código Pix / Nome no comprovante
                    </label>
                    <input
                      id="payment-ref"
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      maxLength={200}
                      placeholder="Ex: Pix de João Silva - ID E12345 ou aguardo confirmação"
                      className="w-full px-3 py-2.5 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md transition-colors"
                  >
                    {submitting ? 'Enviando solicitação...' : 'Confirmar e Enviar Solicitação'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* User's Requests History */}
      {user && myRequests.length > 0 && (
        <section className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Clock className="w-4 h-4 text-slate-400" />
            Minhas Solicitações de Assinatura
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4 font-medium">Plano</th>
                  <th className="py-2 pr-4 font-medium">Valor / Prazo</th>
                  <th className="py-2 pr-4 font-medium">Referência</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {myRequests.map((req) => (
                  <tr key={req.id} className="text-slate-200">
                    <td className="py-2.5 pr-4 font-medium">{req.planName}</td>
                    <td className="py-2.5 pr-4 tabular-nums font-mono text-slate-300">
                      {formatPriceBrl(req.priceCents)} · {req.durationDays}d
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 max-w-[240px] truncate">
                      {req.paymentReference || '—'}
                      {req.adminNote ? ` · Obs: ${req.adminNote}` : ''}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-sm border ${
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
                    </td>
                    <td className="py-2.5 text-right">
                      {req.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => void handleCancelRequest(req.id)}
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-red-400 transition-colors"
                          title="Cancelar solicitação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
