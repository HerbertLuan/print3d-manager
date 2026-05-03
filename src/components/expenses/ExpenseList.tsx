"use client";

import { Edit, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Expense } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";

interface ExpenseListProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDeleteClick: (expense: Expense) => void;
  onPaymentToggle: (expense: Expense) => void;
  totalMonthly: number;
}

export function ExpenseList({ expenses, onEdit, onDeleteClick, onPaymentToggle, totalMonthly }: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-8">
        <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="font-semibold text-foreground mb-1">Nenhuma despesa neste período</h3>
        <p className="text-sm text-muted-foreground">
          Clique em <strong>Lançar Despesa</strong> para registrar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="pl-6">Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right pr-6">Valor</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id} className="border-border">
              <TableCell className="pl-6 font-medium">
                {expense.description}
                {expense.tipo_cobranca === "Parcelada" && expense.parcelas && (
                  <span className="ml-2 text-xs text-muted-foreground">({expense.parcelas})</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-muted-foreground bg-white/5 font-normal">
                  {expense.categoria || "Outros"}
                </Badge>
              </TableCell>
              <TableCell>
                {expense.tipo_cobranca === "Fixa Mensal" && (
                  <Badge variant="secondary" className="font-normal text-xs">Fixa</Badge>
                )}
                {expense.tipo_cobranca === "Parcelada" && (
                  <Badge variant="outline" className="font-normal text-xs border-orange-500/30 text-orange-400">Parcelada</Badge>
                )}
                {(!expense.tipo_cobranca || expense.tipo_cobranca === "Única") && (
                  <span className="text-xs text-muted-foreground">Única</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums text-sm">
                {new Date(expense.date + "T00:00:00").toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 px-2 text-[10px] border ${
                    expense.status === "Pendente" 
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  } hover:opacity-80`}
                  onClick={() => onPaymentToggle(expense)}
                >
                  {expense.status || "Pago"}
                </Button>
              </TableCell>
              <TableCell className="text-right pr-6 font-semibold text-red-400 tabular-nums">
                {formatBRL(expense.value)}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(expense)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteClick(expense)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end items-center px-6 py-4 border-t border-border bg-white/5">
        <span className="text-sm font-semibold text-muted-foreground mr-4">Total do Período:</span>
        <span className="text-lg font-bold text-red-400 tabular-nums">{formatBRL(totalMonthly)}</span>
      </div>
    </div>
  );
}
