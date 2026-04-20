export type UUID = string;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Vec2 = [number, number]; // [x, z] in meters on the floor plane (Three.js XZ)
export type Vec3 = [number, number, number]; // [x, y, z] in meters (Three.js)

export type Euler = Vec3; // radians, intrinsic XYZ (Three.js default)

export type OpeningType = "door" | "window";

export type OpeningSwing = "left" | "right" | "cw" | "ccw";

export type SurfaceId = string;

export interface UVTransform {
  offset?: Vec2;
  repeat?: Vec2;
  rotation?: number; // radians
}

export interface SurfaceMaterialAssignment {
  materialSkuId: string;
  uv?: UVTransform;
  tint?: string; // hex color, e.g. "#ffffff"
}

export interface FurnitureItem {
  id: string;
  modelId: UUID; // references public.assets.id
  name?: string;
  position: Vec3;
  rotation: Euler;
  scale: Vec3;
  anchor?: "floor" | "wall" | "ceiling" | "furniture_surface" | "desk_surface" | "shelf_surface";
  surfaceId?: SurfaceId;
  locked?: boolean;
  metadata?: Json;
}

export interface SceneDocumentData {
  schemaVersion: 1;
  roomShell: Json;
  nodes: Json[];
  materialOverride?: {
    wallMaterialIndex?: number;
    floorMaterialIndex?: number;
  };
  lighting?: {
    ambientIntensity?: number;
    hemisphereIntensity?: number;
    directionalIntensity?: number;
    environmentBlur?: number;
  };
}

export interface CustomizationData {
  schemaVersion: 1;
  furniture: FurnitureItem[];
  surfaceMaterials: Record<SurfaceId, SurfaceMaterialAssignment>;
  sceneDocument?: SceneDocumentData;
  defaults?: {
    floor?: SurfaceMaterialAssignment;
    wall?: SurfaceMaterialAssignment;
    ceiling?: SurfaceMaterialAssignment;
    lighting?: {
      ambientIntensity?: number;
      hemisphereIntensity?: number;
      directionalIntensity?: number;
      environmentBlur?: number;
    };
  };
}

export interface UserPreferences {
  ui?: {
    language?: string;
    theme?: "light" | "dark" | "system";
  };
  units?: {
    length?: "m" | "mm";
  };
  extra?: Record<string, Json>;
}

export interface ProjectMeta {
  import?: {
    sourceType?: "image" | "pdf" | "dxf" | "ifc" | "manual";
    sourcePath?: string;
  };
  thumbnailBucket?: string;
  tags?: string[];
  extra?: Record<string, Json>;
}

export interface AssetBoundingBox {
  min: Vec3;
  max: Vec3;
}

