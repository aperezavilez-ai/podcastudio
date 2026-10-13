-- Migración: Agregar índices para optimización de queries
-- Fecha: 2025-01-14
-- Descripción: Índices faltantes en tablas críticas para mejorar rendimiento

-- Índice en subscriptions.status (queries frecuentes por estado)
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

-- Índice en recordings.status (filtrar por estado de procesamiento)
CREATE INDEX IF NOT EXISTS idx_recordings_status
  ON public.recordings(status);

-- Índice compuesto en live_sessions para queries de usuario activo
CREATE INDEX IF NOT EXISTS idx_live_sessions_user_status
  ON public.live_sessions(user_id, status, created_at DESC);

-- Índice en recordings.mux_asset_id para lookups rápidos desde Mux webhooks
CREATE INDEX IF NOT EXISTS idx_recordings_mux_asset_id
  ON public.recordings(mux_asset_id)
  WHERE mux_asset_id IS NOT NULL;

-- Índice en recordings.youtube_video_id para sincronización con YouTube
CREATE INDEX IF NOT EXISTS idx_recordings_youtube_video_id
  ON public.recordings(youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;

-- Índice en subscriptions.current_period_end para expiración de suscripciones
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end
  ON public.subscriptions(current_period_end)
  WHERE current_period_end IS NOT NULL;

-- Comentarios para documentación
COMMENT ON INDEX idx_subscriptions_status IS 'Optimiza queries de filtrado por estado de suscripción';
COMMENT ON INDEX idx_recordings_status IS 'Optimiza filtrado por estado de procesamiento de grabaciones';
COMMENT ON INDEX idx_live_sessions_user_status IS 'Optimiza dashboard de sesiones en vivo del usuario';
COMMENT ON INDEX idx_recordings_mux_asset_id IS 'Lookup rápido desde webhooks de Mux';
COMMENT ON INDEX idx_recordings_youtube_video_id IS 'Sincronización con YouTube API';
COMMENT ON INDEX idx_subscriptions_period_end IS 'Cron jobs de expiración de suscripciones';
