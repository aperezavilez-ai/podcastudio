# PodcastStudio v1.2.7

## Relay TURN administrado

- La API `/api/turn-credentials` pide a Cloudflare Realtime credenciales TURN temporales con vigencia de 12 horas.
- La llave TURN y el token de API permanecen en el servidor; no se incluyen en el JavaScript del cliente.
- Se omiten las URLs alternas del puerto 53 para evitar candidatos TURN que puedan demorarse o estar bloqueados en navegadores.

## Activación en producción

1. Crea una llave TURN en Cloudflare Realtime.
2. Genera un API token con permiso `Calls: Write` para la cuenta.
3. Agrega `CLOUDFLARE_TURN_KEY_ID` y `CLOUDFLARE_TURN_API_TOKEN` como variables Production en Vercel y vuelve a desplegar.

La API responde `503` hasta que ambas variables estén configuradas. Cloudflare publica 1,000 GB mensuales de salida sin cargo y luego un precio de USD 0.05/GB; revisa el consumo del relay en la cuenta.

## Verificación

- Build Vite y `.exe` v1.2.7.0: pendientes de la verificación final.
- El endpoint y la generación de credenciales se verifican localmente con una respuesta simulada.
- La prueba real con Android/iOS necesita las credenciales de una cuenta Cloudflare configurada en Vercel y dispositivos físicos.
