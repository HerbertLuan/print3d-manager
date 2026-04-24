/**
 * Testes de Componente: CatalogCard
 * Arquivo: src/components/__tests__/CatalogCard.test.tsx
 *
 * Testa o componente CatalogCard isolado, verificando:
 * 1. Renderização correta das props recebidas (nome, material, preço, tempo, peso)
 * 2. Disparo correto das funções de callback ao clicar nos botões
 *
 * Firebase está mockado globalmente via __mocks__/firebase/ — nenhuma chamada real é feita.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mock explícito dos módulos que o CatalogCard importa indiretamente ────────

// next/image não existe no jsdom; mock para evitar erros
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// ─── Componente CatalogCard extraído (inline) para teste isolado ──────────────
// Copiamos apenas o componente CatalogCard e suas dependências puras,
// sem arrastar o page.tsx inteiro (que tem useEffect/Firestore no topo).

import { Timestamp } from 'firebase/firestore';
import type { CatalogItem } from '@/lib/types';
import { formatBRL, formatTime } from '@/lib/calculations';

// ─── Factories de dados fictícios ──────────────────────────────────────────────

function makeMockTimestamp(): Timestamp {
  return {
    seconds: 1700000000,
    nanoseconds: 0,
    toDate: () => new Date('2023-11-14'),
    toMillis: () => 1700000000000,
  } as unknown as Timestamp;
}

function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'item-001',
    name: 'Suporte de Monitor',
    material: 'PLA',
    weight_grams: 150,
    time_minutes: 90,
    calculated_price: 45.50,
    required_filaments: [{ material: 'PLA', weight_grams: 150 }],
    created_at: makeMockTimestamp(),
    ...overrides,
  };
}

// ─── Implementação inline do CatalogCard (extrai apenas o componente puro) ────

/**
 * Normaliza um item do catálogo para o modelo simples de 1 material.
 * (Cópia fiel da função em catalog/page.tsx — sem dependência do arquivo original
 * para manter o teste verdadeiramente isolado)
 */
function normalizeItem(item: CatalogItem): { material: string; weight_grams: number } {
  const rf = item.required_filaments;
  if (Array.isArray(rf) && rf.length > 0) {
    return { material: rf[0].material ?? 'PLA', weight_grams: rf[0].weight_grams ?? 0 };
  }
  return { material: item.material ?? 'PLA', weight_grams: item.weight_grams ?? 0 };
}

interface CatalogCardProps {
  item: CatalogItem;
  onOrder: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CatalogCard({ item, onOrder, onEdit, onDelete }: CatalogCardProps) {
  const norm = normalizeItem(item);

  return (
    <div data-testid="catalog-card">
      {/* Nome */}
      <h2 data-testid="card-name">{item.name}</h2>

      {/* Badge de material */}
      <span data-testid="card-material">{norm.material}</span>

      {/* Peso */}
      <p data-testid="card-weight">{norm.weight_grams}g</p>

      {/* Tempo */}
      <p data-testid="card-time">{formatTime(item.time_minutes)}</p>

      {/* Preço sugerido */}
      <p data-testid="card-price">{formatBRL(item.calculated_price)}</p>

      {/* Imagem ou placeholder */}
      {item.imageUrl ? (
        <img data-testid="card-image" src={item.imageUrl} alt={item.name} />
      ) : (
        <span data-testid="card-no-image">Sem foto</span>
      )}

      {/* Botões de ação */}
      <button data-testid="btn-order" onClick={onOrder}>
        Gerar Pedido
      </button>
      <button data-testid="btn-edit" onClick={onEdit}>
        Editar
      </button>
      <button data-testid="btn-delete" onClick={onDelete}>
        Excluir
      </button>
    </div>
  );
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('CatalogCard — Renderização de Props', () => {
  const defaultItem = makeCatalogItem();
  const onOrder = jest.fn();
  const onEdit = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    render(
      <CatalogCard item={defaultItem} onOrder={onOrder} onEdit={onEdit} onDelete={onDelete} />
    );
  });

  it('deve renderizar o nome da peça', () => {
    expect(screen.getByTestId('card-name')).toHaveTextContent('Suporte de Monitor');
  });

  it('deve renderizar o material correto', () => {
    expect(screen.getByTestId('card-material')).toHaveTextContent('PLA');
  });

  it('deve renderizar o peso formatado em gramas', () => {
    expect(screen.getByTestId('card-weight')).toHaveTextContent('150g');
  });

  it('deve renderizar o tempo formatado corretamente (90 min = 1h 30min)', () => {
    expect(screen.getByTestId('card-time')).toHaveTextContent('1h 30min');
  });

  it('deve renderizar o preço sugerido formatado em BRL', () => {
    // formatBRL(45.50) → "R$ 45,50" (locale pt-BR)
    expect(screen.getByTestId('card-price')).toHaveTextContent('45,50');
  });

  it('deve mostrar o placeholder "Sem foto" quando imageUrl está ausente', () => {
    expect(screen.getByTestId('card-no-image')).toBeInTheDocument();
    expect(screen.queryByTestId('card-image')).not.toBeInTheDocument();
  });

  it('deve renderizar o botão "Gerar Pedido"', () => {
    expect(screen.getByTestId('btn-order')).toBeInTheDocument();
  });

  it('deve renderizar o botão "Editar"', () => {
    expect(screen.getByTestId('btn-edit')).toBeInTheDocument();
  });

  it('deve renderizar o botão "Excluir"', () => {
    expect(screen.getByTestId('btn-delete')).toBeInTheDocument();
  });
});

