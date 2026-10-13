-- Migración: Soft Deletes
-- Fecha: 2025-01-14
-- Descripción: Agregar deleted_at para eliminación suave en tablas críticas

-- Agregar columna deleted_at a tablas principales
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.youtube_connections
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Índices para filtrar registros no eliminados
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON public.projects(deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recordings_deleted_at
  ON public.recordings(deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_deleted_at
  ON public.live_sessions(deleted_at)
  WHERE deleted_at IS NULL;

-- Actualizar políticas RLS para excluir registros eliminados

-- Projects
DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
CREATE POLICY "Users manage own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NULL);

-- Subscriptions
DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Recordings
DROP POLICY IF EXISTS "Users read own recordings" ON public.recordings;
CREATE POLICY "Users read own recordings"
  ON public.recordings FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- YouTube connections
DROP POLICY IF EXISTS "Users read own youtube" ON public.youtube_connections;
CREATE POLICY "Users read own youtube"
  ON public.youtube_connections FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Live sessions
DROP POLICY IF EXISTS "Users read own live sessions" ON public.live_sessions;
CREATE POLICY "Users read own live sessions"
  ON public.live_sessions FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Función helper para soft delete
CREATE OR REPLACE FUNCTION public.soft_delete(
  p_table_name text,
  p_record_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_sql text;
BEGIN
  -- Validar tabla permitida
  IF p_table_name NOT IN ('projects', 'recordings', 'live_sessions') THEN
    RAISE EXCEPTION 'Soft delete not allowed on table: %', p_table_name;
  END IF;

  -- Ejecutar soft delete
  v_sql := format(
    'UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    p_table_name
  );

  EXECUTE v_sql USING p_record_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para restaurar registros eliminados
CREATE OR REPLACE FUNCTION public.restore_deleted(
  p_table_name text,
  p_record_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_sql text;
BEGIN
  -- Validar tabla permitida
  IF p_table_name NOT IN ('projects', 'recordings', 'live_sessions') THEN
    RAISE EXCEPTION 'Restore not allowed on table: %', p_table_name;
  END IF;

  -- Restaurar
  v_sql := format(
    'UPDATE public.%I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
    p_table_name
  );

  EXECUTE v_sql USING p_record_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON COLUMN public.projects.deleted_at IS 'Timestamp de eliminación suave (NULL = activo)';
COMMENT ON COLUMN public.recordings.deleted_at IS 'Timestamp de eliminación suave (NULL = activo)';
COMMENT ON FUNCTION public.soft_delete IS 'Marca un registro como eliminado sin borrarlo físicamente';
COMMENT ON FUNCTION public.restore_deleted IS 'Restaura un registro previamente eliminado';
