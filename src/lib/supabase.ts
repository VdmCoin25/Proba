import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sjyrjeaghkkqkpkhlhhv.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeXJqZWFnaGtrcWtwa2hsaGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjM4ODUsImV4cCI6MjA5NDMzOTg4NX0._m7QY6idRfLqzp7KkfzU6WMuBP6_-hNqifyRMdC7C-0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
