-- Migración: Sistema de auditoría
-- Fecha: 2025-01-14
-- Descripción: Tabla para rastrear cambios críticos y accesos administrativos

-- Tabla de logs de auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action
  ON public.audit_logs(table_name, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id
  ON public.audit_logs(record_id)
  WHERE record_id IS NOT NULL;

-- RLS: Solo admins leen logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'role') = 'admin'
    )
  );

-- Función para registrar cambios automáticamente
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers en tablas críticas

-- Auditar cambios en suscripciones
DROP TRIGGER IF EXISTS audit_subscriptions ON public.subscriptions;
CREATE TRIGGER audit_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Auditar cambios en proyectos
DROP TRIGGER IF EXISTS audit_projects ON public.projects;
CREATE TRIGGER audit_projects
  AFTER UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Auditar grabaciones eliminadas o modificadas
DROP TRIGGER IF EXISTS audit_recordings ON public.recordings;
CREATE TRIGGER audit_recordings
  AFTER UPDATE OR DELETE ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Comentarios
COMMENT ON TABLE public.audit_logs IS 'Registro de auditoría para trazabilidad de cambios críticos';
COMMENT ON COLUMN public.audit_logs.action IS 'Tipo de operación: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN public.audit_logs.old_data IS 'Estado anterior del registro (solo en UPDATE/DELETE)';
COMMENT ON COLUMN public.audit_logs.new_data IS 'Nuevo estado del registro (solo en INSERT/UPDATE)';
