
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { resolve } from 'path';

// Manual .env parsing
const envPath = 'c:\\Users\\wlsru\\IncenCalc\\.env';
console.log('Reading .env from:', envPath);
let envConfig: Record<string, string> = {};

try {
    if (!fs.existsSync(envPath)) {
        console.error('.env file not found at:', envPath);
        process.exit(1);
    }
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key && value) {
                envConfig[key] = value;
            }
        }
    });
    console.log('Loaded keys:', Object.keys(envConfig));
} catch (e) {
    console.error('Error reading .env file:', e);
    process.exit(1);
}

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking incentive_details schema...');

    // Check category
    const { error: catError } = await supabase
        .from('incentive_details')
        .select('category')
        .limit(1);

    if (catError) {
        console.log('CONCLUSION: Column category DOES NOT EXIST.');
    } else {
        console.log('Select successful. Column category EXISTS.');
    }

    // Check application_rate
    const { error } = await supabase
        .from('incentive_details')
        .select('application_rate')
        .limit(1);

    if (error) {
        console.error('Error selecting application_rate:', error.message);
        if (error.message.includes('does not exist') || error.code === 'PGRST301') {
            console.log('CONCLUSION: Column application_rate DOES NOT EXIST.');
        }
        return;
    }

    console.log('Select successful. Column application_rate EXISTS.');
}

checkSchema();