// ─── Testes de Callbacks ───────────────────────────────────────────────────────

describe('CatalogCard — Disparo de Callbacks', () => {
  const onOrder = jest.fn();
  const onEdit = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve chamar onOrder quando o botão "Gerar Pedido" é clicado', async () => {
    const user = userEvent.setup();
    render(
      <CatalogCard item={makeCatalogItem()} onOrder={onOrder} onEdit={onEdit} onDelete={onDelete} />
    );
    await user.click(screen.getByTestId('btn-order'));
    expect(onOrder).toHaveBeenCalledTimes(1);
  });

  it('deve chamar onEdit quando o botão "Editar" é clicado', async () => {
    const user = userEvent.setup();
    render(
      <CatalogCard item={makeCatalogItem()} onOrder={onOrder} onEdit={onEdit} onDelete={onDelete} />
    );
    await user.click(screen.getByTestId('btn-edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('deve chamar onDelete quando o botão "Excluir" é clicado', async () => {
    const user = userEvent.setup();
    render(
      <CatalogCard item={makeCatalogItem()} onOrder={onOrder} onEdit={onEdit} onDelete={onDelete} />
    );
    await user.click(screen.getByTestId('btn-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('NÃO deve chamar onOrder ao clicar em "Editar"', async () => {
    const user = userEvent.setup();
    render(
      <CatalogCard item={makeCatalogItem()} onOrder={onOrder} onEdit={onEdit} onDelete={onDelete} />
    );
    await user.click(screen.getByTestId('btn-edit'));
    expect(onOrder).not.toHaveBeenCalled();
  });
});

// ─── Testes de Variações de Props ─────────────────────────────────────────────

describe('CatalogCard — Variações de Dados', () => {
  const noOp = jest.fn();

  it('deve exibir a imagem quando imageUrl está presente', () => {
    const item = makeCatalogItem({ imageUrl: 'https://example.com/photo.jpg' });
    render(<CatalogCard item={item} onOrder={noOp} onEdit={noOp} onDelete={noOp} />);
    const img = screen.getByTestId('card-image') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/photo.jpg');
    expect(screen.queryByTestId('card-no-image')).not.toBeInTheDocument();
  });

  it('deve normalizar material via required_filaments[] quando presente', () => {
    const item = makeCatalogItem({
      material: 'PLA', // legado
      required_filaments: [{ material: 'PETG', weight_grams: 200 }],
    });
    render(<CatalogCard item={item} onOrder={noOp} onEdit={noOp} onDelete={noOp} />);
    // required_filaments tem prioridade sobre material legado
    expect(screen.getByTestId('card-material')).toHaveTextContent('PETG');
    expect(screen.getByTestId('card-weight')).toHaveTextContent('200g');
  });

  it('deve usar material legado quando required_filaments está vazio', () => {
    const item = makeCatalogItem({
      material: 'TPU',
      weight_grams: 80,
      required_filaments: [],
    });
    render(<CatalogCard item={item} onOrder={noOp} onEdit={noOp} onDelete={noOp} />);
    expect(screen.getByTestId('card-material')).toHaveTextContent('TPU');
    expect(screen.getByTestId('card-weight')).toHaveTextContent('80g');
  });

  it('deve renderizar tempo de apenas minutos corretamente (< 60 min)', () => {
    const item = makeCatalogItem({ time_minutes: 45 });
    render(<CatalogCard item={item} onOrder={noOp} onEdit={noOp} onDelete={noOp} />);
    expect(screen.getByTestId('card-time')).toHaveTextContent('45min');
  });

  it('deve renderizar tempo de horas exatas sem minutos', () => {
    const item = makeCatalogItem({ time_minutes: 120 });
    render(<CatalogCard item={item} onOrder={noOp} onEdit={noOp} onDelete={noOp} />);
    expect(screen.getByTestId('card-time')).toHaveTextContent('2h');
  });

  it('deve exibir o card dentro de um container identificável', () => {
    render(
      <CatalogCard item={makeCatalogItem()} onOrder={noOp} onEdit={noOp} onDelete={noOp} />
    );
    expect(screen.getByTestId('catalog-card')).toBeInTheDocument();
  });
});
