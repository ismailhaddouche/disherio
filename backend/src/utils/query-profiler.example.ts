/**
 * EJEMPLOS DE USO DEL QUERY PROFILER Y AGGREGATIONS OPTIMIZADAS
 * 
 * Este archivo contiene ejemplos de cómo usar las optimizaciones
 * de MongoDB aggregation pipelines en el backend.
 */

import { QueryProfiler, analyzeIndexUsage } from './query-profiler';
import {
  OrderRepository,
  ItemOrderRepository,
  PaymentRepository,
  DishRepository,
} from '../repositories';
import { logger } from '../config/logger';

const orderRepo = new OrderRepository();
const itemOrderRepo = new ItemOrderRepository();
const paymentRepo = new PaymentRepository();
const dishRepo = new DishRepository();

// ============================================================================
// EJEMPLO 1: Obtener órdenes con items usando aggregation
// ============================================================================
async function ejemploOrdersWithItems() {
  const sessionId = 'session-123';

  // Usa aggregation pipeline en lugar de múltiples queries
  const orders = await orderRepo.getOrdersWithItems(sessionId, {
    includeCancelled: false,
    limit: 50,
    skip: 0,
  });

  // Cada orden incluye sus items populados con dish info
  for (const order of orders) {
    logger.info({
      orderId: order._id,
      itemCount: order.items.length,
      total: order.items.reduce((sum, item) => 
        sum + item.item_base_price + (item.item_disher_variant?.price ?? 0), 0
      ),
    }, 'Orden con items');
  }
}

// ============================================================================
// EJEMPLO 2: Dashboard metrics con una sola query
// ============================================================================
async function ejemploDailyMetrics() {
  const sessionIds = ['session-1', 'session-2', 'session-3'];
  const today = new Date();

  // Una sola aggregation obtiene todas las métricas
  const metrics = await orderRepo.getDailyMetrics(sessionIds, today);

  logger.info({
    totalRevenue: metrics.totalRevenue,
    orderCount: metrics.orderCount,
    averageOrderValue: metrics.averageOrderValue,
    itemCount: metrics.itemCount,
  }, 'Métricas del día');
}

// ============================================================================
// EJEMPLO 3: Reporte KDS - Items pendientes por estación
// ============================================================================
async function ejemploKDSReport() {
  const sessionIds = ['session-1', 'session-2'];

  // Agrupa items pendientes por estación (KITCHEN/SERVICE)
  const itemsByStation = await itemOrderRepo.getPendingItemsByStation(sessionIds, {
    includeService: true,
  });

  for (const station of itemsByStation) {
    logger.info({
      station: station._id,
      pendingCount: station.count,
      averageWaitTime: (station as any).averageWaitTime,
      items: station.items.map((item: any) => ({
        name: item.item_name_snapshot?.[0]?.value,
        waitTime: item.waitTimeMinutes,
      })),
    }, 'Items por estación');
  }
}

// ============================================================================
// EJEMPLO 4: KDS Items con detalles enriquecidos
// ============================================================================
async function ejemploKDSItemsRich() {
  const sessionIds = ['session-1', 'session-2'];

  // Obtiene items con información de orden, totem y tiempos de espera
  const items = await itemOrderRepo.getKDSItemsWithDetails(sessionIds, {
    states: ['ORDERED', 'ON_PREPARE'],
    types: ['KITCHEN'],
    sortBy: 'waitTime',
    sortOrder: 'desc', // Prioriza items con mayor tiempo de espera
  });

  for (const item of items) {
    logger.info({
      itemName: item.item_name_snapshot?.[0]?.value,
      totemName: (item as any).totem_name,
      waitTimeMinutes: (item as any).waitTimeMinutes,
      state: item.item_state,
    }, 'Item KDS');
  }
}

// ============================================================================
// EJEMPLO 5: Estadísticas de ventas por plato
// ============================================================================
async function ejemploSalesByDish() {
  const dishIds = ['dish-1', 'dish-2', 'dish-3'];
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  // Obtiene ventas con revenue calculado
  const sales = await itemOrderRepo.getSalesByDish(dishIds, {
    from: lastWeek,
    to: new Date(),
  });

  for (const sale of sales) {
    logger.info({
      dishId: sale.dishId,
      dishName: sale.dishName,
      quantity: sale.quantity,
      revenue: sale.revenue,
    }, 'Ventas por plato');
  }
}

// ============================================================================
// EJEMPLO 6: Platos populares para dashboard
// ============================================================================
async function ejemploPopularDishes() {
  const restaurantId = 'restaurant-123';

  const popularDishes = await dishRepo.getPopularDishes(restaurantId, {
    limit: 5,
    dateRange: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Última semana
      to: new Date(),
    },
    type: 'KITCHEN', // Solo platos de cocina
  });

  logger.info({
    topDishes: popularDishes.map(d => ({
      name: d.dishName,
      ordered: d.totalOrdered,
      revenue: d.totalRevenue,
      trend: d.trend,
    })),
  }, 'Platos populares');
}

