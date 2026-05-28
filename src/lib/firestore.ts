import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  runTransaction,
  where,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteImageFromUrl } from "./storage";
import {
  CatalogItem, NewCatalogItem,
  Order, NewOrder,
  StoreOrder,
  InventoryItem, NewInventoryItem,
  Supply, NewSupply,
  Expense, NewExpense, ExpenseCategory, NewExpenseCategory,
  Filament, NewFilament,
  Collection, NewCollection,
  Coupon, NewCoupon,
  StoreSettings,
  Partner, NewPartner,
} from "./types";

// =====================================================
// CATALOG OPERATIONS
// =====================================================

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const q = query(collection(db, "catalog"), orderBy("created_at", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CatalogItem[];
}

/**
 * Busca apenas itens marcados para a loja pública (showInStore === true).
 * Ordenação em memória: destaques primeiro, depois por data decrescente.
 * (Evita criar índice composto no Firestore)
 */
export async function getStoreItems(): Promise<CatalogItem[]> {
  const q = query(
    collection(db, "catalog"),
    where("showInStore", "==", true)
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CatalogItem[];

  // Ordenação: destaques primeiro, depois mais recentes
  return items.sort((a, b) => {
    if (a.destaque && !b.destaque) return -1;
    if (!a.destaque && b.destaque) return 1;
    const timeA = a.created_at?.seconds ?? 0;
    const timeB = b.created_at?.seconds ?? 0;
    return timeB - timeA;
  });
}

export async function addCatalogItem(
  item: Omit<NewCatalogItem, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "catalog"), {
    ...item,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCatalogItem(
  id: string,
  data: Partial<Omit<CatalogItem, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "catalog", id), data);
}

// =====================================================
// INVENTORY OPERATIONS (peças impressas)
// =====================================================

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const q = query(collection(db, "inventory"), orderBy("created_at", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as InventoryItem[];
}

export async function addInventoryItem(
  item: Omit<NewInventoryItem, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "inventory"), {
    ...item,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function consumeFromInventory(
  inventoryId: string,
  quantityToConsume: number
): Promise<void> {
  const inventoryRef = doc(db, "inventory", inventoryId);

  await runTransaction(db, async (transaction) => {
    const defaultInventoryDoc = await transaction.get(inventoryRef);
    if (!defaultInventoryDoc.exists()) {
      throw new Error("Item de estoque não encontrado!");
    }

    const newQuantity = defaultInventoryDoc.data().quantity_available - quantityToConsume;
    if (newQuantity < 0) {
      throw new Error("Estoque insuficiente para esta transação.");
    }

    transaction.update(inventoryRef, { quantity_available: newQuantity });
  });
}

// =====================================================
// SUPPLY OPERATIONS (insumos não impressos)
// =====================================================

export async function getSupplies(): Promise<Supply[]> {
  const q = query(collection(db, "supplies"), orderBy("created_at", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Supply[];
}

export async function addSupply(
  item: Omit<NewSupply, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "supplies"), {
    ...item,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSupply(
  id: string,
  data: Partial<Omit<Supply, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "supplies", id), data);
}

export async function deleteSupply(id: string): Promise<void> {
  await deleteDoc(doc(db, "supplies", id));
}

// =====================================================
// EXPENSE OPERATIONS
// =====================================================

export async function getExpenses(): Promise<Expense[]> {
  const q = query(collection(db, "expenses"), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Expense[];
}

export async function getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
  // month is 1-indexed; create date range strings
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const q = query(
    collection(db, "expenses"),
    where("date", ">=", from),
    where("date", "<", to),
    orderBy("date", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Expense[];
}

export async function addExpense(
  expense: Omit<NewExpense, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "expenses"), {
    ...expense,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
}

export async function updateExpense(
  id: string,
  data: Partial<Omit<Expense, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "expenses", id), data);
}

// =====================================================
// EXPENSE CATEGORY OPERATIONS
// =====================================================

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const q = query(collection(db, "expense_categories"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ExpenseCategory[];
}

export async function addExpenseCategory(
  category: Omit<NewExpenseCategory, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "expense_categories"), {
    ...category,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateExpenseCategory(
  id: string,
  data: Partial<Omit<ExpenseCategory, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "expense_categories", id), data);
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, "expense_categories", id));
}

// =====================================================
// ORDER OPERATIONS
// =====================================================

export async function getOrders(): Promise<Order[]> {
  const q = query(collection(db, "orders"), orderBy("created_at", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Order[];
}

export async function getOrdersByMonth(year: number, month: number): Promise<Order[]> {
  // Filter by created_at within the month using Timestamp range
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const q = query(
    collection(db, "orders"),
    where("created_at", ">=", Timestamp.fromDate(startDate)),
    where("created_at", "<", Timestamp.fromDate(endDate)),
    orderBy("created_at", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
}

export async function addOrder(
  order: Omit<NewOrder, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "orders"), {
    ...order,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Cria um pedido originado na vitrine pública (cliente anônimo).
 * Força origem='site' e production_status='pending_approval'.
 * Configure as Security Rules do Firestore para validar esses campos.
 */
export async function createStoreOrder(order: StoreOrder): Promise<string> {
  const docRef = await addDoc(collection(db, "orders"), {
    ...order,
    origem: "site",
    production_status: "pending_approval",
    payment_status: "Pendente",
    created_at: serverTimestamp(),
  });
  return docRef.id;
}


export async function updateOrder(
  id: string,
  data: Partial<Omit<Order, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "orders", id), data);
}

export async function updateOrderPaymentStatus(
  orderId: string,
  status: string,
  paidAt?: string
): Promise<void> {
  const updateData: any = { payment_status: status };
  if (status === "Pago") {
    // Usa a data fornecida ou a data local atual (YYYY-MM-DD)
    const todayStr = new Date().toLocaleDateString("en-CA"); // formato YYYY-MM-DD
    updateData.paid_at = paidAt || todayStr;
  } else {
    updateData.paid_at = null; // remove a data de pagamento
  }
  await updateDoc(doc(db, "orders", orderId), updateData);
}

export async function updateOrderInventoryAssignment(
  orderId: string,
  assigned: boolean
): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), {
    assigned_from_inventory: assigned,
  });
}

export async function updateOrderProductionStatus(
  orderId: string,
  status: string
): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), {
    production_status: status,
  });
}

