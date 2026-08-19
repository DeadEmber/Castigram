// Tipos de la base de datos de Castigram.
// Se pueden regenerar con: supabase gen types typescript

export type Role = "vecino" | "admin";

export type BandoCategory =
  | "general"
  | "agua"
  | "luz"
  | "fiestas"
  | "pleno"
  | "obras"
  | "sanidad"
  | "urgente";

export type ListingCategory =
  | "venta"
  | "compra"
  | "servicio"
  | "alquiler"
  | "regalo";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: Role;
  bio: string | null;
  created_at: string;
}

export interface Bando {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  category: BandoCategory;
  urgent: boolean;
  image_url: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  author_id: string;
  title: string;
  description: string;
  price_cents: number | null;
  category: ListingCategory;
  image_url: string | null;
  status: "activo" | "cerrado";
  created_at: string;
}

export interface Comment {
  id: string;
  author_id: string;
  bando_id: string | null;
  post_id: string | null;
  body: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

// Esquema mínimo para tipar el cliente de Supabase.
// (Se puede sustituir por la versión completa generada con la CLI.)
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      bandos: { Row: Bando; Insert: Omit<Bando, "id" | "created_at"> & { id?: string }; Update: Partial<Bando> };
      posts: { Row: Post; Insert: Omit<Post, "id" | "created_at"> & { id?: string }; Update: Partial<Post> };
      listings: { Row: Listing; Insert: Omit<Listing, "id" | "created_at"> & { id?: string }; Update: Partial<Listing> };
      comments: { Row: Comment; Insert: Omit<Comment, "id" | "created_at"> & { id?: string }; Update: Partial<Comment> };
      likes: {
        Row: { user_id: string; bando_id: string | null; post_id: string | null; created_at: string };
        Insert: { user_id: string; bando_id?: string | null; post_id?: string | null };
        Update: never;
      };
      notifications: { Row: Notification; Insert: Omit<Notification, "id" | "created_at" | "read"> & { read?: boolean }; Update: Partial<Notification> };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
  };
}
