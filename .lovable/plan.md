# Rastreador de precios de Cardmarket

Empezamos por el motor de extracción de precios (como pediste), y dejamos preparado el panel para la siguiente fase.

## Aviso importante antes de empezar

Cardmarket bloquea de forma agresiva a los robots y su normativa no permite el scraping. Además, los proxies gratuitos de free-proxy-list.net caen constantemente y, en el tipo de servidor donde vive esta app, no siempre se pueden usar para redirigir el tráfico.

Por eso el motor se construye en dos capas:

1. **Proxies gratuitos**: la app descarga la lista de free-proxy-list.net, la guarda, la va probando y rota automáticamente cuando uno falla o nos bloquean.
2. **Servicio de extracción de respaldo (Firecrawl)**: cuando ningún proxy funciona o Cardmarket nos bloquea, la app usa un servicio profesional de extracción para no quedarse sin datos. Te pediré conectarlo cuando lleguemos a ese punto.

Si en las pruebas resulta que los proxies gratuitos no aguantan, te lo diré con datos reales y decidimos.

## Fase 1 — Motor de extracción (esto es lo que construyo ahora)

- **Cuentas**: registro e inicio de sesión con email y contraseña. Cada usuario ve solo sus cartas.
- **Lista de proxies**: pantalla que descarga y muestra los proxies de free-proxy-list.net con país, tipo, si tiene HTTPS, última comprobación y estado (funciona / lento / caído).
- **Rotación y bloqueos**: cada consulta usa un proxy sano; si da error, timeout o respuesta de bloqueo, se marca como quemado y se pasa al siguiente automáticamente.
- **Ritmo configurable**: ajustas cada cuánto se actualizan los precios, cuántas consultas por minuto y una pausa aleatoria entre peticiones para no llamar la atención.
- **Añadir cartas**: pegas la dirección de la carta en Cardmarket (o la buscas por nombre) y la app guarda nombre, juego, expansión y edición.
- **Captura de precios**: por cada carta se guarda precio mínimo, precio medio y tendencia, con fecha, creando un histórico.
- **Registro de actividad**: qué se consultó, con qué proxy, si funcionó y por qué falló.
- **Juegos iniciales**: Magic: The Gathering y Riftbound.

## Fase 2 — Panel de análisis

- Indicador por carta: subiendo, bajando o estable, con el porcentaje de cambio.
- Gráfica de evolución de precios por carta y comparativa entre varias.
- Vista por juego y por expansión, con las cartas "a seguir" (las que más se mueven).
- Lista de los 10 más baratos.

## Fase 3 — Avisos

- Alertas configurables: "avísame si baja de X euros" o "si cae un X% en N días".
- Canales: dentro de la app, por email y por Telegram, cada uno activable por separado.

## Ideas extra que te propongo (tú decides)

- **Precio objetivo de compra** calculado a partir del histórico, no solo del precio de hoy.
- **Valor total de tu colección** y cuánto has ganado o perdido.
- **Detección de chollos**: vendedores muy por debajo del precio medio del mercado.
- **Filtro por estado de la carta** (NM, EX...) y por idioma, que cambian mucho el precio.
- **Importar colección** desde un archivo CSV en vez de añadir carta a carta.
- **Resumen semanal por email** con los movimientos más importantes.
- **Comparar con otras tiendas** para ver dónde está más barata.

## Detalles técnicos

- Base de datos y autenticación con Lovable Cloud (tablas: perfiles, proxies, cartas seguidas, histórico de precios, alertas, ajustes, registro de ejecuciones).
- Todo el scraping se ejecuta en el servidor mediante funciones de servidor; nunca desde el navegador.
- Un endpoint programado ejecuta la ronda de actualización según el intervalo configurado.
- La lista de proxies se refresca desde free-proxy-list.net y se verifica antes de usarse.
- Respaldo de extracción vía conector Firecrawl cuando la vía proxy falla.
