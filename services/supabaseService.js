dotenv.config();
const app = express();
const PORT = 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);


module.exports = { supabase }; // Экспортируем клиента для использования в других файлах