export interface AssetMeta {
  schemaVersion?: 1;
  unit?: "m";
  boundingBox?: AssetBoundingBox;
  pivot?: Vec3;
  defaultTransform?: {
    position?: Vec3;
    rotation?: Euler;
    scale?: Vec3;
  };
  stats?: {
    triangleCount?: number;
    materialCount?: number;
    textureCount?: number;
  };
  extra?: Record<string, Json>;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: UUID;
          display_name: string | null;
          avatar_url: string | null;
          locale: string | null;
          preferences: UserPreferences;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: UUID;
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string | null;
          preferences?: UserPreferences;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string | null;
          preferences?: UserPreferences;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: UUID;
          owner_id: UUID;
          name: string;
          description: string | null;
          thumbnail_path: string | null;
          current_version_id: UUID | null;
          meta: ProjectMeta;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          owner_id: UUID;
          name: string;
          description?: string | null;
          thumbnail_path?: string | null;
          current_version_id?: UUID | null;
          meta?: ProjectMeta;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          owner_id?: UUID;
          name?: string;
          description?: string | null;
          thumbnail_path?: string | null;
          current_version_id?: UUID | null;
          meta?: ProjectMeta;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_current_version_id_fkey";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "project_versions";
            referencedColumns: ["id"];
          }
        ];
      };
      project_versions: {
        Row: {
          id: UUID;
          project_id: UUID;
          version: number;
          created_by: UUID | null;
          message: string | null;
          customization: CustomizationData;
          snapshot_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          project_id: UUID;
          version: number;
          created_by?: UUID | null;
          message?: string | null;
          customization?: CustomizationData;
          snapshot_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          project_id?: UUID;
          version?: number;
          created_by?: UUID | null;
          message?: string | null;
          customization?: CustomizationData;
          snapshot_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      shared_projects: {
        Row: {
          id: UUID;
          project_id: UUID;
          project_version_id: UUID | null;
          token: string;
          permissions: string;
          expires_at: string | null;
          is_gallery_visible: boolean;
          published_at: string | null;
          preview_meta: Json | null;
          created_by: UUID;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          project_id: UUID;
          project_version_id?: UUID | null;
          token: string;
          permissions?: string;
          expires_at?: string | null;
          is_gallery_visible?: boolean;
          published_at?: string | null;
          preview_meta?: Json | null;
          created_by: UUID;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          project_id?: UUID;
          project_version_id?: UUID | null;
          token?: string;
          permissions?: string;
          expires_at?: string | null;
          is_gallery_visible?: boolean;
          published_at?: string | null;
          preview_meta?: Json | null;
          created_by?: UUID;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_projects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shared_projects_project_version_id_fkey";
            columns: ["project_version_id"];
            isOneToOne: false;
            referencedRelation: "project_versions";
            referencedColumns: ["id"];
          }
        ];
      };
      shared_project_activity_events: {
        Row: {
          id: UUID;
          shared_project_id: UUID;
          project_id: UUID;
          event_type: "view" | "product_focus";
          asset_id: string | null;
          source: string | null;
          session_key: string;
          created_at: string;
        };
        Insert: {
          id?: UUID;
          shared_project_id: UUID;
          project_id: UUID;
          event_type: "view" | "product_focus";
          asset_id?: string | null;
          source?: string | null;
          session_key: string;
          created_at?: string;
        };
        Update: {
          id?: UUID;
          shared_project_id?: UUID;
          project_id?: UUID;
          event_type?: "view" | "product_focus";
          asset_id?: string | null;
          source?: string | null;
          session_key?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_project_activity_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shared_project_activity_events_shared_project_id_fkey";
            columns: ["shared_project_id"];
            isOneToOne: false;
            referencedRelation: "shared_projects";
            referencedColumns: ["id"];
          }
        ];
      };
      assets: {
        Row: {
          id: UUID;
          owner_id: UUID | null;
          name: string;
          description: string | null;
          category: string;
          tags: string[];
          glb_path: string;
          thumbnail_path: string | null;
          preview_path: string | null;
          meta: AssetMeta;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          owner_id?: UUID | null;
          name: string;
          description?: string | null;
          category?: string;
          tags?: string[];
          glb_path: string;
          thumbnail_path?: string | null;
          preview_path?: string | null;
          meta?: AssetMeta;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          owner_id?: UUID | null;
          name?: string;
          description?: string | null;
          category?: string;
          tags?: string[];
          glb_path?: string;
          thumbnail_path?: string | null;
          preview_path?: string | null;
          meta?: AssetMeta;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: UUID;
          type: string;
          payload: Json;
          status: string;
          progress: number;
          attempts: number;
          max_attempts: number;
          run_at: string;
          locked_at: string | null;
          locked_by: string | null;
          recoverable: boolean | null;
          provider_status: Json | null;
          provider_errors: Json | null;
          details: string | null;
          result: Json | null;
          error_code: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          type: string;
          payload?: Json;
          status?: string;
          progress?: number;
          attempts?: number;
          max_attempts?: number;
          run_at?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          recoverable?: boolean | null;
          provider_status?: Json | null;
          provider_errors?: Json | null;
          details?: string | null;
          result?: Json | null;
          error_code?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          type?: string;
          payload?: Json;
          status?: string;
          progress?: number;
          attempts?: number;
          max_attempts?: number;
          run_at?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          recoverable?: boolean | null;
          provider_status?: Json | null;
          provider_errors?: Json | null;
          details?: string | null;
          result?: Json | null;
          error_code?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_project_version: {
        Args: {
          p_project_id: UUID;
          p_message?: string | null;
          p_customization?: CustomizationData;
          p_snapshot_path?: string | null;
        };
        Returns: Database["public"]["Tables"]["project_versions"]["Row"];
      };
      claim_jobs: {
        Args: {
          p_worker_id: string;
          p_limit?: number;
          p_type?: string;
        };
        Returns: Database["public"]["Tables"]["jobs"]["Row"][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