// =====================================================
// DELETION OPERATIONS
// =====================================================

export async function deleteCatalogItem(
  catalogId: string,
  imageUrl?: string
): Promise<void> {
  if (imageUrl) {
    await deleteImageFromUrl(imageUrl);
  }
  await deleteDoc(doc(db, "catalog", catalogId));
}

export async function deleteOrder(order: Order): Promise<void> {
  // Rollback de inventário se necessário
  if (order.assigned_from_inventory && order.quantity) {
    const q = query(
      collection(db, "inventory"),
      where("catalog_item_id", "==", order.catalog_item_id),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const invDoc = snapshot.docs[0];
      const currentQty = invDoc.data().quantity_available;
      await updateDoc(doc(db, "inventory", invDoc.id), {
        quantity_available: currentQty + order.quantity
      });
    } else {
      await addDoc(collection(db, "inventory"), {
        catalog_item_id: order.catalog_item_id,
        catalog_item_name: order.piece_name,
        material: order.material,
        quantity_available: order.quantity,
        total_cost: 0,
        total_price: order.price,
        created_at: serverTimestamp()
      });
    }
  }

  await deleteDoc(doc(db, "orders", order.id));
}

// =====================================================
// FILAMENT OPERATIONS
// =====================================================

export async function getFilaments(): Promise<Filament[]> {
  const q = query(collection(db, "filaments"), orderBy("created_at", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Filament[];
}

export async function addFilament(
  filament: Omit<NewFilament, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "filaments"), {
    ...filament,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateFilament(
  id: string,
  data: Partial<Omit<Filament, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "filaments", id), data);
}

export async function deleteFilament(id: string): Promise<void> {
  await deleteDoc(doc(db, "filaments", id));
}

export async function consumeFilamentsTransaction(
  uses: { filament_id: string; weight_grams: number }[]
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    // Primeiro lemos todos
    const docsToUpdate = [];
    for (const use of uses) {
      if (use.weight_grams <= 0) continue;
      const fRef = doc(db, "filaments", use.filament_id);
      const fSnap = await transaction.get(fRef);
      if (fSnap.exists()) {
        docsToUpdate.push({
          ref: fRef,
          newWeight: (fSnap.data().consumed_weight_grams || 0) + use.weight_grams
        });
      }
    }
    
    // Depois escrevemos todos
    for (const update of docsToUpdate) {
      transaction.update(update.ref, { consumed_weight_grams: update.newWeight });
    }
  });
}

// =====================================================
// COLLECTION OPERATIONS (Categorias)
// =====================================================

