// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://kcpbbaawmpwuhhapduig.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjcGJiYWF3bXB3dWhoYXBkdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3MzMzMzIsImV4cCI6MjA1NjMwOTMzMn0.zcf7z091S5Hm-baH7UT1S6AMaeB9OB22AaRxs7Kyl9o";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);