// ============================================================================
// EJEMPLO 7: Uso del Query Profiler
// ============================================================================
async function ejemploQueryProfiler() {
  // Profile una query existente
  await QueryProfiler.profileQuery(
    dishRepo.getModel(),
    () => dishRepo.findById('dish-123'),
    'FindDishById',
    { logLevel: 'debug' }
  );

  // Obtener estadísticas de queries
  const stats = QueryProfiler.getStats();
  logger.info({ stats }, 'Estadísticas de queries');

  // Obtener queries lentas (> 100ms)
  const slowQueries = QueryProfiler.getSlowQueries(100);
  if (slowQueries.length > 0) {
    logger.warn({ slowQueries }, 'Queries lentos detectados');
  }
}

// ============================================================================
// EJEMPLO 8: Análisis de uso de índices
// ============================================================================
async function ejemploExplainQuery() {
  const pipeline = [
    { $match: { session_id: 'session-123' } },
    { $sort: { order_date: -1 as const } },
    { $limit: 10 },
  ];

  // Obtener plan de ejecución
  const explainResult = await QueryProfiler.explainAggregation(
    orderRepo.getModel(),
    pipeline,
    'executionStats'
  );

  // Analizar uso de índices
  const analysis = analyzeIndexUsage(explainResult);
  logger.info({
    usesIndex: analysis.usesIndex,
    indexName: analysis.indexName,
    docsExamined: analysis.docsExamined,
    docsReturned: analysis.docsReturned,
    efficiency: analysis.efficiency,
  }, 'Análisis de índice');

  // Si no usa índice o es ineficiente, considerar crear uno
  if (!analysis.usesIndex || analysis.efficiency > 10) {
    logger.warn('Query no optimizada - considerar agregar índice');
  }
}

// ============================================================================
// EJEMPLO 9: Payment stats con aggregation
// ============================================================================
async function ejemploPaymentStats() {
  const sessionIds = ['session-1', 'session-2'];

  const stats = await paymentRepo.getPaymentStats(sessionIds, {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Último mes
    to: new Date(),
  });

  logger.info({
    totalRevenue: stats.totalRevenue,
    totalTransactions: stats.totalTransactions,
    averageTicket: stats.averageTicket,
    paidTickets: stats.paidTickets,
    pendingTickets: stats.pendingTickets,
  }, 'Estadísticas de pago');
}

// ============================================================================
// EJEMPLO 10: Bulk operations optimizadas
// ============================================================================
async function ejemploBulkUpdate() {
  const itemIds = ['item-1', 'item-2', 'item-3'];

  // Actualiza múltiples items en una sola operación
  const result = await itemOrderRepo.bulkUpdateState(itemIds, 'SERVED');

  logger.info({ modifiedCount: result.modifiedCount }, 'Items actualizados');
}

// ============================================================================
// EJEMPLO 11: Búsqueda de platos con text index
// ============================================================================
async function ejemploBusquedaPlatos() {
  const restaurantId = 'restaurant-123';
  const searchTerm = 'hamburguesa';

  const dishes = await dishRepo.searchDishes(restaurantId, searchTerm, {
    limit: 10,
    onlyActive: true,
  });

  logger.info({
    searchTerm,
    results: dishes.length,
    dishes: dishes.map(d => d.disher_name?.[0]?.value),
  }, 'Búsqueda de platos');
}

// ============================================================================
// EJEMPLO 12: Categorías con conteos
// ============================================================================
async function ejemploCategoriesWithCounts() {
  const { CategoryRepository } = await import('../repositories/dish.repository');
  const categoryRepo = new CategoryRepository();

  const categories = await categoryRepo.getCategoriesWithCounts('restaurant-123');

  for (const cat of categories) {
    logger.info({
      name: cat.category_name?.[0]?.value,
      totalDishes: (cat as any).dishCount,
      activeDishes: (cat as any).activeDishCount,
    }, 'Categoría');
  }
}

// ============================================================================
// EJEMPLO 13: Decorador @ProfileQuery para métodos de repositorio
// ============================================================================
// class EjemploRepository {
//   @ProfileQuery('CustomOperation')
//   async expensiveOperation() {
//     // Este método será automáticamente perfilado
//   }
// }

// ============================================================================
// MEJORES PRÁCTICAS
// ============================================================================
/**
 * 1. USAR AGGREGATIONS PARA:
 *    - Joins entre colecciones ($lookup)
 *    - Cálculos agregados (sum, avg, count)
 *    - Agrupaciones complejas ($group)
 *    - Filtros en arrays ($unwind + $match)
 * 
 * 2. ÍNDICES NECESARIOS:
 *    - session_id + order_date para queries de sesión
 *    - item_dish_id + createdAt para estadísticas
 *    - item_state + item_disher_type para KDS
 *    - Text index en disher_name.value para búsqueda
 * 
 * 3. EVITAR:
 *    - N+1 queries (usar $lookup)
 *    - populate() en loops
 *    - Cálculos en JavaScript que pueden hacerse en MongoDB
 * 
 * 4. MONITOREAR:
 *    - QueryProfiler.getSlowQueries() en producción
 *    - executionStats con explain() periódicamente
 */

// Exportar ejemplos para documentación
export const ejemplosOptimizaciones = {
  ejemploOrdersWithItems,
  ejemploDailyMetrics,
  ejemploKDSReport,
  ejemploKDSItemsRich,
  ejemploSalesByDish,
  ejemploPopularDishes,
  ejemploQueryProfiler,
  ejemploExplainQuery,
  ejemploPaymentStats,
  ejemploBulkUpdate,
  ejemploBusquedaPlatos,
  ejemploCategoriesWithCounts,
};