/** Busca todas as coleções, ordenadas por `ordem` asc. */
export async function getCollections(): Promise<Collection[]> {
  const q = query(collection(db, "collections"), orderBy("ordem", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Collection[];
}

/** Busca apenas coleções ativas (usada pela vitrine pública). */
export async function getActiveCollections(): Promise<Collection[]> {
  // Usamos apenas o where() sem orderBy() para evitar a criação obrigatória de um
  // índice composto (ativo + ordem) no Firestore. Ordenamos em memória.
  const q = query(
    collection(db, "collections"),
    where("ativo", "==", true)
  );
  const snapshot = await getDocs(q);
  const cols = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Collection[];
  return cols.sort((a, b) => a.ordem - b.ordem);
}

export async function addCollection(
  data: Omit<NewCollection, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "collections"), {
    ...data,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCollection(
  id: string,
  data: Partial<Omit<Collection, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "collections", id), data);
}

export async function deleteCollection(id: string): Promise<void> {
  await deleteDoc(doc(db, "collections", id));
}

// =====================================================
// COUPON OPERATIONS
// =====================================================


export async function getCoupons(): Promise<Coupon[]> {
  const q = query(collection(db, "coupons"), orderBy("created_at", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Coupon[];
}

/**
 * Busca um cupom pelo código (case-insensitive no input, armazenado em uppercase).
 * Retorna null se não encontrado.
 */
export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const q = query(
    collection(db, "coupons"),
    where("code", "==", code.toUpperCase().trim()),
    where("active", "==", true),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Coupon;
}

export async function addCoupon(
  coupon: Omit<NewCoupon, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "coupons"), {
    ...coupon,
    code: coupon.code.toUpperCase().trim(),
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCoupon(
  id: string,
  data: Partial<Omit<Coupon, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "coupons", id), data);
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db, "coupons", id));
}

// =====================================================
// STORE SETTINGS OPERATIONS
// Documento único: settings/promotions
// =====================================================

const SETTINGS_DOC = doc(db, "settings", "promotions");

export async function getStoreSettings(): Promise<StoreSettings> {
  const snap = await getDoc(SETTINGS_DOC);
  if (snap.exists()) return snap.data() as StoreSettings;
  // Valor padrão se o documento ainda não existir
  return { gift_threshold: 150 };
}

export async function updateStoreSettings(
  data: Partial<StoreSettings>
): Promise<void> {
  await setDoc(SETTINGS_DOC, data, { merge: true });
}

// =====================================================
// PARTNER OPERATIONS (Sistema de Parceiros)
// =====================================================

export async function getPartners(): Promise<Partner[]> {
  const q = query(collection(db, "partners"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Partner[];
}

export async function getActivePartners(): Promise<Partner[]> {
  // Não usa orderBy junto com where para evitar exigência de índice composto no Firestore.
  // Filtragem e ordenação feitas em memória.
  const snapshot = await getDocs(collection(db, "partners"));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Partner)
    .filter((p) => p.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getPartnerByEmail(email: string): Promise<Partner | null> {
  const q = query(
    collection(db, "partners"),
    where("email", "==", email.toLowerCase().trim()),
    where("active", "==", true),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Partner;
}

export async function addPartner(
  partner: Omit<NewPartner, "created_at">
): Promise<string> {
  const docRef = await addDoc(collection(db, "partners"), {
    ...partner,
    email: partner.email.toLowerCase().trim(),
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePartner(
  id: string,
  data: Partial<Omit<Partner, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "partners", id), data);
}

export async function deletePartner(id: string): Promise<void> {
  await deleteDoc(doc(db, "partners", id));
}

/**
 * Busca todos os pedidos vinculados a um parceiro específico.
 * Filtra por partner_id usando a query do Firestore.
 */
export async function getOrdersByPartner(partnerId: string): Promise<Order[]> {
  // Evita índice composto (where + orderBy) — filtra e ordena em memória.
  const q = query(
    collection(db, "orders"),
    where("partner_id", "==", partnerId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Order)
    .sort((a, b) => {
      const ta = a.created_at?.toMillis?.() ?? 0;
      const tb = b.created_at?.toMillis?.() ?? 0;
      return tb - ta; // desc
    });
}

/**
 * Busca pedidos de um parceiro dentro de um mês específico.
 * Usado pelo portal do parceiro para o resumo mensal.
 */
export async function getOrdersByPartnerAndMonth(
  partnerId: string,
  year: number,
  month: number
): Promise<Order[]> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  // Evita índice composto — filtra as datas em memória após buscar por partner_id.
  const q = query(
    collection(db, "orders"),
    where("partner_id", "==", partnerId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Order)
    .filter((o) => {
      const d = o.created_at?.toDate?.();
      if (!d) return false;
      return d >= startDate && d < endDate;
    })
    .sort((a, b) => {
      const ta = a.created_at?.toMillis?.() ?? 0;
      const tb = b.created_at?.toMillis?.() ?? 0;
      return tb - ta; // desc
    });
}

/**
 * Marca a comissão de um pedido como paga (ou pendente).
 */
export async function updatePartnerCommissionStatus(
  orderId: string,
  paid: boolean
): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), {
    partner_commission_paid: paid,
  });
}
