"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import {
  getExpenseCategories,
  addExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "@/lib/firestore";
import { ExpenseCategory } from "@/lib/types";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesChange: () => void;
}

export function ManageCategoriesModal({ open, onOpenChange, onCategoriesChange }: ManageCategoriesModalProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (open) {
      loadCategories();
    } else {
      setNewCategoryName("");
      setEditingId(null);
      setError(null);
    }
  }, [open]);

  async function loadCategories() {
    setLoading(true);
    try {
      const data = await getExpenseCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newCategoryName.trim()) return;
    setAdding(true);
    try {
      await addExpenseCategory({ name: newCategoryName.trim() });
      setNewCategoryName("");
      await loadCategories();
      onCategoriesChange();
      toast.success("Categoria adicionada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar categoria.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateExpenseCategory(id, { name: editName.trim() });
      setEditingId(null);
      await loadCategories();
      onCategoriesChange();
      toast.success("Categoria atualizada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar categoria.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    try {
      await deleteExpenseCategory(id);
      await loadCategories();
      onCategoriesChange();
      toast.success("Categoria excluída!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir categoria.");
    }
  }

  function startEdit(cat: ExpenseCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Gerenciar Categorias"
      description="Crie, edite ou exclua categorias de despesas."
    >
      <div className="space-y-4 py-2">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="Nova categoria..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={!newCategoryName.trim() || adding}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="border border-border rounded-lg bg-white/5 mt-4 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : categories.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma categoria encontrada.</div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="divide-y divide-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <Input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(cat.id)}
                          className="h-8"
                        />
                        <Button size="sm" onClick={() => handleSaveEdit(cat.id)} disabled={savingEdit}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-sm">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(cat)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(cat.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
