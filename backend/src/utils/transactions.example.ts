/**
 * EJEMPLOS DE USO DE TRANSACCIONES MONGODB
 * 
 * Este archivo contiene ejemplos de cómo usar las transacciones en el backend.
 * NO es código de producción, solo documentación viva.
 */

import { ClientSession } from 'mongoose';
import { withTransaction, withTransactionRetry, runInParallel } from './transactions';
import { OrderRepository, ItemOrderRepository, PaymentRepository } from '../repositories';

const orderRepo = new OrderRepository();
const itemOrderRepo = new ItemOrderRepository();
const paymentRepo = new PaymentRepository();

// ============================================================================
// EJEMPLO 1: Transacción simple - Crear orden con items
// ============================================================================
async function ejemploTransaccionSimple() {
  const result = await withTransaction(async (session) => {
    // Crear la orden
    const order = await orderRepo.createOrder('session-123', 'staff-456', undefined, session);
    
    // Crear items de la orden
    const item1 = await itemOrderRepo.createItem({
      order_id: order._id.toString(),
      session_id: 'session-123',
      item_dish_id: 'dish-789',
      item_disher_type: 'KITCHEN',
      item_name_snapshot: [{ lang: 'es', value: 'Hamburguesa' }],
      item_base_price: 15.99,
      item_disher_extras: [],
    }, session);
    
    const item2 = await itemOrderRepo.createItem({
      order_id: order._id.toString(),
      session_id: 'session-123',
      item_dish_id: 'dish-999',
      item_disher_type: 'SERVICE',
      item_name_snapshot: [{ lang: 'es', value: 'Coca Cola' }],
      item_base_price: 3.50,
      item_disher_extras: [],
    }, session);
    
    // Si cualquiera de las operaciones falla, TODO se revierte
    return { order, items: [item1, item2] };
  });
  
  console.log('Orden creada:', result.order._id);
}

// ============================================================================
// EJEMPLO 2: Transacción con reintentos - Operaciones críticas de pago
// ============================================================================
async function ejemploTransaccionConReintentos() {
  // Las operaciones de pago usan withTransactionRetry para manejar
  // conflictos de escritura transitorios automáticamente
  const result = await withTransactionRetry(async (session: ClientSession) => {
    // Crear el pago
    const payment = await paymentRepo.createPayment({
      session_id: 'session-123',
      payment_type: 'ALL',
      payment_total: 50.00,
      tickets: [{
        ticket_part: 1,
        ticket_total_parts: 1,
        ticket_amount: 50.00,
        paid: true,
      }],
    }, session);
    
    // Actualizar estado de la sesión a PAID
    // await totemSessionRepo.updateState('session-123', 'PAID', session);
    
    return payment;
  }, 
  3,      // Máximo 3 reintentos
  100     // 100ms de delay entre reintentos
  );
  
  console.log('Pago procesado:', result._id);
}

// ============================================================================
// EJEMPLO 3: Operaciones paralelas dentro de una transacción
// ============================================================================
async function ejemploOperacionesParalelas() {
  const result = await withTransaction(async (session) => {
    // Ejecutar múltiples operaciones en paralelo dentro de la misma transacción
    const [order, items, payment] = await runInParallel(session, [
      // Crear orden
      (s) => orderRepo.createOrder('session-123', undefined, undefined, s),
      // Crear múltiples items
      (s) => itemOrderRepo.createItem({
        order_id: 'order-123',
        session_id: 'session-123',
        item_dish_id: 'dish-789',
        item_disher_type: 'KITCHEN',
        item_name_snapshot: [{ lang: 'es', value: 'Plato' }],
        item_base_price: 10.00,
        item_disher_extras: [],
      }, s),
      // Crear pago
      (s) => paymentRepo.createPayment({
        session_id: 'session-123',
        payment_type: 'ALL',
        payment_total: 10.00,
        tickets: [],
      }, s),
    ]);
    
    return { order, items, payment };
  });
  
  console.log('Operaciones completadas:', result);
}

// ============================================================================
// EJEMPLO 4: Manejo de errores y rollback automático
// ============================================================================
async function ejemploManejoErrores() {
  try {
    await withTransaction(async (session) => {
      // Paso 1: Crear orden (éxito)
      const order = await orderRepo.createOrder('session-123', undefined, undefined, session);
      
      // Paso 2: Crear item (éxito)
      await itemOrderRepo.createItem({
        order_id: order._id.toString(),
        session_id: 'session-123',
        item_dish_id: 'dish-789',
        item_disher_type: 'KITCHEN',
        item_name_snapshot: [{ lang: 'es', value: 'Plato' }],
        item_base_price: 10.00,
        item_disher_extras: [],
      }, session);
      
      // Paso 3: Esta operación falla (por ejemplo, dish no existe)
      // El error se propaga y la transacción se aborta automáticamente
      // La orden y el item creados se revierten (no quedan en la BD)
      throw new Error('DISH_NOT_FOUND');
    });
  } catch (error) {
    // La transacción fue abortada, no hay datos inconsistentes
    console.error('Error capturado, transacción revertida:', error);
  }
}

// ============================================================================
// EJEMPLO 5: Patrón de uso en servicios existentes
// ============================================================================

// En order.service.ts - createOrder con transacción
async function createOrderConTransaccion(sessionId: string, staffId?: string) {
  return withTransaction(async (session) => {
    // Validar sesión
    // const totemSession = await totemSessionRepo.findById(sessionId);
    // if (!totemSession || totemSession.totem_state !== 'STARTED') {
    //   throw new Error('SESSION_NOT_ACTIVE');
    // }
    
    // Crear orden dentro de la transacción
    return orderRepo.createOrder(sessionId, staffId, undefined, session);
  });
}

// En order.service.ts - addItemToOrder con transacción
async function addItemConTransaccion(orderId: string, dishId: string) {
  return withTransaction(async (session) => {
    // Validar orden
    const order = await orderRepo.findById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    
    // Validar dish y crear item atómicamente
    // ...
    
    return itemOrderRepo.createItem({
      order_id: orderId,
      session_id: 'session-id',
      item_dish_id: dishId,
      item_disher_type: 'KITCHEN',
      item_name_snapshot: [],
      item_base_price: 0,
      item_disher_extras: [],
    }, session);
  });
}

// ============================================================================
// EJEMPLO 6: Procesar pago con actualización atómica
// ============================================================================
async function processPaymentAtomico(paymentId: string, ticketPart: number) {
  return withTransactionRetry(async (session: ClientSession) => {
    // Marcar ticket como pagado
    const updated = await paymentRepo.markTicketPaid(paymentId, ticketPart, session);
    if (!updated) throw new Error('TICKET_NOT_FOUND');
    
    // Verificar si todos los tickets están pagados
    const allPaid = updated.tickets.every((t) => t.paid);
    
    if (allPaid) {
      // Actualizar estado de la sesión a PAID
      // await totemSessionRepo.updateState(sessionId, 'PAID', session);
      
      // Emitir eventos de socket
      // emitSessionFullyPaid(sessionId, { ... });
    }
    
    return updated;
  }, 3, 100);
}

// Exportar ejemplos para documentación
export const ejemplosTransacciones = {
  ejemploTransaccionSimple,
  ejemploTransaccionConReintentos,
  ejemploOperacionesParalelas,
  ejemploManejoErrores,
  createOrderConTransaccion,
  addItemConTransaccion,
  processPaymentAtomico,
};
