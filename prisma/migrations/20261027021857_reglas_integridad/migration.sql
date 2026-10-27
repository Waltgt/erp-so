-- This is an empty migration.

-- ============================================================
-- Reglas que Prisma no puede expresar en schema.prisma.
-- Pegar AL FINAL del migration.sql generado con --create-only.
-- ============================================================

-- Inventario: el stock nunca puede quedar negativo (red de seguridad
-- contra condiciones de carrera entre ventas simultáneas)
ALTER TABLE "productos"
  ADD CONSTRAINT "productos_stock_no_negativo" CHECK ("stock" >= 0),
  ADD CONSTRAINT "productos_stock_minimo_no_negativo" CHECK ("stock_minimo" >= 0),
  ADD CONSTRAINT "productos_precios_no_negativos" CHECK ("precio_venta" >= 0 AND "costo" >= 0);

-- Ventas
ALTER TABLE "detalle_venta"
  ADD CONSTRAINT "detalle_venta_cantidad_positiva" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "detalle_venta_precio_no_negativo" CHECK ("precio_unitario" >= 0);

ALTER TABLE "ventas"
  ADD CONSTRAINT "ventas_total_no_negativo" CHECK ("total" >= 0),
  ADD CONSTRAINT "ventas_anulacion_coherente" CHECK (
    ("estado" = 'ANULADA' AND "anulada_en" IS NOT NULL)
    OR ("estado" = 'COMPLETADA' AND "anulada_en" IS NULL)
  );

-- Clientes: NIT único, excepto "CF" (consumidor final), que se repite
CREATE UNIQUE INDEX "clientes_nit_unico" ON "clientes" ("nit") WHERE "nit" <> 'CF';

-- Carpetas: un usuario no puede tener dos carpetas con el mismo nombre
-- dentro del mismo padre. NULLS NOT DISTINCT (PostgreSQL 15+) hace que
-- esto también aplique a las carpetas raíz (parent_id NULL).
CREATE UNIQUE INDEX "carpetas_nombre_unico"
  ON "carpetas" ("usuario_id", "parent_id", "nombre") NULLS NOT DISTINCT;

-- Una carpeta no puede ser su propio padre
ALTER TABLE "carpetas"
  ADD CONSTRAINT "carpetas_no_autorreferencia" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

-- Archivos
ALTER TABLE "archivos_multimedia"
  ADD CONSTRAINT "archivos_tamano_positivo" CHECK ("tamano_bytes" > 0),
  ADD CONSTRAINT "archivos_duracion_no_negativa" CHECK ("duracion_seg" IS NULL OR "duracion_seg" >= 0);
