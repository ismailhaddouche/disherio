import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { HttpClient } from '@angular/common/http';
import { authStore, type Language } from '../../store/auth.store';

export type { Language };
import { environment } from '../../../environments/environment';

interface Translations {
  [key: string]: string | Translations;
}

const TRANSLATIONS: Record<Language, Translations> = {
  es: {
    // Common
    'common.loading': 'Cargando...',
    'common.logging_in': 'Accediendo...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.close': 'Cerrar',
    'common.back': 'Volver',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.confirm': 'Confirmar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.active': 'Activo',
    'common.inactive': 'Inactivo',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.warning': 'Advertencia',
    'common.info': 'Información',
    'common.refresh': 'Actualizar',
    'common.logout': 'Cerrar sesión',
    'common.settings': 'Configuración',
    'common.profile': 'Perfil',
    'common.language': 'Idioma',
    'common.theme': 'Tema',
    'common.dark': 'Oscuro',
    'common.light': 'Claro',
    'common.system': 'Sistema',
    'common.default': 'Por defecto',
    'common.from': 'Desde',
    'common.to': 'Hasta',

    // Auth
    'auth.login': 'Iniciar sesión',
    'auth.login.username': 'Usuario',
    'auth.login.password': 'Contraseña',
    'auth.login.pin': 'PIN',
    'auth.login.submit': 'Entrar',
    'auth.login.error': 'Error al iniciar sesión',
    'auth.login.success': 'Sesión iniciada correctamente',

    // Dashboard
    'dashboard.title': 'Panel de Control',
    'dashboard.stats.today': 'Hoy',
    'dashboard.stats.week': 'Esta semana',
    'dashboard.stats.month': 'Este mes',
    'dashboard.stats.revenue': 'Ingresos',
    'dashboard.stats.orders': 'Pedidos',
    'dashboard.stats.customers': 'Clientes',
    'dashboard.stats.avgTicket': 'Ticket promedio',
    'dashboard.chart.sales': 'Ventas',
    'dashboard.chart.orders': 'Pedidos',
    'dashboard.recentOrders': 'Pedidos recientes',
    'dashboard.popularDishes': 'Platos populares',
    'dashboard.loading': 'Cargando datos del panel...',
    'dashboard.error': 'Error al cargar los datos del panel',

    // Admin
    'admin.title': 'Administración',
    'admin.menu.dashboard': 'Dashboard',
    'admin.menu.orders': 'Pedidos',
    'admin.menu.dishes': 'Carta',
    'admin.menu.categories': 'Categorías',
    'admin.menu.staff': 'Personal',
    'admin.menu.totems': 'Tótems',
    'admin.menu.logs': 'Logs',
    'admin.menu.settings': 'Ajustes',
    'admin.menu.reports': 'Informes',

    // Dish
    'dish.new_dish': 'Nuevo Plato',
    'dish.edit_dish': 'Editar Plato',
    'dish.image': 'Imagen del Plato',
    'dish.base_price': 'Precio Base (IVA Inc.)',
    'dish.price_negative': 'El precio no puede ser negativo',
    'dish.category': 'Categoría',
    'dish.price': 'Precio',
    'dish.add': 'Añadir',
    'dish.variants': 'Variantes',
    'dish.no_variants': 'Sin variantes configuradas',
    'dish.extras': 'Extras (Toppings)',
    'dish.extras_desc': 'Extras que se pueden añadir al plato, como toppings o complementos.',
    'dish.no_extras': 'Sin extras configurados',
    'dish.no_description': 'Sin descripción',
    'dish.no_dishes': 'No hay platos creados aún',
    'dish.toggle_status_error': 'Error al cambiar el estado del plato',

    // TAS (Table Assistance)
    'tas.title': 'Servicio de Mesas',
    'tas.tables': 'Mesas',
    'tas.tables.free': 'Libre',
    'tas.tables.occupied': 'Ocupada',
    'tas.tables.reserved': 'Reservada',
    'tas.session.open': 'Abrir sesión',
    'tas.session.close': 'Cerrar sesión',
    'tas.session.customers': 'Clientes',
    'tas.order.add': 'Añadir pedido',
    'tas.order.send': 'Enviar a cocina',
    'tas.order.pay': 'Pagar',

    // POS
    'pos.title': 'Punto de Venta',
    'pos.tables': 'Mesas',
    'pos.no_active_sessions': 'Sin sesiones activas',
    'pos.new_table': 'Nueva Mesa',
    'pos.select_table': 'Selecciona una mesa para ver los pedidos',
    'pos.ticket': 'Ticket',
    'pos.empty_cart': 'Carrito vacío',
    'pos.checkout': 'Cobrar',
    'pos.charge': 'Cobrar',
    'pos.total': 'Total',
    'pos.subtotal': 'Subtotal (sin IVA)',
    'pos.tax': 'IVA',
    'pos.discount': 'Descuento',
    'pos.tip': 'Propina',

    // KDS
    'kds.title': 'Pantalla de Cocina',
    'kds.pending': 'pendientes',
    'kds.new_orders': 'Nuevos',
    'kds.prepare': 'Preparar',
    'kds.in_preparation': 'En preparación',
    'kds.serve': 'Servido',
    'kds.preparing': 'Preparando',
    'kds.ready': 'Listo',
    'kds.served': 'Servido',

    // Errors (error.* for general, errors.* for API codes)
    'error.loading': 'Error al cargar los datos',
    'error.saving': 'Error al guardar los cambios',
    'error.deleting': 'Error al eliminar',
    'error.network': 'Error de conexión',
    'error.unauthorized': 'Sesión expirada. Por favor, inicie sesión de nuevo.',
    'error.forbidden': 'No tiene permisos para realizar esta acción',
    'error.notFound': 'No se encontró el recurso solicitado',
    'error.server': 'Error del servidor. Inténtelo de nuevo más tarde.',
    'errors.INVALID_CREDENTIALS': 'Credenciales incorrectas',
    'errors.LOADING_ERROR': 'Error al cargar. Inténtalo de nuevo.',
    'errors.SERVER_ERROR': 'Error interno del servidor',

    // Settings
    'settings.title': 'Configuración',
    'settings.general': 'General',
    'settings.restaurant': 'Restaurante',
    'settings.tax': 'Impuestos',
    'settings.currency': 'Moneda',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.preferences.saved': 'Preferencias guardadas correctamente',
    'settings.preferences.error': 'Error al guardar preferencias',
    'settings.staff_defaults': 'Estos ajustes se usarán como valores predeterminados para nuevos miembros del personal',

    // Common extras
    'common.actions': 'Acciones',
    'common.name': 'Nombre',
    'common.saving': 'Guardando...',

    // Category
    'category.new': 'Nueva Categoría',
    'category.edit': 'Editar Categoría',
    'category.no_categories': 'No hay categorías creadas aún',
    'category.image': 'Imagen de la Categoría',
    'category.name_es': 'Nombre (ES)',
    'category.display_order': 'Orden de visualización',
    'category.description_es': 'Descripción (ES)',
    'category.delete_confirm': '¿Eliminar esta categoría? Los platos asociados podrían quedar sin categoría.',

    // Staff
    'staff.title': 'Personal',
    'staff.subtitle': 'Gestiona el personal del restaurante',
    'staff.new': 'Nuevo Personal',
    'staff.no_staff': 'No hay personal',
    'staff.no_staff_desc': 'Agrega el primer miembro del equipo.',
    'staff.create': 'Crear personal',
    'staff.back': 'Volver al personal',
    'staff.full_name': 'Nombre completo',
    'staff.username_label': 'Nombre de usuario',
    'staff.username_hint': 'Usado para iniciar sesión. Solo letras, números y puntos.',
    'staff.select_role': 'Selecciona un rol',
    'staff.no_roles': 'No hay roles disponibles. Contacta al administrador.',
    'staff.name_required': 'El nombre es obligatorio',
    'staff.username_required': 'El usuario es obligatorio (mín. 3 caracteres)',
    'staff.password_min': 'La contraseña debe tener al menos 6 caracteres',
    'staff.pin_invalid': 'El PIN debe tener 4 dígitos numéricos',
    'staff.pin_hint': 'PIN de 4 dígitos para acceso rápido en el POS',
    'staff.password_keep': '(dejar en blanco para mantener)',
    'staff.save_changes': 'Guardar Cambios',
    'staff.create_staff': 'Crear Personal',
    'staff.updated': 'Personal actualizado correctamente',
    'staff.created': 'Personal creado correctamente',
    'staff.column_username': 'Usuario',
    'staff.column_role': 'Rol',

    // Totem
    'totem.title': 'Tótems',
    'totem.new': 'Nuevo Tótem',
    'totem.edit': 'Editar Tótem',
    'totem.no_totems': 'No hay tótems',
    'totem.no_totems_desc': 'Crea tu primer tótem para empezar.',
    'totem.create': 'Crear tótem',
    'totem.back': 'Volver a tótems',
    'totem.type_column': 'Tipo',
    'totem.start_date': 'Fecha Inicio',
    'totem.type_standard': 'Estándar',
    'totem.type_temporary': 'Temporal',
    'totem.no_qr': 'Sin QR',
    'totem.regenerate_qr': 'Regenerar QR',
    'totem.name_label': 'Nombre del tótem',
    'totem.type_label': 'Tipo de tótem',
    'totem.current_qr': 'Código QR Actual',
    'totem.copy_url': 'Copiar URL',
    'totem.url_copied': 'URL copiada al portapapeles',
    'totem.standard_desc': 'Los tótems estándar son permanentes y no tienen fecha de expiración.',
    'totem.temporary_desc': 'Los tótems temporales están pensados para eventos especiales.',
    'totem.name_required': 'El nombre es obligatorio',
    'totem.save_changes': 'Guardar Cambios',
    'totem.create_totem': 'Crear Tótem',
    'totem.regenerating': 'Regenerando...',
    'totem.updated': 'Tótem actualizado correctamente',
    'totem.created': 'Tótem creado correctamente',
    'totem.qr_regenerated': 'QR regenerado correctamente',
  },
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.logging_in': 'Signing in...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',
    'common.info': 'Information',
    'common.refresh': 'Refresh',
    'common.logout': 'Logout',
    'common.settings': 'Settings',
    'common.profile': 'Profile',
    'common.language': 'Language',
    'common.theme': 'Theme',
    'common.dark': 'Dark',
    'common.light': 'Light',
    'common.system': 'System',
    'common.default': 'Default',
    'common.from': 'From',
    'common.to': 'To',

    // Auth
    'auth.login': 'Login',
    'auth.login.username': 'Username',
    'auth.login.password': 'Password',
    'auth.login.pin': 'PIN',
    'auth.login.submit': 'Sign In',
    'auth.login.error': 'Login error',
    'auth.login.success': 'Login successful',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.stats.today': 'Today',
    'dashboard.stats.week': 'This week',
    'dashboard.stats.month': 'This month',
    'dashboard.stats.revenue': 'Revenue',
    'dashboard.stats.orders': 'Orders',
    'dashboard.stats.customers': 'Customers',
    'dashboard.stats.avgTicket': 'Avg Ticket',
    'dashboard.chart.sales': 'Sales',
    'dashboard.chart.orders': 'Orders',
    'dashboard.recentOrders': 'Recent Orders',
    'dashboard.popularDishes': 'Popular Dishes',
    'dashboard.loading': 'Loading dashboard data...',
    'dashboard.error': 'Error loading dashboard data',

    // Admin
    'admin.title': 'Administration',
    'admin.menu.dashboard': 'Dashboard',
    'admin.menu.orders': 'Orders',
    'admin.menu.dishes': 'Menu',
    'admin.menu.categories': 'Categories',
    'admin.menu.staff': 'Staff',
    'admin.menu.totems': 'Totems',
    'admin.menu.logs': 'Logs',
    'admin.menu.settings': 'Settings',
    'admin.menu.reports': 'Reports',

    // Dish
    'dish.new_dish': 'New Dish',
    'dish.edit_dish': 'Edit Dish',
    'dish.image': 'Dish Image',
    'dish.base_price': 'Base Price (VAT incl.)',
    'dish.price_negative': 'Price cannot be negative',
    'dish.category': 'Category',
    'dish.price': 'Price',
    'dish.add': 'Add',
    'dish.variants': 'Variants',
    'dish.no_variants': 'No variants configured',
    'dish.extras': 'Extras (Toppings)',
    'dish.extras_desc': 'Extras that can be added to the dish, like toppings or sides.',
    'dish.no_extras': 'No extras configured',
    'dish.no_description': 'No description',
    'dish.no_dishes': 'No dishes created yet',
    'dish.toggle_status_error': 'Error changing dish status',

    // TAS (Table Assistance)
    'tas.title': 'Table Service',
    'tas.tables': 'Tables',
    'tas.tables.free': 'Free',
    'tas.tables.occupied': 'Occupied',
    'tas.tables.reserved': 'Reserved',
    'tas.session.open': 'Open Session',
    'tas.session.close': 'Close Session',
    'tas.session.customers': 'Customers',
    'tas.order.add': 'Add Order',
    'tas.order.send': 'Send to Kitchen',
    'tas.order.pay': 'Pay',

    // POS
    'pos.title': 'Point of Sale',
    'pos.tables': 'Tables',
    'pos.no_active_sessions': 'No active sessions',
    'pos.new_table': 'New Table',
    'pos.select_table': 'Select a table to view orders',
    'pos.ticket': 'Ticket',
    'pos.empty_cart': 'Empty cart',
    'pos.checkout': 'Checkout',
    'pos.charge': 'Charge',
    'pos.total': 'Total',
    'pos.subtotal': 'Subtotal (excl. tax)',
    'pos.tax': 'Tax',
    'pos.discount': 'Discount',
    'pos.tip': 'Tip',

    // KDS
    'kds.title': 'Kitchen Display',
    'kds.pending': 'pending',
    'kds.new_orders': 'New',
    'kds.prepare': 'Prepare',
    'kds.in_preparation': 'In preparation',
    'kds.serve': 'Served',
    'kds.preparing': 'Preparing',
    'kds.ready': 'Ready',
    'kds.served': 'Served',

    // Errors (error.* for general, errors.* for API codes)
    'error.loading': 'Error loading data',
    'error.saving': 'Error saving changes',
    'error.deleting': 'Error deleting',
    'error.network': 'Network error',
    'error.unauthorized': 'Session expired. Please log in again.',
    'error.forbidden': 'You do not have permission to perform this action',
    'error.notFound': 'Requested resource not found',
    'error.server': 'Server error. Please try again later.',
    'errors.INVALID_CREDENTIALS': 'Invalid credentials',
    'errors.LOADING_ERROR': 'Loading error. Please try again.',
    'errors.SERVER_ERROR': 'Internal server error',

    // Settings
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.restaurant': 'Restaurant',
    'settings.tax': 'Tax',
    'settings.currency': 'Currency',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.preferences.saved': 'Preferences saved successfully',
    'settings.preferences.error': 'Error saving preferences',
    'settings.staff_defaults': 'These settings will be used as defaults for new staff members',

    // Common extras
    'common.actions': 'Actions',
    'common.name': 'Name',
    'common.saving': 'Saving...',

    // Category
    'category.new': 'New Category',
    'category.edit': 'Edit Category',
    'category.no_categories': 'No categories yet',
    'category.image': 'Category Image',
    'category.name_es': 'Name (ES)',
    'category.display_order': 'Display order',
    'category.description_es': 'Description (ES)',
    'category.delete_confirm': 'Delete this category? Associated dishes may become uncategorized.',

    // Staff
    'staff.title': 'Staff',
    'staff.subtitle': 'Manage restaurant staff',
    'staff.new': 'New Staff Member',
    'staff.no_staff': 'No staff members',
    'staff.no_staff_desc': 'Add the first team member.',
    'staff.create': 'Create staff',
    'staff.back': 'Back to staff',
    'staff.full_name': 'Full name',
    'staff.username_label': 'Username',
    'staff.username_hint': 'Used for login. Letters, numbers and dots only.',
    'staff.select_role': 'Select a role',
    'staff.no_roles': 'No roles available. Contact the administrator.',
    'staff.name_required': 'Name is required',
    'staff.username_required': 'Username is required (min. 3 chars)',
    'staff.password_min': 'Password must be at least 6 characters',
    'staff.pin_invalid': 'PIN must be 4 numeric digits',
    'staff.pin_hint': '4-digit PIN for quick POS access',
    'staff.password_keep': '(leave blank to keep)',
    'staff.save_changes': 'Save Changes',
    'staff.create_staff': 'Create Staff Member',
    'staff.updated': 'Staff updated successfully',
    'staff.created': 'Staff created successfully',
    'staff.column_username': 'Username',
    'staff.column_role': 'Role',

    // Totem
    'totem.title': 'Totems',
    'totem.new': 'New Totem',
    'totem.edit': 'Edit Totem',
    'totem.no_totems': 'No totems',
    'totem.no_totems_desc': 'Create your first totem to get started.',
    'totem.create': 'Create totem',
    'totem.back': 'Back to totems',
    'totem.type_column': 'Type',
    'totem.start_date': 'Start Date',
    'totem.type_standard': 'Standard',
    'totem.type_temporary': 'Temporary',
    'totem.no_qr': 'No QR',
    'totem.regenerate_qr': 'Regenerate QR',
    'totem.name_label': 'Totem name',
    'totem.type_label': 'Totem type',
    'totem.current_qr': 'Current QR Code',
    'totem.copy_url': 'Copy URL',
    'totem.url_copied': 'URL copied to clipboard',
    'totem.standard_desc': 'Standard totems are permanent and have no expiry date.',
    'totem.temporary_desc': 'Temporary totems are designed for special events.',
    'totem.name_required': 'Name is required',
    'totem.save_changes': 'Save Changes',
    'totem.create_totem': 'Create Totem',
    'totem.regenerating': 'Regenerating...',
    'totem.updated': 'Totem updated successfully',
    'totem.created': 'Totem created successfully',
    'totem.qr_regenerated': 'QR regenerated successfully',
  },
  fr: {
    // Common
    'common.loading': 'Chargement...',
    'common.logging_in': 'Connexion...',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.search': 'Rechercher',
    'common.filter': 'Filtrer',
    'common.close': 'Fermer',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.previous': 'Précédent',
    'common.confirm': 'Confirmer',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.active': 'Actif',
    'common.inactive': 'Inactif',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.warning': 'Attention',
    'common.info': 'Information',
    'common.refresh': 'Actualiser',
    'common.logout': 'Déconnexion',
    'common.settings': 'Paramètres',
    'common.profile': 'Profil',
    'common.language': 'Langue',
    'common.theme': 'Thème',
    'common.dark': 'Sombre',
    'common.light': 'Clair',
    'common.system': 'Système',
    'common.default': 'Par défaut',
    'common.from': 'De',
    'common.to': 'À',

    // Auth
    'auth.login': 'Connexion',
    'auth.login.username': "Nom d'utilisateur",
    'auth.login.password': 'Mot de passe',
    'auth.login.pin': 'PIN',
    'auth.login.submit': 'Se connecter',
    'auth.login.error': 'Erreur de connexion',
    'auth.login.success': 'Connexion réussie',

    // Dashboard
    'dashboard.title': 'Tableau de bord',
    'dashboard.stats.today': "Aujourd'hui",
    'dashboard.stats.week': 'Cette semaine',
    'dashboard.stats.month': 'Ce mois-ci',
    'dashboard.stats.revenue': 'Revenus',
    'dashboard.stats.orders': 'Commandes',
    'dashboard.stats.customers': 'Clients',
    'dashboard.stats.avgTicket': 'Ticket moyen',
    'dashboard.chart.sales': 'Ventes',
    'dashboard.chart.orders': 'Commandes',
    'dashboard.recentOrders': 'Commandes récentes',
    'dashboard.popularDishes': 'Plats populaires',
    'dashboard.loading': 'Chargement du tableau de bord...',
    'dashboard.error': 'Erreur lors du chargement du tableau de bord',

    // Admin
    'admin.title': 'Administration',
    'admin.menu.dashboard': 'Tableau de bord',
    'admin.menu.orders': 'Commandes',
    'admin.menu.dishes': 'Carte',
    'admin.menu.categories': 'Catégories',
    'admin.menu.staff': 'Personnel',
    'admin.menu.totems': 'Totems',
    'admin.menu.logs': 'Logs',
    'admin.menu.settings': 'Paramètres',
    'admin.menu.reports': 'Rapports',

    // Dish
    'dish.new_dish': 'Nouveau Plat',
    'dish.edit_dish': 'Modifier le Plat',
    'dish.image': 'Image du Plat',
    'dish.base_price': 'Prix de base (TVA incl.)',
    'dish.price_negative': 'Le prix ne peut pas être négatif',
    'dish.category': 'Catégorie',
    'dish.price': 'Prix',
    'dish.add': 'Ajouter',
    'dish.variants': 'Variantes',
    'dish.no_variants': 'Aucune variante configurée',
    'dish.extras': 'Extras (Toppings)',
    'dish.extras_desc': 'Extras pouvant être ajoutés au plat, comme les toppings.',
    'dish.no_extras': 'Aucun extra configuré',
    'dish.no_description': 'Sans description',
    'dish.no_dishes': 'Aucun plat créé',
    'dish.toggle_status_error': 'Erreur lors du changement de statut du plat',

    // TAS (Table Assistance)
    'tas.title': 'Service de table',
    'tas.tables': 'Tables',
    'tas.tables.free': 'Libre',
    'tas.tables.occupied': 'Occupée',
    'tas.tables.reserved': 'Réservée',
    'tas.session.open': 'Ouvrir session',
    'tas.session.close': 'Fermer session',
    'tas.session.customers': 'Clients',
    'tas.order.add': 'Ajouter commande',
    'tas.order.send': 'Envoyer en cuisine',
    'tas.order.pay': 'Payer',

    // POS
    'pos.title': 'Point de vente',
    'pos.tables': 'Tables',
    'pos.no_active_sessions': 'Aucune session active',
    'pos.new_table': 'Nouvelle Table',
    'pos.select_table': 'Sélectionnez une table pour voir les commandes',
    'pos.ticket': 'Ticket',
    'pos.empty_cart': 'Panier vide',
    'pos.checkout': 'Caisse',
    'pos.charge': 'Encaisser',
    'pos.total': 'Total',
    'pos.subtotal': 'Sous-total (HT)',
    'pos.tax': 'TVA',
    'pos.discount': 'Réduction',
    'pos.tip': 'Pourboire',

    // KDS
    'kds.title': 'Écran cuisine',
    'kds.pending': 'en attente',
    'kds.new_orders': 'Nouveaux',
    'kds.prepare': 'Préparer',
    'kds.in_preparation': 'En préparation',
    'kds.serve': 'Servi',
    'kds.preparing': 'En préparation',
    'kds.ready': 'Prêt',
    'kds.served': 'Servi',

    // Errors (error.* for general, errors.* for API codes)
    'error.loading': 'Erreur lors du chargement des données',
    'error.saving': "Erreur lors de l'enregistrement des modifications",
    'error.deleting': 'Erreur lors de la suppression',
    'error.network': 'Erreur de connexion',
    'error.unauthorized': 'Session expirée. Veuillez vous reconnecter.',
    'error.forbidden': "Vous n'avez pas la permission d'effectuer cette action",
    'error.notFound': 'Ressource demandée non trouvée',
    'error.server': 'Erreur serveur. Veuillez réessayer plus tard.',
    'errors.INVALID_CREDENTIALS': 'Identifiants invalides',
    'errors.LOADING_ERROR': 'Erreur de chargement. Veuillez réessayer.',
    'errors.SERVER_ERROR': 'Erreur interne du serveur',

    // Settings
    'settings.title': 'Paramètres',
    'settings.general': 'Général',
    'settings.restaurant': 'Restaurant',
    'settings.tax': 'Taxes',
    'settings.currency': 'Devise',
    'settings.language': 'Langue',
    'settings.theme': 'Thème',
    'settings.preferences.saved': 'Préférences enregistrées avec succès',
    'settings.preferences.error': 'Erreur lors de la sauvegarde des préférences',
    'settings.staff_defaults': 'Ces paramètres seront utilisés comme valeurs par défaut pour les nouveaux membres du personnel',

    // Common extras
    'common.actions': 'Actions',
    'common.name': 'Nom',
    'common.saving': 'Enregistrement...',

    // Category
    'category.new': 'Nouvelle Catégorie',
    'category.edit': 'Modifier la Catégorie',
    'category.no_categories': 'Aucune catégorie créée',
    'category.image': 'Image de la Catégorie',
    'category.name_es': 'Nom (ES)',
    'category.display_order': "Ordre d'affichage",
    'category.description_es': 'Description (ES)',
    'category.delete_confirm': 'Supprimer cette catégorie ? Les plats associés pourraient se retrouver sans catégorie.',

    // Staff
    'staff.title': 'Personnel',
    'staff.subtitle': 'Gérez le personnel du restaurant',
    'staff.new': 'Nouveau Personnel',
    'staff.no_staff': 'Aucun membre du personnel',
    'staff.no_staff_desc': "Ajoutez le premier membre de l'équipe.",
    'staff.create': 'Créer un personnel',
    'staff.back': 'Retour au personnel',
    'staff.full_name': 'Nom complet',
    'staff.username_label': "Nom d'utilisateur",
    'staff.username_hint': 'Utilisé pour la connexion. Lettres, chiffres et points uniquement.',
    'staff.select_role': 'Sélectionner un rôle',
    'staff.no_roles': "Aucun rôle disponible. Contactez l'administrateur.",
    'staff.name_required': 'Le nom est obligatoire',
    'staff.username_required': "Nom d'utilisateur obligatoire (min. 3 caractères)",
    'staff.password_min': 'Le mot de passe doit contenir au moins 6 caractères',
    'staff.pin_invalid': 'Le PIN doit avoir 4 chiffres numériques',
    'staff.pin_hint': 'PIN à 4 chiffres pour accès rapide au POS',
    'staff.password_keep': '(laisser vide pour conserver)',
    'staff.save_changes': 'Enregistrer les modifications',
    'staff.create_staff': 'Créer un Personnel',
    'staff.updated': 'Personnel mis à jour avec succès',
    'staff.created': 'Personnel créé avec succès',
    'staff.column_username': "Nom d'utilisateur",
    'staff.column_role': 'Rôle',

    // Totem
    'totem.title': 'Totems',
    'totem.new': 'Nouveau Totem',
    'totem.edit': 'Modifier le Totem',
    'totem.no_totems': 'Aucun totem',
    'totem.no_totems_desc': 'Créez votre premier totem pour commencer.',
    'totem.create': 'Créer un totem',
    'totem.back': 'Retour aux totems',
    'totem.type_column': 'Type',
    'totem.start_date': 'Date de début',
    'totem.type_standard': 'Standard',
    'totem.type_temporary': 'Temporaire',
    'totem.no_qr': 'Sans QR',
    'totem.regenerate_qr': 'Régénérer le QR',
    'totem.name_label': 'Nom du totem',
    'totem.type_label': 'Type de totem',
    'totem.current_qr': 'Code QR Actuel',
    'totem.copy_url': "Copier l'URL",
    'totem.url_copied': 'URL copiée dans le presse-papiers',
    'totem.standard_desc': "Les totems standard sont permanents et n'ont pas de date d'expiration.",
    'totem.temporary_desc': 'Les totems temporaires sont conçus pour les événements spéciaux.',
    'totem.name_required': 'Le nom est obligatoire',
    'totem.save_changes': 'Enregistrer les modifications',
    'totem.create_totem': 'Créer un Totem',
    'totem.regenerating': 'Régénération...',
    'totem.updated': 'Totem mis à jour avec succès',
    'totem.created': 'Totem créé avec succès',
    'totem.qr_regenerated': 'QR régénéré avec succès',
  }
};

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly platform = inject(Platform);
  private readonly http = inject(HttpClient);
  
  // Signals
  private readonly _currentLang = signal<Language>('es');
  readonly currentLang = this._currentLang.asReadonly();
  
  readonly isSpanish = computed(() => this._currentLang() === 'es');
  readonly isEnglish = computed(() => this._currentLang() === 'en');
  readonly isFrench = computed(() => this._currentLang() === 'fr');
  
  constructor() {
    // Load language from user preferences or localStorage
    this.loadLanguage();
    
    // Watch for changes in auth store preferences
    effect(() => {
      const prefs = authStore.preferences();
      if (prefs?.language) {
        this._currentLang.set(prefs.language);
      }
    });
    
    // Save language when it changes
    effect(() => {
      const lang = this._currentLang();
      if (this.platform.isBrowser) {
        localStorage.setItem('disherio-language', lang);
        document.documentElement.lang = lang;
      }
    });
  }
  
  private loadLanguage(): void {
    // Priority: 1. Auth store preferences, 2. localStorage, 3. Browser language, 4. Default 'es'
    const userPrefs = authStore.preferences();
    if (userPrefs?.language) {
      this._currentLang.set(userPrefs.language);
      return;
    }
    
    if (this.platform.isBrowser) {
      const saved = localStorage.getItem('disherio-language') as Language;
      if (saved && TRANSLATIONS[saved]) {
        this._currentLang.set(saved);
        return;
      }
      
      // Detect browser language
      const browserLang = navigator.language.split('-')[0] as Language;
      if (TRANSLATIONS[browserLang]) {
        this._currentLang.set(browserLang);
        return;
      }
    }
    
    this._currentLang.set('es');
  }
  
  setLanguage(lang: Language): void {
    if (!TRANSLATIONS[lang]) return;
    
    this._currentLang.set(lang);
    
    // Save to backend
    this.savePreference('language', lang);
    
    // Update local auth store
    authStore.updatePreferences({ language: lang });
  }
  
  private savePreference(key: 'language' | 'theme', value: string): void {
    if (!authStore.isAuthenticated()) return;
    
    this.http.patch(`${environment.apiUrl}/staff/me/preferences`, { [key]: value })
      .subscribe({
        error: (err) => console.error('Failed to save preference:', err)
      });
  }
  
  translate(key: string): string {
    const translations = TRANSLATIONS[this._currentLang()];

    // TRANSLATIONS stores flat keys like 'dashboard.title' as literal strings —
    // try direct lookup first before attempting dot-navigation.
    const direct = translations[key];
    if (typeof direct === 'string') {
      return direct;
    }

    // Fallback: navigate nested objects for any future nested structure
    const parts = key.split('.');
    let value: unknown = translations;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Translations)[part];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  }
  
  // Get all available languages
  getAvailableLanguages(): { code: Language; name: string; flag: string }[] {
    return [
      { code: 'es', name: 'Español', flag: '🇪🇸' },
      { code: 'en', name: 'English', flag: '🇬🇧' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' }
    ];
  }
}
