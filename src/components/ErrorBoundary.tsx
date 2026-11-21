import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ocorreu um erro inesperado na aplicação.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro capturado pelo ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B111E] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#141D2F] border border-slate-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold text-white">
                Algo deu errado ao carregar esta tela
              </h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Não foi possível concluir a operação solicitada. Recarregue a página ou tente novamente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
