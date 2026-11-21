import React from 'react';
import type { User } from 'firebase/auth';
import { BookOpen, CreditCard, Lock, LogIn, Store } from 'lucide-react';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';
import { formatDurationLabel, formatPriceBrl } from '../utils/subscriptionService';

interface SubscriptionGateProps {
  user: User | null;
  plans: SubscriptionPlan[];
  mySubscription: UserSubscription | null;
  onSignIn: () => Promise<void>;
  onGoPlans: () => void;
  onGoManual: () => void;
  onGoShowcase: () => void;
}

export function SubscriptionGate({
  user,
  plans,
  mySubscription,
  onSignIn,
  onGoPlans,
  onGoManual,
  onGoShowcase,
}: SubscriptionGateProps) {
  const activePlans = plans.filter((p) => p.active).slice(0, 3);

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-600/15 border border-emerald-500/30 rounded-md text-emerald-400 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Acesso Exclusivo para Assinantes
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {mySubscription?.status === 'suspended'
                ? 'Sua assinatura foi suspensa pelo administrador. Entre em contato ou escolha um plano para reativar.'
                : mySubscription
                ? 'Sua assinatura expirou. Renove seu plano para continuar utilizando o Auto-Organizador, Patcher IPS, Editor Hex e Pacotes de Mod.'
                : 'Para desbloquear todas as ferramentas do X360 Mod Studio no navegador, ative uma assinatura mensal, anual ou personalizada.'}
            </p>
          </div>
        </div>

        {activePlans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {activePlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-[#0B111E] border border-slate-800 rounded-md p-4 space-y-1"
              >
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  {plan.billingLabel}
                </div>
                <div className="text-sm font-semibold text-white">{plan.name}</div>
                <div className="text-xl font-bold text-white tabular-nums pt-1">
                  {formatPriceBrl(plan.priceCents)}
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  {formatDurationLabel(plan.durationDays)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onGoPlans}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Ver Planos e Assinar
          </button>

          {!user && (
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Já assinei · Entrar com Google
            </button>
          )}

          <button
            type="button"
            onClick={onGoShowcase}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors"
          >
            <Store className="w-4 h-4" />
            Ver Vitrine de Produtos
          </button>

          <button
            type="button"
            onClick={onGoManual}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Ler Manual de Uso
          </button>
        </div>
      </div>
    </div>
  );
}
