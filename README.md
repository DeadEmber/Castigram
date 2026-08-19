# 📣 Castigram

**El bando digital del pueblo.** Una pequeña red social vecinal para sustituir
al bando municipal: el ayuntamiento publica avisos oficiales, los vecinos
comparten en el muro y compran/venden en el mercadillo.

Hecho con **Next.js 14** + **Supabase** (base de datos, login y almacenamiento
de fotos) + **Tailwind CSS**. Diseño e identidad propios — sin usar marcas de
terceros.

## ✨ Funciones

- **Bandos oficiales** — solo el ayuntamiento (cuentas *admin*) puede publicarlos.
  Categorías (agua, luz, fiestas, plenos, obras…) y opción de marcarlos como
  **urgentes**, que notifica automáticamente a todos los vecinos.
- **Muro vecinal** — cualquier vecino registrado publica, con fotos, "me gusta"
  y comentarios.
- **Mercadillo** — tablón de anuncios: se vende, se busca, servicios, alquiler
  y regalos, con filtro por categoría y precio.
- **Notificaciones** — campana con los avisos, y notificación a todo el pueblo
  cuando hay un bando urgente.

## 🚀 Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto.
2. Ve a **SQL Editor** y ejecuta, por orden, los ficheros de
   `supabase/migrations/`:
   - `0001_schema.sql`
   - `0002_rls.sql`
   - `0003_storage.sql`

   (O usa la CLI de Supabase: `supabase db push`.)

### 2. Configurar el frontend

```bash
npm install
cp .env.example .env.local
```

Rellena `.env.local` con los datos de **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
NEXT_PUBLIC_PUEBLO=Nombre de tu pueblo
```

### 3. Arrancar

```bash
npm run dev
```

Abre http://localhost:3000

### 4. Nombrar al ayuntamiento (admin)

Regístrate con la cuenta del ayuntamiento y, en el **SQL Editor** de Supabase,
conviértela en administradora:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'ayuntamiento@tupueblo.es');
```

A partir de ahí, esa cuenta verá el botón **"Publicar un bando"**.

## 📧 Correos (confirmación y avisos)

Supabase envía los correos de confirmación de registro automáticamente (con
límites en el plan gratuito). Para producción conviene configurar un proveedor
SMTP propio en **Supabase → Authentication → Emails**.

Las notificaciones de bandos urgentes funcionan **dentro de la app** (campana).
Si quieres además enviarlas por **email o push**, se puede añadir una *Edge
Function* de Supabase; queda como mejora futura.

## ☁️ Despliegue

Despliega en [Vercel](https://vercel.com) (gratis para este tamaño):
importa el repo, añade las mismas variables de entorno y listo. Recuerda
añadir la URL de producción en **Supabase → Authentication → URL
Configuration** (Site URL y Redirect URLs).

## 🗂️ Estructura

```
supabase/migrations/   Esquema, seguridad (RLS) y almacenamiento
src/app/               Páginas (bandos, muro, mercadillo, perfil, admin)
src/components/        Componentes de interfaz
src/lib/               Cliente de Supabase, tipos y utilidades
```

## ⚖️ Licencia y marcas

Todo el diseño (logo, colores, interfaz) es original de este proyecto. No se
usan logotipos, tipografías ni assets de otras redes sociales. Puedes adaptarlo
libremente para tu pueblo.
