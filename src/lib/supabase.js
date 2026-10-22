import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://fzoiuyyvzhgqcjceagkd.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2l1eXl2emhncWNqY2VhZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzMyOTUsImV4cCI6MjA5NzMwOTI5NX0.YQpOkEmgWHOTJgUnHp-EfWt68QW9xWTUxbvjzUtfU54';

export const supabase = createClient(url, key);
