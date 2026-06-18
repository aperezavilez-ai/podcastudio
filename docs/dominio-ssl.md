# DNS y HTTPS para podcaststudio.mx

El aviso "Tu conexión no es segura" significa que el dominio **no tiene certificado SSL** (HTTPS).
Eso impide login, PWA e instalación en móvil.

## Pasos en Vercel (obligatorio)

1. [vercel.com](https://vercel.com) → proyecto **podcastudio** → **Settings → Domains**
2. Añade `podcaststudio.mx` y `www.podcaststudio.mx`
3. Espera el estado **Valid** (check verde) y **SSL: Active**

## Registros DNS en tu registrador

Usa **solo** los que Vercel te muestre. Lo habitual:

| Tipo  | Nombre | Valor              |
|-------|--------|--------------------|
| **A** | `@`    | `76.76.21.21`      |
| **CNAME** | `www` | `cname.vercel-dns.com` |

O si Vercel pide nameservers, apunta el dominio a:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

**No** apuntes el dominio a otra IP o hosting sin SSL.

## Mientras tanto (funciona ya con HTTPS)

**https://podcastudio-three.vercel.app**

## Comprobar

- Abre siempre `https://` (no `http://`)
- En Vercel → Domains debe decir **SSL Certificate: Active**
- La propagación DNS puede tardar hasta 48 h
