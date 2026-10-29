import { createRouter, createWebHistory, type RouterHistory, type RouteRecordRaw } from 'vue-router'
import LayoutPrincipal from '@/layouts/LayoutPrincipal.vue'
import { useAuthStore } from '@/stores/auth'
import type { Rol } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    // Se ve sin sesión (solo /login)
    publica?: boolean
    // Roles que pueden entrar. Sin roles: cualquier usuario con sesión.
    // Es solo comodidad visual: la autorización real la hace el backend.
    roles?: readonly Rol[]
    // Título de la pestaña del navegador
    titulo?: string
  }
}

// Cada módulo agrega aquí sus rutas (y su entrada en router/menu.ts)
export const rutas: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginVista.vue'),
    meta: { publica: true, titulo: 'Iniciar sesión' },
  },
  {
    // Todas las pantallas con sesión van como hijas del layout
    path: '/',
    name: 'principal',
    component: LayoutPrincipal,
    children: [
      {
        path: '',
        name: 'inicio',
        component: () => import('@/views/inicio/InicioVista.vue'),
        meta: { titulo: 'Inicio' },
      },
      {
        path: 'perfil',
        name: 'perfil',
        component: () => import('@/views/auth/PerfilVista.vue'),
        meta: { titulo: 'Mi perfil' },
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: () => import('@/views/usuarios/UsuariosVista.vue'),
        meta: { roles: ['ADMIN'], titulo: 'Usuarios' },
      },
      {
        path: 'clientes',
        name: 'clientes',
        component: () => import('@/views/clientes/ClientesVista.vue'),
        meta: { roles: ['ADMIN', 'VENDEDOR'], titulo: 'Clientes' },
      },
      {
        path: 'clientes/:id(\\d+)',
        name: 'cliente',
        component: () => import('@/views/clientes/ClienteDetalleVista.vue'),
        props: true,
        meta: { roles: ['ADMIN', 'VENDEDOR'], titulo: 'Cliente' },
      },
      {
        path: 'productos',
        name: 'productos',
        component: () => import('@/views/productos/ProductosVista.vue'),
        meta: { titulo: 'Productos' },
      },
      {
        // Antes de cualquier productos/:id que se agregue después
        path: 'productos/stock-bajo',
        name: 'stock-bajo',
        component: () => import('@/views/productos/StockBajoVista.vue'),
        meta: { roles: ['ADMIN', 'BODEGUERO', 'COMPRAS'], titulo: 'Stock bajo' },
      },
      {
        path: 'proveedores',
        name: 'proveedores',
        component: () => import('@/views/proveedores/ProveedoresVista.vue'),
        meta: { roles: ['ADMIN', 'COMPRAS', 'BODEGUERO'], titulo: 'Proveedores' },
      },
      {
        path: 'sin-permiso',
        name: 'sin-permiso',
        component: () => import('@/views/sistema/SinPermisoVista.vue'),
        meta: { titulo: 'Sin permiso' },
      },
      {
        path: ':ruta(.*)*',
        name: 'no-encontrado',
        component: () => import('@/views/sistema/NoEncontradoVista.vue'),
        meta: { titulo: 'No encontrado' },
      },
    ],
  },
]

export function crearRouter(history: RouterHistory = createWebHistory(import.meta.env.BASE_URL)) {
  const router = createRouter({ history, routes: rutas })

  router.beforeEach((to) => {
    const auth = useAuthStore()
    // Si borraron el token de localStorage (a mano o desde otra pestaña),
    // la sesión en memoria tampoco vale
    auth.sincronizarConAlmacenamiento()

    if (to.meta.publica) {
      // Con sesión, /login no tiene sentido: al inicio
      return to.name === 'login' && auth.autenticado ? { name: 'inicio' } : true
    }
    if (!auth.autenticado) {
      // Se guarda adónde iba, para volver después del login
      return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
    }
    const roles = to.meta.roles
    if (roles && !auth.tieneRol(...roles)) {
      return { name: 'sin-permiso' }
    }
    return true
  })

  router.afterEach((to) => {
    document.title = to.meta.titulo ? `${to.meta.titulo} · ERP` : 'ERP'
  })

  return router
}

// Destino después del login: solo rutas internas de la app. "//sitio.com" o
// "https://..." en ?redirect= llevarían a otro sitio (open redirect).
export function rutaDeRegreso(redirect: unknown): string {
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/'
}
