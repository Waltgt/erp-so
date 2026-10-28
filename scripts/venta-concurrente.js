/*
 * Prueba de concurrencia de ventas (módulo 05).
 *
 * Deja el producto con STOCK_INICIAL unidades y lanza N ventas de CANTIDAD
 * al MISMO tiempo. Como el descuento es atómico (UPDATE ... WHERE stock >= n
 * dentro de la transacción de la venta), solo pasan las que caben en el
 * stock; el resto recibe 409 y el stock nunca queda negativo.
 *
 * Uso (Git Bash, con la API corriendo):
 *   TOKEN=<jwt de ADMIN> PRODUCTO_ID=<id> CLIENTE_ID=<id activo> node scripts/venta-concurrente.js
 *
 * El token debe ser de ADMIN: el stock se prepara con ajuste-stock (ADMIN o
 * BODEGUERO) y se vende con POST /ventas (ADMIN o VENDEDOR).
 *
 * Variables opcionales:
 *   API=http://localhost:3000/api   STOCK_INICIAL=1   N=2   CANTIDAD=1
 *
 * Caso del criterio de aceptación (valores por defecto): stock 1, dos ventas
 * de 1 unidad a la vez → una 201, la otra 409, stock final 0.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const TOKEN = process.env.TOKEN;
const PRODUCTO_ID = Number(process.env.PRODUCTO_ID);
const CLIENTE_ID = Number(process.env.CLIENTE_ID);
const STOCK_INICIAL = Number(process.env.STOCK_INICIAL ?? 1);
const N = Number(process.env.N ?? 2);
const CANTIDAD = Number(process.env.CANTIDAD ?? 1);

if (!TOKEN || !Number.isInteger(PRODUCTO_ID) || !Number.isInteger(CLIENTE_ID)) {
  console.error(
    'Faltan TOKEN, PRODUCTO_ID y/o CLIENTE_ID (ver el comentario del archivo)',
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function stockActual() {
  const r = await fetch(`${API}/productos/${PRODUCTO_ID}`, { headers });
  if (!r.ok) throw new Error(`GET producto: ${r.status} ${await r.text()}`);
  return (await r.json()).stock;
}

function vender() {
  return fetch(`${API}/ventas`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      clienteId: CLIENTE_ID,
      items: [{ productoId: PRODUCTO_ID, cantidad: CANTIDAD }],
    }),
  });
}

async function main() {
  // 1. Llevar el stock a STOCK_INICIAL (secuencial, antes de la prueba)
  const antes = await stockActual();
  if (antes !== STOCK_INICIAL) {
    const r = await fetch(`${API}/productos/${PRODUCTO_ID}/ajuste-stock`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cantidad: STOCK_INICIAL - antes,
        motivo: 'Preparar prueba de ventas concurrentes',
      }),
    });
    if (!r.ok) throw new Error(`Preparar stock: ${r.status} ${await r.text()}`);
  }
  console.log(`Stock inicial: ${await stockActual()}`);

  // 2. Lanzar N ventas a la vez (Promise.all no espera una para enviar la otra)
  console.log(`Lanzando ${N} ventas de ${CANTIDAD} unidad(es) en paralelo...`);
  const respuestas = await Promise.all(Array.from({ length: N }, vender));

  const estados = [];
  for (const [i, r] of respuestas.entries()) {
    const cuerpo = await r.json();
    estados.push(r.status);
    const detalle = r.ok
      ? `venta #${cuerpo.id}, total ${cuerpo.total}`
      : cuerpo.message;
    console.log(`  venta ${i + 1}: ${r.status} (${detalle})`);
  }

  // 3. Resultado
  const final = await stockActual();
  const exitosas = estados.filter((s) => s === 201).length;
  const esperadoExitosas = Math.min(N, Math.floor(STOCK_INICIAL / CANTIDAD));
  const esperadoFinal = STOCK_INICIAL - esperadoExitosas * CANTIDAD;
  console.log(`Stock final: ${final}`);

  const correcto =
    exitosas === esperadoExitosas &&
    estados.every((s) => s === 201 || s === 409) &&
    final === esperadoFinal;
  console.log(
    correcto
      ? `✅ Correcto: ${exitosas} con 201, ${N - exitosas} con 409, stock final ${final}`
      : `❌ Inesperado: se esperaban ${esperadoExitosas} con 201 y stock final ${esperadoFinal}`,
  );
  if (exitosas > 0) {
    console.log(
      'Nota: las ventas creadas quedan registradas; anúlalas con POST /ventas/:id/anular si hace falta.',
    );
  }
  process.exit(correcto ? 0 : 1);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
