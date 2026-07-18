export type Database = {
  public: {
    Tables: {
      apps: {
        Row: {
          id: string;
          name: string;
          access_key: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          access_key: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          access_key?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blobs: {
        Row: {
          id: string;
          app_id: string;
          data: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          app_id: string;
          data: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          app_id?: string;
          data?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blobs_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "apps";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
