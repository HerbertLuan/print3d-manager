"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
  Tag, 
  Plus,
  RefreshCw,
  Search,
  PackagePlus,
  Trash2,
  AlertCircle,
  ImageIcon,
  Edit2
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { ImageUpload } from "@/components/ui/image-upload";
import { getSupplies, addSupply, deleteSupply, updateSupply } from "@/lib/firestore";
import { Supply } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { uploadImage } from "@/lib/storage";

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formTotalPaid, setFormTotalPaid] = useState("");
  const [formImage, setFormImage] = useState<File | null>(null);

  // Edit State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);

  const loadSupplies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSupplies();
      setSupplies(data);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar insumos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSupplies(); }, [loadSupplies]);

  const filteredSupplies = useMemo(() => {
    return supplies.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [supplies, searchQuery]);

  function resetForm() {
    setFormName("");
    setFormQuantity("");
    setFormTotalPaid("");
    setFormImage(null);
    setSelectedSupply(null);
  }

  function openEdit(supply: Supply) {
    setSelectedSupply(supply);
    setFormName(supply.name);
    setFormQuantity(supply.quantity_in_stock.toString());
    setFormTotalPaid(supply.total_paid.toString()); // Não recalcula histórico, só info
    setFormImage(null);
    setEditDialogOpen(true);
  }

  async function handleSaveSupply() {
    if (!formName.trim() || !formQuantity || !formTotalPaid) return;
    
    const qty = parseInt(formQuantity);
    const paid = parseFloat(formTotalPaid);
    
    if (qty <= 0 || paid <= 0) return;

    setSaving(true);
    try {
      let imageUrl = selectedSupply?.imageUrl; // mantém a antiga se editando e sem nova
      if (formImage) {
        imageUrl = await uploadImage(formImage, `supplies/${Date.now()}_${formImage.name}`);
      }

      if (selectedSupply) {
         // Edição de estoque/nome
         await updateSupply(selectedSupply.id, {
            name: formName.trim(),
            quantity_in_stock: qty,
            ...(imageUrl && { imageUrl })
         });
         setEditDialogOpen(false);
      } else {
         // Criando novo
         await addSupply({
            name: formName.trim(),
            quantity_purchased: qty,
            quantity_in_stock: qty,
            total_paid: paid,
            unit_cost: paid / qty,
            ...(imageUrl && { imageUrl })
         });
         setAddDialogOpen(false);
      }
      
      resetForm();
      loadSupplies();
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar insumo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSupply(id: string) {
    try {
      await deleteSupply(id);
      setSupplies(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
      setError("Falha ao excluir insumo.");
    }
  }

  const { totalItems, totalValueInStock } = useMemo(() => {
    return supplies.reduce(
      (acc, s) => {
        acc.totalItems += Math.max(0, s.quantity_in_stock);
        acc.totalValueInStock += Math.max(0, s.quantity_in_stock) * s.unit_cost;
        return acc;
      },
      { totalItems: 0, totalValueInStock: 0 }
    );
  }, [supplies]);

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-purple-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Insumos</h1>
            </div>
            <p className="text-muted-foreground">Registre imãs, argolas, tags NFC e embalagens.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSupplies} disabled={loading} className="hidden sm:flex">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setAddDialogOpen(true); }}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cadastrar Insumo</span>
            </Button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground mb-1">Unidades em Estoque (Extras)</p>
              <h2 className="text-3xl font-bold">{totalItems}</h2>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground mb-1">Valor do Físico Atual</p>
              <h2 className="text-3xl font-bold text-purple-400">{formatBRL(totalValueInStock)}</h2>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar insumo..." 
              className="pl-9 w-full sm:max-w-md bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-3">
                 {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
              </div>
            ) : filteredSupplies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <PackagePlus className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-foreground mb-1">Nenhum insumo encontrado</h3>
                <p className="text-sm text-muted-foreground">Você ainda não cadastrou itens ou nenhum bateu com a busca.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="pl-6 w-[50px]"></TableHead>
                      <TableHead>Identificação</TableHead>
                      <TableHead className="text-center">Ainda no Estoque</TableHead>
                      <TableHead className="text-center">Custo Unitário</TableHead>
                      <TableHead className="text-right pr-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSupplies.map((supply) => (
                      <TableRow key={supply.id} className="border-border">
                        <TableCell className="pl-6">
                           {supply.imageUrl ? (
                               // eslint-disable-next-line @next/next/no-img-element
                               <img src={supply.imageUrl} alt={supply.name} className="w-8 h-8 rounded object-cover" />
                           ) : (
                               <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                  <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                               </div>
                           )}
                        </TableCell>
                        <TableCell className="font-medium">{supply.name}</TableCell>
                        <TableCell className="text-center tabular-nums">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            supply.quantity_in_stock <= Math.max(5, supply.quantity_purchased * 0.1) 
                              ? "bg-red-500/10 text-red-500" 
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}>
                            {Math.max(0, supply.quantity_in_stock)} unid.
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground tabular-nums font-mono text-xs">
                          {formatBRL(supply.unit_cost)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground" onClick={() => openEdit(supply)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" />}>
                                <Trash2 className="w-4 h-4" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>O insumo "{supply.name}" será excluído permanentemente.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSupply(supply.id)} className="bg-destructive hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <ResponsiveModal
        open={addDialogOpen || editDialogOpen}
        onOpenChange={(v) => { if(addDialogOpen) setAddDialogOpen(v); if(editDialogOpen) setEditDialogOpen(v); if (!v) resetForm(); }}
        title={selectedSupply ? "Editar Insumo" : "Cadastrar Insumo"}
        description={selectedSupply ? "Ajuste o estoque ou imagem do insumo." : "Adicione um pacote de argolas, imãs ou outro material complementar."}
      >
        <div className="space-y-4 py-2">
          
          <div className="space-y-2">
            <Label>Foto do Insumo (Opcional)</Label>
            <ImageUpload onImageSelected={setFormImage} />
            {selectedSupply?.imageUrl && !formImage && <p className="text-xs text-muted-foreground">Deixe em branco para manter a foto atual.</p>}
          </div>

          <div className="space-y-2">
            <Label>Nome do Item</Label>
            <Input 
              placeholder="Ex: Imã Neodímio 5x2mm Lote" 
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{selectedSupply ? "Estoque Atual" : "Quantidade (Lote)"}</Label>
              <Input 
                type="number" min={1} placeholder="Ex: 50" 
                value={formQuantity}
                onChange={(e) => setFormQuantity(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Total Pago (R$)</Label>
              <Input 
                type="number" step={0.01} min={0.1} placeholder="Ex: 25.00" 
                value={formTotalPaid}
                onChange={(e) => setFormTotalPaid(e.target.value)}
                disabled={!!selectedSupply} // Histórico de preço pre-existente
              />
            </div>
          </div>

          {!selectedSupply && formQuantity && formTotalPaid && parseFloat(formTotalPaid) > 0 && parseInt(formQuantity) > 0 && (
            <p className="text-xs text-right text-muted-foreground mr-1">
              Custo por item: <strong className="text-foreground">{formatBRL(parseFloat(formTotalPaid) / parseInt(formQuantity))}</strong>
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setAddDialogOpen(false); setEditDialogOpen(false); }} disabled={saving}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSaveSupply} disabled={!formName.trim() || !formQuantity || !formTotalPaid || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

    </div>
  );
}
