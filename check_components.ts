
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkComponents() {
    const { data, error } = await supabase
        .from('salary_components')
        .select('*');

    if (error) {
        console.error('Error fetching components:', error);
        return;
    }

    console.log('Salary Components:', data);
}

checkComponents();
