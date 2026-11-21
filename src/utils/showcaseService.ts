import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { ShowcaseItem } from '../types/subscription';
import { sanitizeSlugId } from './subscriptionService';

export interface ShowcaseDraftInput {
  id?: string;
  title: string;
  category: string;
  gameTitle: string;
  version: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  actionUrl: string;
  highlights: string[];
  published: boolean;
  featured: boolean;
  sortOrder: number;
}

export const SHOWCASE_CATEGORIES = [
  'Patch Futebol',
  'Pack Corrida',
  'Armas / Tiro',
  'Mod Completo',
  'Dash / Plugins',
  'Serviço / Suporte',
  'Outro',
] as const;

export const SAMPLE_SHOWCASE_ITEMS: ShowcaseDraftInput[] = [
  {
    id: 'patch-brasileirao-2026',
    title: 'Patch Brasileirão & Libertadores 2026',
    category: 'Patch Futebol',
    gameTitle: 'PES / Futebol Xbox 360',
    version: 'v4.0',
    description:
      'Elencos atualizados, uniformes em alta definição, faces novas, chuteiras e estádios brasileiros prontos para rodar no RGH/JTAG.',
    priceCents: 3500,
    imageUrl: '',
    actionUrl: '',
    highlights: [
      'Série A, Série B e principais ligas europeias atualizadas',
      'Kits 2026 em DDS/TGA e placas publicitárias',
      'Instalação simples colando na pasta do game ou Content',
    ],
    published: true,
    featured: true,
    sortOrder: 1,
  },
  {
    id: 'pack-supercarros-handling',
    title: 'Mega Pack 40 Carros + Física Realista',
    category: 'Pack Corrida',
    gameTitle: 'Forza / GTA V Xbox 360',
    version: 'v2.1',
    description:
      'Adiciona veículos esportivos e nacionais com velocidade máxima calibrada, tração ajustada e texturas de pintura exclusivas.',
    priceCents: 2990,
    imageUrl: '',
    actionUrl: '',
    highlights: [
      'Handling.cfg ajustado para drift e pista',
      'Pinturas e rodas customizadas',
      'Compatível com substituição direta pelo Edit Game',
    ],
    published: true,
    featured: false,
    sortOrder: 2,
  },
  {
    id: 'mod-arsenal-fps-gsc',
    title: 'Mod Menu & Pack de Armas Custom',
    category: 'Armas / Tiro',
    gameTitle: 'Call of Duty / Ação FPS',
    version: 'v1.8',
    description:
      'Scripts GSC com novas armas, balanceamento de dano, cadência (RPM), camuflagens personalizadas e suporte a partidas offline/System Link.',
    priceCents: 2500,
    imageUrl: '',
    actionUrl: '',
    highlights: [
      'Novas armas e camuflagens prontas',
      'Scripts GSC validados sem erro de sintaxe',
      'Inclui guia completo de cópia para HD interno',
    ],
    published: true,
    featured: false,
    sortOrder: 3,
  },
];

export function isSafeHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^https?:\/\/.+/i.test(trimmed);
}

function mapShowcaseDoc(id: string, d: Record<string, unknown>): ShowcaseItem {
  return {
    id: String(d.id ?? id),
    title: String(d.title ?? ''),
    category: String(d.category ?? 'Outro'),
    gameTitle: String(d.gameTitle ?? ''),
    version: String(d.version ?? ''),
    description: String(d.description ?? ''),
    priceCents: Number(d.priceCents ?? 0),
    imageUrl: String(d.imageUrl ?? ''),
    actionUrl: String(d.actionUrl ?? ''),
    highlights: Array.isArray(d.highlights) ? d.highlights.map(String) : [],
    published: Boolean(d.published),
    featured: Boolean(d.featured),
    sortOrder: Number(d.sortOrder ?? 0),
    createdAt: (d.createdAt as Timestamp) ?? null,
    updatedAt: (d.updatedAt as Timestamp) ?? null,
  };
}

export function subscribePublishedShowcaseItems(
  onData: (items: ShowcaseItem[]) => void
): () => void {
  const q = query(
    collection(db, 'showcaseItems'),
    where('published', '==', true)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapShowcaseDoc(d.id, d.data()))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'showcaseItems');
    }
  );
}

export function subscribeAllShowcaseItems(
  onData: (items: ShowcaseItem[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'showcaseItems'),
    (snap) => {
      const items = snap.docs
        .map((d) => mapShowcaseDoc(d.id, d.data()))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'showcaseItems');
    }
  );
}

export async function saveShowcaseItem(
  input: ShowcaseDraftInput,
  isNew: boolean
): Promise<string> {
  const itemId = isNew
    ? sanitizeSlugId(input.id || input.title)
    : sanitizeSlugId(input.id || '');
  const path = `showcaseItems/${itemId}`;
  const ref = doc(db, 'showcaseItems', itemId);

  const normalizedHighlights = input.highlights
    .map((h) => h.trim().slice(0, 100))
    .filter((h) => h.length > 0)
    .slice(0, 8);

  const payload = {
    title: input.title.trim().slice(0, 100) || 'Produto',
    category: input.category.trim().slice(0, 50) || 'Outro',
    gameTitle: input.gameTitle.trim().slice(0, 80) || 'Xbox 360',
    version: input.version.trim().slice(0, 30),
    description: input.description.trim().slice(0, 600),
    priceCents: Math.max(0, Math.min(10000000, Math.round(input.priceCents))),
    imageUrl: input.imageUrl.trim().slice(0, 500),
    actionUrl: input.actionUrl.trim().slice(0, 400),
    highlights: normalizedHighlights,
    published: Boolean(input.published),
    featured: Boolean(input.featured),
    sortOrder: Math.max(0, Math.min(1000, Math.round(input.sortOrder))),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(ref, {
        id: itemId,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
    return itemId;
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteShowcaseItem(itemId: string): Promise<void> {
  const path = `showcaseItems/${itemId}`;
  try {
    await deleteDoc(doc(db, 'showcaseItems', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleShowcaseItems(): Promise<void> {
  for (const sample of SAMPLE_SHOWCASE_ITEMS) {
    await saveShowcaseItem(sample, true);
  }
}
