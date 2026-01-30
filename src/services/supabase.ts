import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://fwqnahixkrmmflzjvptg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3cW5haGl4a3JtbWZsemp2cHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTUwOTcsImV4cCI6MjA2NDczMTA5N30.ThRrhfp_7gZPCrdoMpqdMo-NfaMW9LS6ytp4mVzh368';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});