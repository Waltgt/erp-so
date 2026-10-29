import {
  CONTACTO_MAX,
  type ActualizarProveedorPeticion,
  type CrearProveedorPeticion,
  type Proveedor,
} from '@/types/proveedores'
import type { Errores } from './comun'
import { opcional, soloCambios, validarContacto, type FormularioContacto } from './contacto'

export interface FormularioProveedor extends FormularioContacto {
  contacto: string
}

export function formularioDeProveedor(proveedor: Proveedor | null): FormularioProveedor {
  return {
    nit: proveedor?.nit ?? '',
    nombre: proveedor?.nombre ?? '',
    contacto: proveedor?.contacto ?? '',
    email: proveedor?.email ?? '',
    telefono: proveedor?.telefono ?? '',
    direccion: proveedor?.direccion ?? '',
  }
}

// "CF" no se rechaza aquí: lo rechaza el backend (400) y su mensaje se
// muestra junto al campo NIT
export function validarProveedor(f: FormularioProveedor): Errores {
  const errores = validarContacto(f, 'Escribe el NIT')
  if (f.contacto.trim().length > CONTACTO_MAX) {
    errores.contacto = `Máximo ${CONTACTO_MAX} caracteres`
  }
  return errores
}

// POST /api/proveedores
export function datosNuevoProveedor(f: FormularioProveedor): CrearProveedorPeticion {
  return {
    nit: f.nit.trim(),
    nombre: f.nombre.trim(),
    contacto: opcional(f.contacto),
    telefono: opcional(f.telefono),
    email: opcional(f.email),
    direccion: opcional(f.direccion),
  }
}

// PATCH /api/proveedores/:id: solo lo que cambió
export function cambiosDeProveedor(
  original: Proveedor,
  f: FormularioProveedor,
): ActualizarProveedorPeticion {
  return soloCambios({ ...original }, { ...datosNuevoProveedor(f) })
}
