import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  runTransaction,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteImageFromUrl } from "./storage";
import {
  CatalogItem, NewCatalogItem,
  Order, NewOrder,
  InventoryItem, NewInventoryItem,
  Supply, NewSupply,
  Expense, NewExpense,
  Filament, NewFilament,
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

export async function updateOrder(
  id: string,
  data: Partial<Omit<Order, "id" | "created_at">>
): Promise<void> {
  await updateDoc(doc(db, "orders", id), data);
}

export async function updateOrderPaymentStatus(
  orderId: string,
  status: string
): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), {
    payment_status: status,
  });
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
