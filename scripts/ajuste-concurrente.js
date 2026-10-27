/*
 * Prueba de concurrencia del ajuste de stock (módulo 04).
 *
 * Deja el producto con STOCK_INICIAL unidades y lanza N ajustes de CANTIDAD
 * al MISMO tiempo. Como el descuento es atómico (UPDATE ... WHERE stock >= n),
 * solo pueden pasar los que caben en el stock; el resto recibe 409 y el stock
 * nunca queda negativo.
 *
 * Uso (Git Bash, con la API corriendo):
 *   TOKEN=<jwt de ADMIN o BODEGUERO> PRODUCTO_ID=<id> node scripts/ajuste-concurrente.js
 *
 * Variables opcionales:
 *   API=http://localhost:3000/api   STOCK_INICIAL=5   N=2   CANTIDAD=-5
 *
 * Caso del criterio de aceptación (valores por defecto): stock 5, dos ajustes
 * de -5 a la vez → uno 200, el otro 409, stock final 0.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const TOKEN = process.env.TOKEN;
const PRODUCTO_ID = Number(process.env.PRODUCTO_ID);
const STOCK_INICIAL = Number(process.env.STOCK_INICIAL ?? 5);
const N = Number(process.env.N ?? 2);
const CANTIDAD = Number(process.env.CANTIDAD ?? -5);

if (!TOKEN || !Number.isInteger(PRODUCTO_ID)) {
  console.error('Faltan TOKEN y/o PRODUCTO_ID (ver el comentario del archivo)');
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

function ajustar(cantidad, motivo) {
  return fetch(`${API}/productos/${PRODUCTO_ID}/ajuste-stock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cantidad, motivo }),
  });
}

async function main() {
  // 1. Llevar el stock a STOCK_INICIAL (secuencial, antes de la prueba)
  const antes = await stockActual();
  if (antes !== STOCK_INICIAL) {
    const r = await ajustar(STOCK_INICIAL - antes, 'Preparar prueba de concurrencia');
    if (!r.ok) throw new Error(`Preparar stock: ${r.status} ${await r.text()}`);
  }
  console.log(`Stock inicial: ${await stockActual()}`);

  // 2. Lanzar N ajustes a la vez (Promise.all no espera uno para enviar el otro)
  console.log(`Lanzando ${N} ajustes de ${CANTIDAD} en paralelo...`);
  const respuestas = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      ajustar(CANTIDAD, `Prueba de concurrencia #${i + 1}`),
    ),
  );

  const estados = [];
  for (const [i, r] of respuestas.entries()) {
    const cuerpo = await r.json();
    estados.push(r.status);
    const detalle = r.ok ? `stock → ${cuerpo.stock}` : cuerpo.message;
    console.log(`  ajuste #${i + 1}: ${r.status} (${detalle})`);
  }

  // 3. Resultado
  const final = await stockActual();
  const exitosos = estados.filter((s) => s === 200).length;
  const esperadoExitosos = Math.min(N, Math.floor(STOCK_INICIAL / -CANTIDAD));
  const esperadoFinal = STOCK_INICIAL + exitosos * CANTIDAD;
  console.log(`Stock final: ${final}`);

  const correcto =
    exitosos === esperadoExitosos &&
    estados.every((s) => s === 200 || s === 409) &&
    final === esperadoFinal &&
    final >= 0;
  console.log(
    correcto
      ? `✅ Correcto: ${exitosos} con 200, ${N - exitosos} con 409, stock final ${final}`
      : `❌ Inesperado: se esperaban ${esperadoExitosos} con 200 y stock final ${STOCK_INICIAL + esperadoExitosos * CANTIDAD}`,
  );
  process.exit(correcto ? 0 : 1);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
