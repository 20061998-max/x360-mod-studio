import React, { useEffect, useState } from 'react';
import {
  Check,
  Edit3,
  ExternalLink,
  Gamepad2,
  Plus,
  Save,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import type { ShowcaseItem } from '../types/subscription';
import {
  deleteShowcaseItem,
  isSafeHttpUrl,
  saveShowcaseItem,
  seedSampleShowcaseItems,
  SHOWCASE_CATEGORIES,
  subscribeAllShowcaseItems,
  subscribePublishedShowcaseItems,
  type ShowcaseDraftInput,
} from '../utils/showcaseService';
import { formatPriceBrl } from '../utils/subscriptionService';

interface ShowcaseViewProps {
  isAdmin: boolean;
  onGoPlans: () => void;
}

export function ShowcaseView({ isAdmin, onGoPlans }: ShowcaseViewProps) {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin editor state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(SHOWCASE_CATEGORIES[0]);
  const [gameTitle, setGameTitle] = useState('');
  const [version, setVersion] = useState('v1.0');
  const [priceInput, setPriceInput] = useState('29.90');
  const [imageUrl, setImageUrl] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [description, setDescription] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [published, setPublished] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState(1);
  const [saving, setSaving] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = isAdmin
      ? subscribeAllShowcaseItems(setItems)
      : subscribePublishedShowcaseItems(setItems);
    return () => unsub();
  }, [isAdmin]);

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const parsePriceToCents = (raw: string): number => {
    const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
    const val = Number.parseFloat(cleaned);
    if (!Number.isFinite(val) || val < 0) return 0;
    return Math.round(val * 100);
  };

  const openNewForm = () => {
    setEditingId(null);
    setTitle('');
    setCategory(SHOWCASE_CATEGORIES[0]);
    setGameTitle('');
    setVersion('v1.0');
    setPriceInput('29.90');
    setImageUrl('');
    setActionUrl('');
    setDescription('');
    setHighlightsText('Compatível com Xbox 360 RGH/JTAG\nInstalação simples por pasta ou .ZIP');
    setPublished(true);
    setFeatured(false);
    setSortOrder(items.length + 1);
    setShowForm(true);
  };

  const openEditForm = (item: ShowcaseItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setGameTitle(item.gameTitle);
    setVersion(item.version);
    setPriceInput((item.priceCents / 100).toFixed(2));
    setImageUrl(item.imageUrl);
    setActionUrl(item.actionUrl);
    setDescription(item.description);
    setHighlightsText(item.highlights.join('\n'));
    setPublished(item.published);
    setFeatured(item.featured);
    setSortOrder(item.sortOrder);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !gameTitle.trim()) return;
    setSaving(true);
    try {
      const draft: ShowcaseDraftInput = {
        id: editingId ?? undefined,
        title,
        category,
        gameTitle,
        version,
        description,
        priceCents: parsePriceToCents(priceInput),
        imageUrl,
        actionUrl,
        highlights: highlightsText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 8),
        published,
        featured,
        sortOrder: Math.max(0, Math.round(Number(sortOrder) || 0)),
      };
      await saveShowcaseItem(draft, editingId === null);
      setShowForm(false);
      setEditingId(null);
      showMsg('ok', 'Produto salvo na Vitrine.');
    } catch {
      showMsg('err', 'Não foi possível salvar o produto na Vitrine.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: ShowcaseItem) => {
    try {
      await saveShowcaseItem(
        {
          id: item.id,
          title: item.title,
          category: item.category,
          gameTitle: item.gameTitle,
          version: item.version,
          description: item.description,
          priceCents: item.priceCents,
          imageUrl: item.imageUrl,
          actionUrl: item.actionUrl,
          highlights: item.highlights,
          published: !item.published,
          featured: item.featured,
          sortOrder: item.sortOrder,
        },
        false
      );
      showMsg(
        'ok',
        `Produto "${item.title}" ${!item.published ? 'publicado' : 'ocultado'}.`
      );
    } catch {
      showMsg('err', 'Erro ao alterar publicação do produto.');
    }
  };

  const handleDelete = async (item: ShowcaseItem) => {
    try {
      await deleteShowcaseItem(item.id);
      showMsg('ok', `Produto "${item.title}" removido da Vitrine.`);
    } catch {
      showMsg('err', 'Erro ao excluir produto.');
    }
  };

  const handleSeedSamples = async () => {
    try {
      await seedSampleShowcaseItems();
      showMsg('ok', 'Exemplos de produtos adicionados na Vitrine!');
    } catch {
      showMsg('err', 'Erro ao criar produtos de exemplo.');
    }
  };

  const categoriesAvailable = ['Todos', ...Array.from(new Set(items.map((i) => i.category)))];
  const q = searchTerm.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'Todos' && item.category !== categoryFilter) return false;
    if (
      q &&
      !item.title.toLowerCase().includes(q) &&
      !item.gameTitle.toLowerCase().includes(q) &&
      !item.description.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Vitrine de Produtos e Mods
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Confira nossos patches atualizados, packs de veículos, mods de armas e serviços disponíveis para Xbox 360.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {items.length === 0 && (
              <button
                type="button"
                onClick={() => void handleSeedSamples()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-md transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Criar Exemplos na Vitrine
              </button>
            )}
            <button
              type="button"
              onClick={openNewForm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Produto
            </button>
          </div>
        )}
      </div>

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

      {/* Admin Product Form */}
      {isAdmin && showForm && (
        <form
          onSubmit={handleSave}
          className="bg-[#141D2F] border border-emerald-500/40 rounded-lg p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">
              {editingId ? 'Editar Produto da Vitrine' : 'Novo Produto na Vitrine'}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nome do Produto / Patch
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Patch Brasileirão 2026 HD"
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              >
                {SHOWCASE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Valor (R$ · 0 para Grátis/Consultar)
              </label>
              <input
                type="text"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="29.90"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Jogo Compatível
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                placeholder="Ex: PES 2018 / GTA V / CoD BO2"
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Versão
              </label>
              <input
                type="text"
                maxLength={30}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Ordem na Vitrine
              </label>
              <input
                type="number"
                min={0}
                max={1000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                URL da Imagem de Capa (opcional, https://)
              </label>
              <input
                type="url"
                maxLength={500}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Link de Compra / WhatsApp / Download (opcional)
              </label>
              <input
                type="url"
                maxLength={400}
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://wa.me/..."
                className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Descrição do Produto
            </label>
            <textarea
              rows={3}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique o que o patch ou mod adiciona no jogo..."
              className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Destaques (1 item por linha, até 8 itens)
            </label>
            <textarea
              rows={3}
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B111E] border border-slate-700 rounded-md text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
              />
              Publicado na Vitrine
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded border-slate-600 bg-[#0B111E] text-emerald-500"
              />
              Produto em Destaque
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {categoriesAvailable.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                categoryFilter === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#141D2F] text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar produto ou jogo..."
          className="w-full md:w-64 px-3 py-2 text-xs bg-[#141D2F] border border-slate-800 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Showcase Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-10 text-center space-y-2">
          <Store className="w-8 h-8 text-slate-500 mx-auto" />
          <h2 className="text-base font-semibold text-white">
            Nenhum produto publicado na Vitrine ainda
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isAdmin
              ? 'Clique em "Adicionar Produto" ou "Criar Exemplos na Vitrine" acima para começar a mostrar seus mods e patches.'
              : 'Em breve novos patches, packs e modificações estarão disponíveis aqui.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const hasSafeImage = isSafeHttpUrl(item.imageUrl) && !brokenImages[item.id];
            const hasSafeLink = isSafeHttpUrl(item.actionUrl);

            return (
              <article
                key={item.id}
                className={`bg-[#141D2F] border rounded-lg overflow-hidden flex flex-col justify-between ${
                  item.featured ? 'border-emerald-500/50' : 'border-slate-800'
                }`}
              >
                <div>
                  {/* Cover / Visual Header */}
                  <div className="h-40 bg-[#0E1525] border-b border-slate-800 relative flex items-center justify-center overflow-hidden">
                    {hasSafeImage ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <Gamepad2 className="w-10 h-10 text-emerald-500/70" />
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          {item.gameTitle}
                        </span>
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#0B111E]/90 text-emerald-300 border border-slate-700 rounded-sm">
                        {item.category}
                      </span>
                      {item.featured && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-600 text-white rounded-sm">
                          Destaque
                        </span>
                      )}
                    </div>

                    {isAdmin && !item.published && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[10px] font-semibold bg-amber-600/90 text-white rounded-sm">
                        Oculto
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="truncate">{item.gameTitle}</span>
                        {item.version && (
                          <span className="font-mono text-slate-300 shrink-0">
                            {item.version}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-white mt-1">
                        {item.title}
                      </h2>
                    </div>

                    <div className="text-xl font-bold text-emerald-400 tabular-nums">
                      {item.priceCents > 0
                        ? formatPriceBrl(item.priceCents)
                        : 'Incluso / Consultar'}
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {item.highlights.length > 0 && (
                      <ul className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        {item.highlights.map((h, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 pb-5 pt-2 space-y-2.5">
                  {hasSafeLink ? (
                    <a
                      href={item.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Adquirir / Saber Mais
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={onGoPlans}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                    >
                      Ver Planos e Solicitar Acesso
                    </button>
                  )}

                  {isAdmin && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleTogglePublished(item)}
                          className="text-xs text-slate-400 hover:text-emerald-300"
                        >
                          {item.published ? 'Ocultar' : 'Publicar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          className="text-slate-400 hover:text-red-400"
                          title="Excluir produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
