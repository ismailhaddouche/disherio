/**
 * Utilidades para cálculos fiscales de IVA y bases imponibles
 */

/**
 * Calcula el IVA a partir de un subtotal (base imponible)
 * @param {number} subtotal 
 * @param {number} ivaPorcentaje 
 * @returns {Object} { subtotal, iva, total, ivaPorcentaje }
 */
const calcularIVA = (subtotal, ivaPorcentaje = 21) => {
    const iva = subtotal * (ivaPorcentaje / 100);
    const total = subtotal + iva;
    return { 
        subtotal: Math.round(subtotal * 100) / 100, 
        iva: Math.round(iva * 100) / 100, 
        total: Math.round(total * 100) / 100, 
        ivaPorcentaje 
    };
};

/**
 * Obtiene la base imponible y el IVA a partir de un precio total (IVA incluido)
 * @param {number} total 
 * @param {number} ivaPorcentaje 
 * @returns {Object} { base, iva }
 */
const desgloseDesdeTotal = (total, ivaPorcentaje = 21) => {
    const base = total / (1 + (ivaPorcentaje / 100));
    const iva = total - base;
    return {
        base: Math.round(base * 100) / 100,
        iva: Math.round(iva * 100) / 100
    };
};

/**
 * Suma los importes de una lista de productos (precio * cantidad)
 * @param {Array} productos 
 * @returns {number}
 */
const calcularTotalDesdeProductos = (productos) => {
    if (!Array.isArray(productos)) return 0;
    const total = productos.reduce((sum, p) => {
        const precio = Number(p.price || p.precio) || 0;
        const cantidad = Number(p.quantity || p.cantidad) || 0;
        return sum + (precio * cantidad);
    }, 0);
    return Math.round(total * 100) / 100;
};

export default { 
    calcularIVA, 
    desgloseDesdeTotal,
    calcularTotalDesdeProductos 
};
